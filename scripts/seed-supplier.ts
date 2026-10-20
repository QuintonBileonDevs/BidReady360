import bcrypt from 'bcryptjs';
import { pool, withTransaction, query } from '../server/db/client';

async function seedTestSupplier() {
  console.log('=== Seeding Test Supplier into PostgreSQL ===');

  const testEmail = 'supplier@bidready360.co.bw';
  const testPasswordPlain = 'Pula2026!Secure';
  const testLegalName = 'Kalahari Technologies & Supplies (Pty) Ltd';
  const testCipa = 'BW00008899221';
  const testFullName = 'Kagiso Mogorosi';
  const testPhone = '+267 71234567';

  try {
    // 1. Generate secure bcrypt password hash (12 salt rounds)
    const passwordHash = await bcrypt.hash(testPasswordPlain, 12);

    await withTransaction(async (client) => {
      // 2. Check if user already exists; if so, update password and activate
      let userRes = await client.query(
        'SELECT id, email, full_name FROM users WHERE email = $1 LIMIT 1',
        [testEmail]
      );

      let userId: string;
      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].id;
        await client.query(
          `UPDATE users 
           SET password_hash = $1, 
               full_name = $2, 
               phone = $3, 
               status = 'active', 
               email_verified_at = NOW(),
               mfa_enabled = FALSE,
               locked_until = NULL,
               failed_login_attempts = 0
           WHERE id = $4`,
          [passwordHash, testFullName, testPhone, userId]
        );
        console.log(`Updated existing user: ${testEmail} (ID: ${userId})`);
      } else {
        const insertUserRes = await client.query(
          `INSERT INTO users (
             email, password_hash, full_name, phone, status, 
             email_verified_at, mfa_enabled, failed_login_attempts
           ) VALUES (
             $1, $2, $3, $4, 'active', NOW(), FALSE, 0
           ) RETURNING id`,
          [testEmail, passwordHash, testFullName, testPhone]
        );
        userId = insertUserRes.rows[0].id;
        console.log(`Created new user: ${testEmail} (ID: ${userId})`);
      }

      // 3. Check or Create Supplier record
      let supplierRes = await client.query(
        'SELECT id, legal_name, cipa_uin FROM suppliers WHERE cipa_uin = $1 OR email = $2 LIMIT 1',
        [testCipa, testEmail]
      );

      let supplierId: string;
      if (supplierRes.rows.length > 0) {
        supplierId = supplierRes.rows[0].id;
        await client.query(
          `UPDATE suppliers 
           SET legal_name = $1,
               trading_name = 'Kalahari Tech',
               cipa_uin = $2,
               burs_tin = 'C987654321',
               ppra_registration_no = 'PPRA/2026/08892',
               company_type = 'private_company',
               year_established = 2018,
               description = 'Premier ICT solutions, network infrastructure, and procurement supply provider in Botswana.',
               physical_address = 'Plot 54368, iTowers, Western Commercial Wing, CBD',
               city = 'Gaborone',
               country_code = 'BW',
               primary_phone = $3,
               email = $4,
               citizen_owned_percentage = 100.0,
               status = 'active',
               verification_status = 'verified',
               compliance_status = 'Fully compliant',
               profile_completeness = 100,
               bank_name = 'First National Bank of Botswana (FNBB)',
               bank_branch = 'Corporate Branch, Gaborone',
               account_number_masked = '6284••••••12'
           WHERE id = $5`,
          [testLegalName, testCipa, testPhone, testEmail, supplierId]
        );
        console.log(`Updated existing supplier: ${testLegalName} (ID: ${supplierId})`);
      } else {
        const insertSupRes = await client.query(
          `INSERT INTO suppliers (
             legal_name, trading_name, cipa_uin, burs_tin, ppra_registration_no,
             company_type, year_established, description, physical_address, city,
             country_code, primary_phone, email, citizen_owned_percentage,
             status, verification_status, compliance_status, profile_completeness,
             bank_name, bank_branch, account_number_masked
           ) VALUES (
             $1, 'Kalahari Tech', $2, 'C987654321', 'PPRA/2026/08892',
             'private_company', 2018, 'Premier ICT solutions, network infrastructure, and procurement supply provider in Botswana.',
             'Plot 54368, iTowers, Western Commercial Wing, CBD', 'Gaborone',
             'BW', $3, $4, 100.0,
             'active', 'verified', 'Fully compliant', 100,
             'First National Bank of Botswana (FNBB)', 'Corporate Branch, Gaborone', '6284••••••12'
           ) RETURNING id`,
          [testLegalName, testCipa, testPhone, testEmail]
        );
        supplierId = insertSupRes.rows[0].id;
        console.log(`Created new supplier: ${testLegalName} (ID: ${supplierId})`);
      }

      // 4. Get Supplier Admin role
      const roleRes = await client.query(
        `SELECT id FROM roles WHERE scope = 'supplier' AND name = 'Supplier Admin' LIMIT 1`
      );
      const roleId = roleRes.rows[0]?.id;

      // 5. Ensure Supplier Membership exists and is active
      const memberRes = await client.query(
        `SELECT id FROM supplier_members WHERE supplier_id = $1 AND user_id = $2 LIMIT 1`,
        [supplierId, userId]
      );

      if (memberRes.rows.length === 0) {
        await client.query(
          `INSERT INTO supplier_members (supplier_id, user_id, role_id, is_owner, status, joined_at)
           VALUES ($1, $2, $3, TRUE, 'active', NOW())`,
          [supplierId, userId, roleId]
        );
        console.log('Linked user to supplier with Supplier Admin permissions.');
      } else {
        await client.query(
          `UPDATE supplier_members 
           SET role_id = $1, is_owner = TRUE, status = 'active'
           WHERE id = $2`,
          [roleId, memberRes.rows[0].id]
        );
      }

      // 6. Ensure Director record in supplier_people
      const personRes = await client.query(
        `SELECT id FROM supplier_people WHERE supplier_id = $1 AND email = $2 LIMIT 1`,
        [supplierId, testEmail]
      );
      if (personRes.rows.length === 0) {
        await client.query(
          `INSERT INTO supplier_people (
             supplier_id, full_name, person_role, nationality, is_citizen, email, phone, kyc_status, is_active
           ) VALUES (
             $1, $2, 'director', 'Motswana', TRUE, $3, $4, 'verified', TRUE
           )`,
          [supplierId, testFullName, testEmail, testPhone]
        );
        console.log('Added director profile in supplier_people.');
      }

      // 7. Ensure standard Vault Documents exist
      const docTypes = await client.query(`
        SELECT id, code, name 
        FROM document_types 
        WHERE code IN ('COMPANY_REGISTRATION', 'TAX_CLEARANCE', 'VAT_REGISTRATION', 'PPRA_REGISTRATION')
      `);

      for (const dt of docTypes.rows) {
        let docCheck = await client.query(
          `SELECT id FROM supplier_documents WHERE supplier_id = $1 AND document_type_id = $2 LIMIT 1`,
          [supplierId, dt.id]
        );

        let docId: string;
        if (docCheck.rows.length === 0) {
          const insertDoc = await client.query(
            `INSERT INTO supplier_documents (supplier_id, document_type_id, title, status)
             VALUES ($1, $2, $3, 'active') RETURNING id`,
            [supplierId, dt.id, dt.name]
          );
          docId = insertDoc.rows[0].id;
        } else {
          docId = docCheck.rows[0].id;
        }

        // Add verified document version if not present
        const verCheck = await client.query(
          `SELECT id FROM supplier_document_versions WHERE document_id = $1 LIMIT 1`,
          [docId]
        );

        if (verCheck.rows.length === 0) {
          const fakeSha = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
          const insertVer = await client.query(
            `INSERT INTO supplier_document_versions (
               document_id, version_no, storage_key, file_name, mime_type, file_size_bytes, sha256,
               document_number, issue_date, expiry_date, uploaded_by_user_id, verification_status,
               verified_via, verified_at, verification_notes
             ) VALUES (
               $1, 1, $2, $3, 'application/pdf', 1048576, $4,
               $5, CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE + INTERVAL '335 days', $6, 'VERIFIED',
               'registry_api', NOW(), 'Auto-verified against CIPA/BURS/PPRA authoritative registry.'
             ) RETURNING id`,
            [
              docId,
              `vault/${supplierId}/${dt.code.toLowerCase()}_v1.pdf`,
              `${dt.name}.pdf`,
              fakeSha,
              `${dt.code}-2026-BW`,
              userId,
            ]
          );

          await client.query(
            `UPDATE supplier_documents SET current_version_id = $1 WHERE id = $2`,
            [insertVer.rows[0].id, docId]
          );
        }
      }
      console.log('Seeded verified compliance vault documents.');
    });

    console.log('\n======================================================');
    console.log('🎉 TEST SUPPLIER CREATED AND SEEDED SUCCESSFULLY!');
    console.log('Email:     ', testEmail);
    console.log('Password:  ', testPasswordPlain);
    console.log('Company:   ', testLegalName);
    console.log('CIPA UIN:  ', testCipa);
    console.log('======================================================\n');
  } catch (err: any) {
    console.error('❌ Error seeding test supplier:', err);
  } finally {
    await pool.end();
  }
}

seedTestSupplier();
