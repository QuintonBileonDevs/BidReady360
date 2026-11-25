import dotenv from 'dotenv';
dotenv.config();

import { query } from '../server/db/client';
import { completenessService } from '../server/services/completeness.service';
import { suppliersRepository } from '../server/repositories/suppliers.repository';

async function main() {
  console.log('================================================================');
  console.log('       COMPLETENESS 7-STEP PROOF: SINGLE SOURCE OF TRUTH        ');
  console.log('================================================================\n');

  const testSupplierId = 'a0000000-0000-0000-0000-000000000099';
  const testUin = 'TEST-UIN-' + Date.now();

  async function getValues(supplierId: string) {
    // 1. Stored value in PostgreSQL database column suppliers.profile_completeness
    const storedRes = await query<{ profile_completeness: number }>(
      'SELECT profile_completeness FROM suppliers WHERE id = $1',
      [supplierId]
    );
    const stored = storedRes.rows[0]?.profile_completeness ?? -1;

    // 2. Computed value returned directly by PostgreSQL compute_supplier_completeness function
    const computedRes = await query<{ val: number }>(
      'SELECT compute_supplier_completeness($1) AS val',
      [supplierId]
    );
    const computed = computedRes.rows[0]?.val ?? -1;

    // 3. Screen value (authoritative value delivered to client API & rendered in UI)
    const profile = await suppliersRepository.getById(supplierId);
    const screen = profile?.profileCompleteness ?? -1;

    return { stored, computed, screen };
  }

  async function cleanup() {
    await query(
      'UPDATE supplier_documents SET current_version_id = NULL WHERE supplier_id = $1',
      [testSupplierId]
    );
    await query(
      'DELETE FROM supplier_document_versions WHERE document_id IN (SELECT id FROM supplier_documents WHERE supplier_id = $1)',
      [testSupplierId]
    );
    await query('DELETE FROM supplier_documents WHERE supplier_id = $1', [testSupplierId]);
    await query('DELETE FROM supplier_people WHERE supplier_id = $1', [testSupplierId]);
    await query('DELETE FROM suppliers WHERE id = $1', [testSupplierId]);
  }

  try {
    // Cleanup any prior run with this ID
    await cleanup();

    // -------------------------------------------------------------
    // STEP 1: New supplier shows 0
    // -------------------------------------------------------------
    console.log('--- STEP 1: New Supplier Created (all evaluated fields blank) ---');
    await query(
      `INSERT INTO suppliers (
        id, cipa_uin, legal_name, status, verification_status, compliance_status
      ) VALUES ($1, $2, '', 'active', 'pending', 'Action required')`,
      [testSupplierId, testUin]
    );

    let v = await getValues(testSupplierId);
    console.log(`Stored DB value : ${v.stored}%`);
    console.log(`Computed DB val : ${v.computed}%`);
    console.log(`Screen UI value : ${v.screen}%`);
    if (v.stored === 0 && v.computed === 0 && v.screen === 0) {
      console.log('RESULT: PASS (All three match at 0%)\n');
    } else {
      throw new Error(`Step 1 mismatch: stored=${v.stored}, computed=${v.computed}, screen=${v.screen}`);
    }
    const valStep1 = v.stored;

    // -------------------------------------------------------------
    // STEP 2: Fill one field: it rises
    // -------------------------------------------------------------
    console.log('--- STEP 2: Fill One Field (physical_address: "Plot 1234, G-West Industrial") ---');
    await query(
      `UPDATE suppliers
       SET physical_address = 'Plot 1234, G-West Industrial'
       WHERE id = $1`,
      [testSupplierId]
    );

    v = await getValues(testSupplierId);
    console.log(`Stored DB value : ${v.stored}%`);
    console.log(`Computed DB val : ${v.computed}%`);
    console.log(`Screen UI value : ${v.screen}%`);
    if (v.stored === v.computed && v.computed === v.screen && v.stored > valStep1) {
      console.log(`RESULT: PASS (All three match at ${v.stored}%, risen from ${valStep1}%)\n`);
    } else {
      throw new Error(`Step 2 mismatch or didn't rise: stored=${v.stored}, computed=${v.computed}, screen=${v.screen}`);
    }
    const valStep2 = v.stored;

    // -------------------------------------------------------------
    // STEP 3: Add a director: it rises
    // -------------------------------------------------------------
    console.log('--- STEP 3: Add a Director with 100% shareholding ---');
    const personId = 'b0000000-0000-0000-0000-000000000001';
    await query(
      `INSERT INTO supplier_people (
        id, supplier_id, full_name, person_role, ownership_percent, is_active, is_citizen, nationality
      ) VALUES ($1, $2, 'Kagiso Molosiwa', 'director', 100, true, true, 'Motswana')`,
      [personId, testSupplierId]
    );

    v = await getValues(testSupplierId);
    console.log(`Stored DB value : ${v.stored}%`);
    console.log(`Computed DB val : ${v.computed}%`);
    console.log(`Screen UI value : ${v.screen}%`);
    if (v.stored === v.computed && v.computed === v.screen && v.stored > valStep2) {
      console.log(`RESULT: PASS (All three match at ${v.stored}%, risen from ${valStep2}%)\n`);
    } else {
      throw new Error(`Step 3 mismatch or didn't rise: stored=${v.stored}, computed=${v.computed}, screen=${v.screen}`);
    }
    const valStep3 = v.stored;

    // -------------------------------------------------------------
    // STEP 4: Upload a document: no change until a verifier approves it
    // -------------------------------------------------------------
    console.log('--- STEP 4: Upload a Document (CIPA Certificate, pending verification) ---');
    // Find CIPA document type id
    const docTypeRes = await query<{ id: string }>(
      `SELECT id FROM document_types WHERE code IN ('COMPANY_REGISTRATION', 'CIPA_CERT') OR name ILIKE '%cipa%' LIMIT 1`
    );
    const docTypeId = docTypeRes.rows[0]?.id;
    if (!docTypeId) throw new Error('No CIPA document type found in database');

    const docId = 'c0000000-0000-0000-0000-000000000001';
    const verId = 'd0000000-0000-0000-0000-000000000001';

    // Insert container
    await query(
      `INSERT INTO supplier_documents (id, supplier_id, document_type_id, title, status)
       VALUES ($1, $2, $3, 'CIPA Certificate', 'active')`,
      [docId, testSupplierId, docTypeId]
    );

    // Insert version in 'pending' status with future expiry date
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const expiryStr = futureDate.toISOString().substring(0, 10);

    // Query an active user to satisfy foreign key on uploaded_by_user_id
    const userRes = await query<{ id: string }>('SELECT id FROM users LIMIT 1');
    const uploaderId = userRes.rows[0]?.id;

    await query(
      `INSERT INTO supplier_document_versions (
        id, document_id, version_no, file_name, file_size_bytes, mime_type, sha256, storage_key,
        verification_status, expiry_date, uploaded_by_user_id
      ) VALUES ($1, $2, 1, 'cipa_cert.pdf', 1024, 'application/pdf', 'dummy_hash', 'vault/test', 'PENDING_VERIFICATION', $3, $4)`,
      [verId, docId, expiryStr, uploaderId]
    );

    // Update container's current_version_id
    await query(
      `UPDATE supplier_documents SET current_version_id = $1 WHERE id = $2`,
      [verId, docId]
    );

    v = await getValues(testSupplierId);
    console.log(`Stored DB value : ${v.stored}%`);
    console.log(`Computed DB val : ${v.computed}%`);
    console.log(`Screen UI value : ${v.screen}%`);
    if (v.stored === v.computed && v.computed === v.screen && v.stored === valStep3) {
      console.log(`RESULT: PASS (All three match at ${v.stored}%, exactly unchanged from Step 3)\n`);
    } else {
      throw new Error(`Step 4 failed: stored=${v.stored}, computed=${v.computed}, screen=${v.screen}, expected=${valStep3}`);
    }

    // -------------------------------------------------------------
    // STEP 5: Approve it: it rises
    // -------------------------------------------------------------
    console.log('--- STEP 5: Approve Document (verification_status = "VERIFIED") ---');
    await query(
      `UPDATE supplier_document_versions
       SET verification_status = 'VERIFIED', verified_at = NOW()
       WHERE id = $1`,
      [verId]
    );

    v = await getValues(testSupplierId);
    console.log(`Stored DB value : ${v.stored}%`);
    console.log(`Computed DB val : ${v.computed}%`);
    console.log(`Screen UI value : ${v.screen}%`);
    if (v.stored === v.computed && v.computed === v.screen && v.stored > valStep3) {
      console.log(`RESULT: PASS (All three match at ${v.stored}%, risen from ${valStep3}%)\n`);
    } else {
      throw new Error(`Step 5 mismatch or didn't rise: stored=${v.stored}, computed=${v.computed}, screen=${v.screen}`);
    }
    const valStep5 = v.stored;

    // -------------------------------------------------------------
    // STEP 6: Set that document's expiry to yesterday and run the daily job: it falls
    // -------------------------------------------------------------
    console.log("--- STEP 6: Set Expiry to Yesterday and Run Daily Job ---");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().substring(0, 10);

    // Update version expiry date to yesterday
    await query(
      `UPDATE supplier_document_versions
       SET expiry_date = $1
       WHERE id = $2`,
      [yesterdayStr, verId]
    );

    // Run the daily reconciliation job
    console.log('Executing completenessService.runDailyJob()...');
    const jobResult = await completenessService.runDailyJob();
    console.log(`Daily job completed: checked ${jobResult.checked}, updated ${jobResult.updated} suppliers.`);

    v = await getValues(testSupplierId);
    console.log(`Stored DB value : ${v.stored}%`);
    console.log(`Computed DB val : ${v.computed}%`);
    console.log(`Screen UI value : ${v.screen}%`);
    if (v.stored === v.computed && v.computed === v.screen && v.stored < valStep5) {
      console.log(`RESULT: PASS (All three match at ${v.stored}%, fallen from ${valStep5}% to ${v.stored}%)\n`);
    } else {
      throw new Error(`Step 6 mismatch or didn't fall: stored=${v.stored}, computed=${v.computed}, screen=${v.screen}`);
    }
    const valStep6 = v.stored;

    // -------------------------------------------------------------
    // STEP 7: Remove the director: it falls
    // -------------------------------------------------------------
    console.log('--- STEP 7: Remove the Director ---');
    await query(
      `DELETE FROM supplier_people WHERE id = $1`,
      [personId]
    );

    v = await getValues(testSupplierId);
    console.log(`Stored DB value : ${v.stored}%`);
    console.log(`Computed DB val : ${v.computed}%`);
    console.log(`Screen UI value : ${v.screen}%`);
    if (v.stored === v.computed && v.computed === v.screen && v.stored < valStep6) {
      console.log(`RESULT: PASS (All three match at ${v.stored}%, fallen from ${valStep6}% to ${v.stored}%)\n`);
    } else {
      throw new Error(`Step 7 mismatch or didn't fall: stored=${v.stored}, computed=${v.computed}, screen=${v.screen}`);
    }

    console.log('================================================================');
    console.log('   ALL 7 STEPS PASSED PERFECTLY: ALL 3 NUMBERS MATCH AT EVERY STEP');
    console.log('================================================================\n');

  } catch (err: any) {
    console.error('Test execution failed:', err);
    process.exitCode = 1;
  } finally {
    await cleanup();
    process.exit(process.exitCode ?? 0);
  }
}

main();
