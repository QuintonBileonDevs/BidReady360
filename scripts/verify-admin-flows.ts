import 'dotenv/config';
import http from 'http';
import crypto from 'crypto';
import { app } from '../server/app';
import { query } from '../server/db/client';
import { authService } from '../server/services/auth.service';
import { bidsRepository } from '../server/repositories/bids.repository';
import { hashPassword } from '../server/utils/crypto';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function apiFetch(
  baseUrl: string,
  path: string,
  options: { method?: string; token?: string; body?: any } = {}
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, data: json };
}

export async function runAdminTests(): Promise<{ ok: boolean; logs: string[] }> {
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(msg);
    console.log(msg);
  };

  log('=== RUNNING BIDREADY360 ADMIN MODULE VERIFICATION SUITE ===');

  const ts = Date.now();
  const password = 'AdminVerifyPass123!';
  const adminEmail = `verify_admin_${ts}@bidready360.gov.bw`;
  const buyerEmail = `verify_buyer_${ts}@example.co.bw`;
  const supplierEmail = `verify_sup_${ts}@example.co.bw`;

  // Start ephemeral HTTP server wrapping real Express app
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3000;
  const baseUrl = `http://127.0.0.1:${port}`;
  log(`Test server listening on ${baseUrl}`);

  const createdUserIds: string[] = [];
  let createdOrgId: string | null = null;
  let createdSupplierId: string | null = null;
  let createdCallId: string | null = null;
  let createdDocId: string | null = null;
  let createdDebarmentId: string | null = null;

  try {
    // -----------------------------------------------------------------------
    // Setup: Create temporary platform admin, buyer org, and supplier
    // -----------------------------------------------------------------------
    const passwordHash = await hashPassword(password);
    const adminRes = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, status, is_platform_admin, email_verified_at)
       VALUES ($1, $2, 'Verification Super Admin', 'active', TRUE, NOW())
       RETURNING id`,
      [adminEmail, passwordHash]
    );
    const adminUserId = adminRes.rows[0].id;
    createdUserIds.push(adminUserId);

    const buyerReg = await authService.registerOrganization({
      organizationName: `Verify Pending Ministry ${ts}`,
      organizationType: 'ministry',
      fullName: 'Verify Buyer Officer',
      email: buyerEmail,
      password,
      ip: '127.0.0.1',
    });
    if (buyerReg.verificationToken) {
      await authService.verifyEmailWithToken(buyerReg.verificationToken, '127.0.0.1');
    }
    const buyerRow = await query<{ userId: string; orgId: string }>(
      `SELECT u.id AS "userId", om.organization_id AS "orgId"
       FROM users u
       JOIN organization_members om ON om.user_id = u.id
       WHERE u.email = $1 LIMIT 1`,
      [buyerEmail]
    );
    const buyerUserId = buyerRow.rows[0].userId;
    createdOrgId = buyerRow.rows[0].orgId;
    createdUserIds.push(buyerUserId);

    const supReg = await authService.registerSupplier({
      legalName: `Verify Supplier Ltd ${ts}`,
      cipaUin: `BW-ADM-${String(ts).slice(-6)}`,
      fullName: 'Verify Supplier Director',
      email: supplierEmail,
      password,
      ip: '127.0.0.1',
    });
    if (supReg.verificationToken) {
      await authService.verifyEmailWithToken(supReg.verificationToken, '127.0.0.1');
    }
    const supRow = await query<{ userId: string; supplierId: string }>(
      `SELECT u.id AS "userId", sm.supplier_id AS "supplierId"
       FROM users u
       JOIN supplier_members sm ON sm.user_id = u.id
       WHERE u.email = $1 LIMIT 1`,
      [supplierEmail]
    );
    const supplierUserId = supRow.rows[0].userId;
    createdSupplierId = supRow.rows[0].supplierId;
    createdUserIds.push(supplierUserId);

    // -----------------------------------------------------------------------
    // TEST 1: Admin login & unauthorized access rejection (401 / 403)
    // -----------------------------------------------------------------------
    log('1. Testing Admin login and RBAC rejection of non-admin tokens...');
    const unauthRes = await apiFetch(baseUrl, '/api/admin/overview');
    assert(unauthRes.status === 401, `Expected 401 for unauthenticated /api/admin/overview, got ${unauthRes.status}`);

    const adminLogin = await apiFetch(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: adminEmail, password },
    });
    assert(adminLogin.status === 200 && adminLogin.data.token, 'Admin login should succeed with token');
    const adminToken: string = adminLogin.data.token;

    const buyerLogin = await apiFetch(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: buyerEmail, password },
    });
    assert(buyerLogin.status === 200 && buyerLogin.data.token, 'Buyer login should succeed');
    const buyerToken: string = buyerLogin.data.token;

    const supplierLogin = await apiFetch(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: supplierEmail, password },
    });
    assert(supplierLogin.status === 200 && supplierLogin.data.token, 'Supplier login should succeed');
    const supplierToken: string = supplierLogin.data.token;

    const buyerBlocked = await apiFetch(baseUrl, '/api/admin/overview', { token: buyerToken });
    assert(buyerBlocked.status === 403, `Expected 403 for buyer token on /api/admin/overview, got ${buyerBlocked.status}`);

    const supBlocked = await apiFetch(baseUrl, '/api/admin/overview', { token: supplierToken });
    assert(supBlocked.status === 403, `Expected 403 for supplier token on /api/admin/overview, got ${supBlocked.status}`);

    const overviewRes = await apiFetch(baseUrl, '/api/admin/overview', { token: adminToken });
    assert(overviewRes.status === 200 && overviewRes.data.kpis, 'Admin should receive 200 KPI overview');
    log('   PASS: Unauthenticated (401), Buyer (403), Supplier (403) blocked; Platform Admin (200) succeeded.');

    // -----------------------------------------------------------------------
    // TEST 2: Approve pending buyer organization & verify DB update
    // -----------------------------------------------------------------------
    log('2. Testing pending buyer organization approval...');
    const orgBefore = await query<{ status: string; verification_status: string }>(
      `SELECT status, verification_status FROM organizations WHERE id = $1`,
      [createdOrgId]
    );
    assert(orgBefore.rows[0]?.status === 'pending', 'New buyer org should start pending');

    const approveOrgRes = await apiFetch(baseUrl, `/api/admin/organizations/${createdOrgId}/approve`, {
      method: 'POST',
      token: adminToken,
    });
    assert(approveOrgRes.status === 200, `Org approval failed with ${approveOrgRes.status}`);

    const orgAfter = await query<{ status: string; verification_status: string; approved_at: string | null }>(
      `SELECT status, verification_status, approved_at FROM organizations WHERE id = $1`,
      [createdOrgId]
    );
    assert(
      orgAfter.rows[0]?.status === 'active' &&
        orgAfter.rows[0]?.verification_status === 'verified' &&
        Boolean(orgAfter.rows[0]?.approved_at),
      'Approved buyer org must be active & verified in DB'
    );
    log('   PASS: Buyer organization transitioned to status=active, verification_status=verified in DB.');

    // -----------------------------------------------------------------------
    // TEST 3: Reject & approve supplier vault document and verify supplier status
    // -----------------------------------------------------------------------
    log('3. Testing supplier vault document rejection & approval...');
    const dtRes = await query<{ id: string }>(`SELECT id FROM document_types LIMIT 1`);
    assert(dtRes.rows.length > 0, 'At least one document_type must exist in DB');
    const docTypeId = dtRes.rows[0].id;

    const docIns = await query<{ id: string }>(
      `INSERT INTO supplier_documents (supplier_id, document_type_id, title, status)
       VALUES ($1, $2, 'Verify BURS Tax Clearance', 'active')
       RETURNING id`,
      [createdSupplierId, docTypeId]
    );
    createdDocId = docIns.rows[0].id;

    const verIns = await query<{ id: string }>(
      `INSERT INTO supplier_document_versions (
         document_id, version_no, storage_key, file_name, mime_type, file_size_bytes,
         sha256, document_number, verification_status, uploaded_by_user_id
       )
       VALUES ($1, 1, 'verify/test.pdf', 'tax-clearance.pdf', 'application/pdf', 1024, $2, 'TCC-VERIFY-001', 'PENDING_VERIFICATION', $3)
       RETURNING id`,
      [createdDocId, crypto.createHash('sha256').update(`test-${ts}`).digest('hex'), supplierUserId]
    );
    const versionId = verIns.rows[0].id;
    await query(`UPDATE supplier_documents SET current_version_id = $1 WHERE id = $2`, [versionId, createdDocId]);

    // 3a. Reject document
    const rejectDocRes = await apiFetch(baseUrl, `/api/admin/verification/documents/${versionId}`, {
      method: 'POST',
      token: adminToken,
      body: { status: 'REJECTED', rejectionReason: 'Illegible scan for verification test' },
    });
    assert(rejectDocRes.status === 200, `Document reject failed: ${rejectDocRes.status} ${JSON.stringify(rejectDocRes.data)}`);

    const supAfterReject = await query<{ verification_status: string }>(
      `SELECT verification_status FROM suppliers WHERE id = $1`,
      [createdSupplierId]
    );
    assert(
      supAfterReject.rows[0]?.verification_status === 'rejected',
      `Supplier should reflect rejected status after document rejection, got ${supAfterReject.rows[0]?.verification_status}`
    );

    // 3b. Approve document
    const approveDocRes = await apiFetch(baseUrl, `/api/admin/verification/documents/${versionId}`, {
      method: 'POST',
      token: adminToken,
      body: { status: 'VERIFIED', notes: 'Validated against registry' },
    });
    assert(approveDocRes.status === 200, `Document approve failed: ${approveDocRes.status} ${JSON.stringify(approveDocRes.data)}`);

    const [verAfter, supAfterApprove] = await Promise.all([
      query<{ verification_status: string }>(`SELECT verification_status FROM supplier_document_versions WHERE id = $1`, [versionId]),
      query<{ verification_status: string; compliance_status: string; profile_completeness: number }>(
        `SELECT verification_status, compliance_status, profile_completeness FROM suppliers WHERE id = $1`,
        [createdSupplierId]
      ),
    ]);
    assert(verAfter.rows[0]?.verification_status === 'VERIFIED', 'Document version should be VERIFIED in DB');
    assert(
      supAfterApprove.rows[0]?.verification_status === 'verified' &&
        Boolean(supAfterApprove.rows[0]?.compliance_status),
      `Supplier verification_status should update to verified, got ${JSON.stringify(supAfterApprove.rows[0])}`
    );
    log(
      `   PASS: Document reject & approve persisted; supplier verification_status=verified, compliance_status="${supAfterApprove.rows[0]?.compliance_status}", completeness=${supAfterApprove.rows[0]?.profile_completeness}%.`
    );

    // -----------------------------------------------------------------------
    // TEST 4: Debar supplier -> confirm bidsRepository blocks bidding -> lift debarment
    // -----------------------------------------------------------------------
    log('4. Testing supplier debarment, bid blocking, and lifting debarment...');
    const callIns = await query<{ id: string }>(
      `INSERT INTO calls (
         organization_id, reference_no, title, call_type, status,
         published_at, closes_at, currency, created_by_user_id
       )
       VALUES ($1, $2, 'Verify Debarment Test Tender', 'rfp', 'open', NOW(), NOW() + INTERVAL '7 days', 'BWP', $3)
       RETURNING id`,
      [createdOrgId, `VERIFY-CALL-${ts}`, buyerUserId]
    );
    createdCallId = callIns.rows[0].id;

    const debarRes = await apiFetch(baseUrl, '/api/admin/debarments', {
      method: 'POST',
      token: adminToken,
      body: {
        supplierId: createdSupplierId,
        reason: 'Automated verification test debarment order',
        startsOn: new Date().toISOString().slice(0, 10),
        endsOn: null,
        evidenceRef: `VERIFY-DEB-${ts}`,
      },
    });
    assert(debarRes.status === 201 && debarRes.data.id, `Debarment creation failed: ${debarRes.status}`);
    createdDebarmentId = debarRes.data.id;

    // Confirm bidsRepository.sealAndSubmitBid rejects debarred supplier
    let repoBlocked = false;
    try {
      await bidsRepository.sealAndSubmitBid({
        callId: createdCallId,
        supplierId: createdSupplierId,
        userId: supplierUserId,
        financialSchedule: [{ lineNo: 1, description: 'Test Item', quantity: 1, unitPrice: 1000 }],
        actorName: 'Verify Supplier Director',
        actorRole: 'Supplier Admin',
        ipAddress: '127.0.0.1',
      });
    } catch (err: any) {
      if (err.code === 'SUPPLIER_DEBARRED' && err.status === 403) {
        repoBlocked = true;
      } else {
        throw err;
      }
    }
    assert(repoBlocked, 'bidsRepository.sealAndSubmitBid must reject debarred supplier with SUPPLIER_DEBARRED (403)');

    // Confirm HTTP /api/supplier/bids/seal returns 403
    const httpBidBlocked = await apiFetch(baseUrl, '/api/supplier/bids/seal', {
      method: 'POST',
      token: supplierToken,
      body: {
        callId: createdCallId,
        financialSchedule: [{ lineNo: 1, description: 'Test Item', quantity: 1, unitPrice: 1000 }],
      },
    });
    assert(
      httpBidBlocked.status === 403 && httpBidBlocked.data.error === 'SUPPLIER_DEBARRED',
      `Expected HTTP 403 SUPPLIER_DEBARRED, got ${httpBidBlocked.status}`
    );

    // Lift debarment
    const liftRes = await apiFetch(baseUrl, `/api/admin/debarments/${createdDebarmentId}/lift`, {
      method: 'POST',
      token: adminToken,
      body: { reason: 'Verification test completed' },
    });
    assert(liftRes.status === 200 && liftRes.data.liftedAt, 'Lifting debarment should set liftedAt');

    // Confirm bid submission now succeeds after debarment is lifted
    const bidAfterLift = await bidsRepository.sealAndSubmitBid({
      callId: createdCallId,
      supplierId: createdSupplierId,
      userId: supplierUserId,
      financialSchedule: [{ lineNo: 1, description: 'Test Item', quantity: 1, unitPrice: 1000 }],
      actorName: 'Verify Supplier Director',
      actorRole: 'Supplier Admin',
      ipAddress: '127.0.0.1',
    });
    assert(Boolean(bidAfterLift.bidId && bidAfterLift.receiptNumber), 'Bid should succeed once debarment is lifted');
    log('   PASS: Debarred supplier blocked (403 SUPPLIER_DEBARRED); after lift, sealed bid succeeded.');

    // -----------------------------------------------------------------------
    // TEST 5: Unlock locked user account & verify audit log entries
    // -----------------------------------------------------------------------
    log('5. Testing locked account unlock and audit log trail...');
    await query(
      `UPDATE users SET failed_login_attempts = 6, locked_until = NOW() + INTERVAL '1 hour' WHERE id = $1`,
      [buyerUserId]
    );

    const unlockRes = await apiFetch(baseUrl, `/api/admin/users/${buyerUserId}/unlock`, {
      method: 'POST',
      token: adminToken,
    });
    assert(unlockRes.status === 200 && unlockRes.data.isLocked === false, 'Unlock endpoint should return 200');

    const userAfterUnlock = await query<{ failed_login_attempts: number; locked_until: string | null }>(
      `SELECT failed_login_attempts, locked_until FROM users WHERE id = $1`,
      [buyerUserId]
    );
    assert(
      userAfterUnlock.rows[0]?.failed_login_attempts === 0 && userAfterUnlock.rows[0]?.locked_until === null,
      'Unlocked user must have failed_login_attempts=0 and locked_until=NULL in DB'
    );

    const auditRes = await apiFetch(baseUrl, `/api/admin/audit-log?actor=${encodeURIComponent(adminEmail)}&limit=50`, {
      token: adminToken,
    });
    assert(auditRes.status === 200 && Array.isArray(auditRes.data), 'Audit log endpoint should return array');

    const recordedActions = new Set<string>(auditRes.data.map((e: any) => e.action));
    const expectedActions = [
      'ADMIN_APPROVED_ORGANIZATION',
      'ADMIN_UPDATED_DOCUMENT_VERIFICATION',
      'ADMIN_VERIFIED_DOCUMENT',
      'ADMIN_APPLIED_DEBARMENT',
      'ADMIN_LIFTED_DEBARMENT',
      'ADMIN_UNLOCKED_USER',
    ];
    for (const act of expectedActions) {
      assert(recordedActions.has(act), `Missing expected audit_log entry for action: ${act}`);
    }
    log('   PASS: Locked user unlocked and all 6 admin audit events verified in audit_log.');

    log('=== ALL ADMIN MODULE VERIFICATIONS PASSED SUCCESSFULLY ===');
    return { ok: true, logs };
  } finally {
    // Cleanup temporary test records
    try {
      if (createdCallId) {
        await query(`DELETE FROM bid_price_items WHERE bid_id IN (SELECT id FROM bids WHERE call_id = $1)`, [createdCallId]);
        await query(`DELETE FROM bids WHERE call_id = $1`, [createdCallId]);
        await query(`DELETE FROM calls WHERE id = $1`, [createdCallId]);
      }
      if (createdDebarmentId) {
        await query(`DELETE FROM debarments WHERE id = $1`, [createdDebarmentId]);
      }
      if (createdDocId) {
        await query(`UPDATE supplier_documents SET current_version_id = NULL WHERE id = $1`, [createdDocId]);
        await query(`DELETE FROM supplier_document_versions WHERE document_id = $1`, [createdDocId]);
        await query(`DELETE FROM supplier_documents WHERE id = $1`, [createdDocId]);
      }
      if (createdSupplierId) {
        await query(`DELETE FROM supplier_members WHERE supplier_id = $1`, [createdSupplierId]);
        await query(`DELETE FROM suppliers WHERE id = $1`, [createdSupplierId]);
      }
      if (createdOrgId) {
        await query(`DELETE FROM organization_members WHERE organization_id = $1`, [createdOrgId]);
        await query(`DELETE FROM organizations WHERE id = $1`, [createdOrgId]);
      }
      if (createdUserIds.length > 0) {
        await query(`DELETE FROM audit_log WHERE actor_user_id = ANY($1::uuid[])`, [createdUserIds]);
        await query(`DELETE FROM auth_tokens WHERE user_id = ANY($1::uuid[])`, [createdUserIds]);
        await query(`DELETE FROM sessions WHERE user_id = ANY($1::uuid[])`, [createdUserIds]);
        await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [createdUserIds]);
      }
      // Clean up any partial-run test artifacts by unique verification prefix
      await query(`DELETE FROM organizations WHERE contact_email LIKE 'verify_buyer_%@example.co.bw'`);
      await query(`DELETE FROM suppliers WHERE email LIKE 'verify_sup_%@example.co.bw'`);
      await query(
        `DELETE FROM users WHERE email::text LIKE 'verify_admin_%@bidready360.gov.bw'
            OR email::text LIKE 'verify_buyer_%@example.co.bw'
            OR email::text LIKE 'verify_sup_%@example.co.bw'`
      );
    } catch (cleanupErr: any) {
      console.warn('[CLEANUP WARNING]:', cleanupErr?.message || cleanupErr);
    }

    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const isDirectRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  Boolean(process.argv[1]?.endsWith('verify-admin-flows.ts'));

if (isDirectRun) {
  runAdminTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\nADMIN VERIFICATION FAILED:', err?.message || err);
      process.exit(1);
    });
}
