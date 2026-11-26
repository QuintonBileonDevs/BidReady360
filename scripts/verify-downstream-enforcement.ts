import 'dotenv/config';
import http from 'http';
import crypto from 'crypto';
import { app } from '../server/app';
import { query } from '../server/db/client';
import { authService } from '../server/services/auth.service';
import { documentsRepository } from '../server/repositories/documents.repository';
import { ensureSystemRolePermissions } from '../server/db/seed';
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

export async function runDownstreamVerification(): Promise<{ ok: boolean; logs: string[] }> {
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(msg);
    console.log(msg);
  };

  log('=== RUNNING BIDREADY360 DOWNSTREAM ADMIN ENFORCEMENT SUITE ===');

  const ts = Date.now();
  const password = 'DownstreamPass123!';
  const adminEmail = `ds_admin_${ts}@bidready360.gov.bw`;
  const buyerEmail = `ds_buyer_${ts}@council.gov.bw`;
  const supplierEmail = `ds_supplier_${ts}@enterprise.co.bw`;
  const lockUserEmail = `ds_lockuser_${ts}@enterprise.co.bw`;

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3000;
  const baseUrl = `http://127.0.0.1:${port}`;
  log(`Ephemeral test server listening on ${baseUrl}`);

  const createdUserIds: string[] = [];
  let createdOrgId: string | null = null;
  let createdSupplierId: string | null = null;
  let createdCallId: string | null = null;
  let createdDebarmentId: string | null = null;

  try {
    // Ensure system RBAC role_permissions exist for freshly registered tenants
    await ensureSystemRolePermissions();

    // -----------------------------------------------------------------------
    // Setup: Admin, Pending Buyer Org, Unverified Supplier, Lockout Test User
    // -----------------------------------------------------------------------
    const passwordHash = await hashPassword(password);

    const adminRes = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, status, is_platform_admin, email_verified_at)
       VALUES ($1, $2, 'Downstream Verification Admin', 'active', TRUE, NOW())
       RETURNING id`,
      [adminEmail, passwordHash]
    );
    const adminUserId = adminRes.rows[0].id;
    createdUserIds.push(adminUserId);

    const adminLogin = await apiFetch(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: adminEmail, password },
    });
    assert(adminLogin.status === 200 && adminLogin.data.token, 'Admin login should succeed');
    const adminToken = adminLogin.data.token as string;

    const buyerReg = await authService.registerOrganization({
      organizationName: `Downstream Pending Council ${ts}`,
      organizationType: 'local_authority',
      fullName: 'Downstream Buyer Officer',
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
      legalName: `Downstream Supplier (Pty) Ltd ${ts}`,
      cipaUin: `BW-DS-${String(ts).slice(-6)}`,
      fullName: 'Downstream Supplier Director',
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

    const lockUserRes = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, status, is_platform_admin, email_verified_at)
       VALUES ($1, $2, 'Downstream Lockout User', 'active', FALSE, NOW())
       RETURNING id`,
      [lockUserEmail, passwordHash]
    );
    const lockUserId = lockUserRes.rows[0].id;
    createdUserIds.push(lockUserId);

    // -----------------------------------------------------------------------
    // FLOW 1: Buyer Org Status Enforcement & Live Session Activation
    // -----------------------------------------------------------------------
    log('\n[Flow 1] Testing buyer org gatekeeping (pending -> approved -> suspended -> active)...');
    const buyerLogin = await apiFetch(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: buyerEmail, password },
    });
    assert(buyerLogin.status === 200 && buyerLogin.data.token, 'Buyer login should succeed');
    const buyerToken = buyerLogin.data.token as string;
    assert(
      buyerLogin.data.activeTenant?.organizationStatus === 'pending',
      `Expected pending org status in login response, got ${buyerLogin.data.activeTenant?.organizationStatus}`
    );

    const pendingBootstrap = await apiFetch(baseUrl, '/api/bootstrap', { token: buyerToken });
    assert(
      pendingBootstrap.status === 200 && pendingBootstrap.data.profile?.status === 'pending',
      `Pending buyer bootstrap should report status=pending, got ${pendingBootstrap.data.profile?.status}`
    );

    const pendingCreateCall = await apiFetch(baseUrl, '/api/buyer/calls/create', {
      method: 'POST',
      token: buyerToken,
      body: {
        referenceNo: `DS-PEND-${ts}`,
        title: 'Should Be Blocked Pending Call',
        callType: 'rfp',
        summary: 'Blocked while pending',
        description: 'Blocked while pending',
        opensAt: new Date().toISOString(),
        closesAt: new Date(Date.now() + 14 * 86400000).toISOString(),
      },
    });
    assert(
      pendingCreateCall.status === 403 && pendingCreateCall.data.code === 'ORGANIZATION_PENDING_APPROVAL',
      `Pending org createCall should return 403 ORGANIZATION_PENDING_APPROVAL, got ${pendingCreateCall.status} (${pendingCreateCall.data.code})`
    );

    const pendingApps = await apiFetch(baseUrl, '/api/buyer/applications', { token: buyerToken });
    assert(
      pendingApps.status === 403 && pendingApps.data.code === 'ORGANIZATION_PENDING_APPROVAL',
      `Pending org GET /applications should return 403 ORGANIZATION_PENDING_APPROVAL, got ${pendingApps.status}`
    );

    // Admin approves organization
    const approveOrg = await apiFetch(baseUrl, `/api/admin/organizations/${createdOrgId}/approve`, {
      method: 'POST',
      token: adminToken,
    });
    assert(approveOrg.status === 200 && approveOrg.data.status === 'active', 'Admin org approve should succeed');

    // Same active buyer session immediately sees active status and can publish call
    const activeBootstrap = await apiFetch(baseUrl, '/api/bootstrap', { token: buyerToken });
    assert(
      activeBootstrap.status === 200 && activeBootstrap.data.profile?.status === 'active',
      `Approved buyer bootstrap should immediately report status=active, got ${activeBootstrap.data.profile?.status}`
    );

    const activeApps = await apiFetch(baseUrl, '/api/buyer/applications', { token: buyerToken });
    assert(
      activeApps.status === 200 && Array.isArray(activeApps.data),
      `Approved buyer GET /applications should succeed (200 array), got ${activeApps.status}: ${JSON.stringify(activeApps.data)}`
    );

    const createCallRes = await apiFetch(baseUrl, '/api/buyer/calls/create', {
      method: 'POST',
      token: buyerToken,
      body: {
        referenceNo: `DS-RFP-${ts}`,
        title: 'Downstream Enforcement Test Tender',
        callType: 'rfp',
        summary: 'End-to-end enforcement verification tender.',
        description: 'Verifies live admin gates on calls, applications, and sealed bids.',
        opensAt: new Date().toISOString(),
        closesAt: new Date(Date.now() + 14 * 86400000).toISOString(),
        estimatedValue: 500000,
        currency: 'BWP',
        requiredDocTypeCodes: ['TAX_CLEARANCE'],
      },
    });
    assert(createCallRes.status === 201 && createCallRes.data.callId, `Approved org createCall should return 201, got ${createCallRes.status}`);
    createdCallId = createCallRes.data.callId;

    // Suspend org -> verify calls hidden publicly and buyer endpoints blocked
    const suspendOrg = await apiFetch(baseUrl, `/api/admin/organizations/${createdOrgId}/suspend`, {
      method: 'POST',
      token: adminToken,
      body: { reason: 'Temporary procurement compliance audit' },
    });
    assert(suspendOrg.status === 200 && suspendOrg.data.status === 'suspended', 'Admin org suspend should succeed');

    const suspendedCreate = await apiFetch(baseUrl, '/api/buyer/calls/create', {
      method: 'POST',
      token: buyerToken,
      body: {
        referenceNo: `DS-SUSP-${ts}`,
        title: 'Blocked Suspended Org Call',
        callType: 'rfp',
        summary: 'Blocked while suspended',
        description: 'Blocked while suspended',
        opensAt: new Date().toISOString(),
        closesAt: new Date(Date.now() + 14 * 86400000).toISOString(),
      },
    });
    assert(
      suspendedCreate.status === 403 && suspendedCreate.data.code === 'ORGANIZATION_SUSPENDED',
      `Suspended org createCall should return 403 ORGANIZATION_SUSPENDED, got ${suspendedCreate.status} (${suspendedCreate.data.code})`
    );

    const publicCallsWhileSuspended = await apiFetch(baseUrl, '/api/calls');
    assert(
      publicCallsWhileSuspended.status === 200 &&
        !(publicCallsWhileSuspended.data as any[]).some((c) => c.id === createdCallId),
      'Calls from suspended organizations must not appear in public GET /api/calls'
    );

    // Re-approve org for Flow 2
    const reactivateOrg = await apiFetch(baseUrl, `/api/admin/organizations/${createdOrgId}/approve`, {
      method: 'POST',
      token: adminToken,
    });
    assert(reactivateOrg.status === 200 && reactivateOrg.data.status === 'active', 'Admin org re-approval should succeed');
    log('  PASS: Buyer org pending/approved/suspended transitions enforced across tenant bootstrap, public calls, and buyer routes.');

    // -----------------------------------------------------------------------
    // FLOW 2: Supplier Document Rejection/Verification, Debarment & Suspension
    // -----------------------------------------------------------------------
    log('\n[Flow 2] Testing supplier verification, doc rejection readiness, debarment, and suspension...');
    const supLogin = await apiFetch(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: supplierEmail, password },
    });
    assert(supLogin.status === 200 && supLogin.data.token, 'Supplier login should succeed');
    const supplierToken = supLogin.data.token as string;

    // Upload a real TAX_CLEARANCE PDF document version
    const pdfBuf = Buffer.from('%PDF-1.4\n%Downstream verification test document\n%%EOF');
    const uploadedV1 = await documentsRepository.uploadVersion({
      supplierId: createdSupplierId!,
      documentTypeCode: 'TAX_CLEARANCE',
      title: 'BURS Tax Clearance Certificate',
      fileName: 'tax-clearance-v1.pdf',
      mimeType: 'application/pdf',
      fileBuffer: pdfBuf,
      documentNumber: `TCC-${String(ts).slice(-6)}`,
      issueDate: '2026-01-01',
      expiryDate: '2028-12-31',
      userId: supplierUserId,
    });
    assert(uploadedV1.versionId, 'Uploaded document v1 should have a versionId');

    // Unverified supplier must be blocked from sealing bids
    const unverifiedBid = await apiFetch(baseUrl, '/api/supplier/bids/seal', {
      method: 'POST',
      token: supplierToken,
      body: {
        callId: createdCallId,
        financialSchedule: [{ lineNo: 1, description: 'Unverified bid test', quantity: 1, unitPrice: 12000 }],
      },
    });
    assert(
      unverifiedBid.status === 403 && unverifiedBid.data.code === 'SUPPLIER_NOT_VERIFIED',
      `Unverified supplier bid must return 403 SUPPLIER_NOT_VERIFIED, got ${unverifiedBid.status} (${unverifiedBid.data.code})`
    );

    // Admin rejects document v1 -> readiness/bootstrap must reflect rejection and drop completeness
    const rejectDocRes = await apiFetch(baseUrl, `/api/admin/verification/documents/${uploadedV1.versionId}`, {
      method: 'POST',
      token: adminToken,
      body: { status: 'REJECTED', rejectionReason: 'Tax certificate stamp illegible' },
    });
    assert(rejectDocRes.status === 200, `Admin reject document should return 200, got ${rejectDocRes.status}: ${JSON.stringify(rejectDocRes.data)}`);

    const rejectedBootstrap = await apiFetch(baseUrl, '/api/bootstrap', { token: supplierToken });
    const rejectedDocEntry = (rejectedBootstrap.data.documents || []).find((d: any) => d.versionId === uploadedV1.versionId);
    assert(
      rejectedDocEntry && rejectedDocEntry.verificationStatus === 'REJECTED' && rejectedDocEntry.rejectionReason === 'Tax certificate stamp illegible',
      'Bootstrap must return REJECTED verificationStatus and rejectionReason after admin rejection'
    );
    const rejectedTaxItem = (rejectedBootstrap.data.completeness?.items || []).find((i: any) => i.key === 'taxDoc');
    assert(
      rejectedTaxItem && rejectedTaxItem.complete === false && String(rejectedTaxItem.reason || '').includes('Tax certificate stamp illegible'),
      'Completeness check must mark rejected Tax Clearance as incomplete with the admin rejection reason'
    );

    // Application while supplier verification is rejected must be blocked with 403 SUPPLIER_REJECTED
    const rejectedSupApp = await apiFetch(baseUrl, '/api/supplier/applications/submit', {
      method: 'POST',
      token: supplierToken,
      body: {
        callId: createdCallId,
        answers: { notes: 'Trying while rejected' },
        attachedDocumentVersionIds: [uploadedV1.versionId],
      },
    });
    assert(
      rejectedSupApp.status === 403 && rejectedSupApp.data.code === 'SUPPLIER_REJECTED',
      `Application while supplier is rejected must be blocked (403 SUPPLIER_REJECTED), got ${rejectedSupApp.status} (${rejectedSupApp.data.code})`
    );

    // Supplier uploads replacement v2 -> Admin approves it -> Supplier becomes verified
    const uploadedV2 = await documentsRepository.uploadVersion({
      supplierId: createdSupplierId!,
      documentTypeCode: 'TAX_CLEARANCE',
      title: 'BURS Tax Clearance Certificate',
      fileName: 'tax-clearance-v2.pdf',
      mimeType: 'application/pdf',
      fileBuffer: Buffer.from('%PDF-1.4\n%Clean replacement tax certificate\n%%EOF'),
      documentNumber: `TCC-V2-${String(ts).slice(-6)}`,
      issueDate: '2026-02-01',
      expiryDate: '2028-12-31',
      userId: supplierUserId,
    });

    const approveDocRes = await apiFetch(baseUrl, `/api/admin/verification/documents/${uploadedV2.versionId}`, {
      method: 'POST',
      token: adminToken,
      body: { status: 'VERIFIED', notes: 'Verified directly against BURS ledger' },
    });
    assert(approveDocRes.status === 200, `Admin approve document should return 200, got ${approveDocRes.status}: ${JSON.stringify(approveDocRes.data)}`);

    const verifiedBootstrap = await apiFetch(baseUrl, '/api/bootstrap', { token: supplierToken });
    const verifiedTaxItem = (verifiedBootstrap.data.completeness?.items || []).find((i: any) => i.key === 'taxDoc');
    assert(
      verifiedTaxItem && verifiedTaxItem.complete === true && verifiedTaxItem.unverified === false,
      'Completeness check must mark approved Tax Clearance as complete and verified'
    );
    assert(
      verifiedBootstrap.data.profile?.verificationStatus === 'verified',
      `Supplier verificationStatus should be 'verified', got ${verifiedBootstrap.data.profile?.verificationStatus}`
    );

    // Even when supplier is verified, attempting to attach the rejected v1 document version must be blocked
    const staleRejectedDocApp = await apiFetch(baseUrl, '/api/supplier/applications/submit', {
      method: 'POST',
      token: supplierToken,
      body: {
        callId: createdCallId,
        answers: { notes: 'Trying with rejected doc version' },
        attachedDocumentVersionIds: [uploadedV1.versionId],
      },
    });
    assert(
      staleRejectedDocApp.status === 400 && staleRejectedDocApp.data.code === 'MANDATORY_DOCUMENT_MISSING',
      `Application attaching rejected doc version must be blocked (400 MANDATORY_DOCUMENT_MISSING), got ${staleRejectedDocApp.status} (${staleRejectedDocApp.data.code})`
    );

    // Active compliant verified supplier can submit application and seal bid
    const validApp = await apiFetch(baseUrl, '/api/supplier/applications/submit', {
      method: 'POST',
      token: supplierToken,
      body: {
        callId: createdCallId,
        answers: { notes: 'Compliant submission' },
        attachedDocumentVersionIds: [uploadedV2.versionId],
      },
    });
    assert(validApp.status === 201 && validApp.data.receiptNumber, `Compliant application should return 201, got ${validApp.status}: ${JSON.stringify(validApp.data)}`);

    const validBid = await apiFetch(baseUrl, '/api/supplier/bids/seal', {
      method: 'POST',
      token: supplierToken,
      body: {
        callId: createdCallId,
        financialSchedule: [{ lineNo: 1, description: 'Compliant bid item', quantity: 2, unitPrice: 25000 }],
      },
    });
    assert(validBid.status === 201 && validBid.data.sealedHash, `Compliant verified supplier bid should return 201, got ${validBid.status}`);

    // Admin debars supplier -> both bid & application blocked with 403 SUPPLIER_DEBARRED
    const debarRes = await apiFetch(baseUrl, '/api/admin/debarments', {
      method: 'POST',
      token: adminToken,
      body: {
        supplierId: createdSupplierId,
        reason: 'Collusive tendering investigation',
        startsOn: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
        endsOn: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      },
    });
    assert(debarRes.status === 201 && debarRes.data.id, 'Admin debarment creation should return 201');
    createdDebarmentId = debarRes.data.id;

    const debarredBootstrap = await apiFetch(baseUrl, '/api/bootstrap', { token: supplierToken });
    assert(
      debarredBootstrap.data.profile?.activeDebarment?.id === createdDebarmentId,
      'Bootstrap must surface activeDebarment for debarred supplier'
    );

    const debarredBid = await apiFetch(baseUrl, '/api/supplier/bids/seal', {
      method: 'POST',
      token: supplierToken,
      body: {
        callId: createdCallId,
        financialSchedule: [{ lineNo: 1, description: 'Blocked debarred bid', quantity: 1, unitPrice: 10000 }],
      },
    });
    assert(
      debarredBid.status === 403 && debarredBid.data.code === 'SUPPLIER_DEBARRED',
      `Debarred supplier bid must return 403 SUPPLIER_DEBARRED, got ${debarredBid.status} (${debarredBid.data.code})`
    );

    const debarredApp = await apiFetch(baseUrl, '/api/supplier/applications/submit', {
      method: 'POST',
      token: supplierToken,
      body: {
        callId: createdCallId,
        answers: { notes: 'Blocked debarred app' },
        attachedDocumentVersionIds: [uploadedV2.versionId],
      },
    });
    assert(
      debarredApp.status === 403 && debarredApp.data.code === 'SUPPLIER_DEBARRED',
      `Debarred supplier application must return 403 SUPPLIER_DEBARRED, got ${debarredApp.status} (${debarredApp.data.code})`
    );

    // Lift debarment, then suspend supplier -> both blocked with 403 SUPPLIER_SUSPENDED
    const liftRes = await apiFetch(baseUrl, `/api/admin/debarments/${createdDebarmentId}/lift`, {
      method: 'POST',
      token: adminToken,
      body: { reason: 'Audit cleared' },
    });
    assert(liftRes.status === 200, 'Admin lift debarment should return 200');

    const suspendSup = await apiFetch(baseUrl, `/api/admin/suppliers/${createdSupplierId}/verification`, {
      method: 'POST',
      token: adminToken,
      body: { verificationStatus: 'verified', status: 'suspended' },
    });
    assert(suspendSup.status === 200 && suspendSup.data.status === 'suspended', `Admin suspend supplier should return 200, got ${suspendSup.status}: ${JSON.stringify(suspendSup.data)}`);

    const suspendedBid = await apiFetch(baseUrl, '/api/supplier/bids/seal', {
      method: 'POST',
      token: supplierToken,
      body: {
        callId: createdCallId,
        financialSchedule: [{ lineNo: 1, description: 'Blocked suspended bid', quantity: 1, unitPrice: 10000 }],
      },
    });
    assert(
      suspendedBid.status === 403 && suspendedBid.data.code === 'SUPPLIER_SUSPENDED',
      `Suspended supplier bid must return 403 SUPPLIER_SUSPENDED, got ${suspendedBid.status} (${suspendedBid.data.code})`
    );

    // Reactivate supplier -> bid succeeds again
    const reactivateSup = await apiFetch(baseUrl, `/api/admin/suppliers/${createdSupplierId}/verification`, {
      method: 'POST',
      token: adminToken,
      body: { verificationStatus: 'verified', status: 'active' },
    });
    assert(reactivateSup.status === 200 && reactivateSup.data.status === 'active', `Admin reactivate supplier should return 200, got ${reactivateSup.status}: ${JSON.stringify(reactivateSup.data)}`);

    const restoredBid = await apiFetch(baseUrl, '/api/supplier/bids/seal', {
      method: 'POST',
      token: supplierToken,
      body: {
        callId: createdCallId,
        financialSchedule: [{ lineNo: 1, description: 'Restored active bid', quantity: 2, unitPrice: 24000 }],
      },
    });
    assert(restoredBid.status === 201, `Reactivated compliant supplier bid should succeed (201), got ${restoredBid.status}`);
    log('  PASS: Supplier verification, document rejection readiness, debarment, and suspension all strictly enforced server-side.');

    // -----------------------------------------------------------------------
    // FLOW 3: Account Lockout & Admin Unlock Recovery
    // -----------------------------------------------------------------------
    log('\n[Flow 3] Testing 5 failed logins -> account lockout (423) -> admin unlock -> immediate clean login...');
    for (let attempt = 1; attempt <= 4; attempt++) {
      const failRes = await apiFetch(baseUrl, '/api/auth/login', {
        method: 'POST',
        body: { email: lockUserEmail, password: 'WrongPassword999!' },
      });
      assert(
        failRes.status === 401,
        `Failed attempt ${attempt}/5 should return 401, got ${failRes.status}`
      );
    }

    const fifthFail = await apiFetch(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: lockUserEmail, password: 'WrongPassword999!' },
    });
    assert(
      fifthFail.status === 423 && fifthFail.data.code === 'ACCOUNT_LOCKED',
      `5th failed attempt must lock account with 423 ACCOUNT_LOCKED, got ${fifthFail.status} (${fifthFail.data.code})`
    );

    // Even with the CORRECT password, locked user must be rejected with 423 ACCOUNT_LOCKED
    const blockedValidLogin = await apiFetch(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: lockUserEmail, password },
    });
    assert(
      blockedValidLogin.status === 423 && blockedValidLogin.data.code === 'ACCOUNT_LOCKED',
      `Locked user with correct password must still be blocked (423 ACCOUNT_LOCKED), got ${blockedValidLogin.status}`
    );

    // Admin unlocks user
    const unlockRes = await apiFetch(baseUrl, `/api/admin/users/${lockUserId}/unlock`, {
      method: 'POST',
      token: adminToken,
    });
    assert(
      unlockRes.status === 200 && unlockRes.data.isLocked === false && unlockRes.data.failedLoginAttempts === 0,
      `Admin unlock should clear lockout and failedLoginAttempts, got ${unlockRes.status}`
    );

    // Unlocked user can immediately authenticate cleanly
    const cleanLogin = await apiFetch(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: lockUserEmail, password },
    });
    assert(
      cleanLogin.status === 200 && cleanLogin.data.token,
      `Unlocked user should log in cleanly (200), got ${cleanLogin.status} (${cleanLogin.data.message || cleanLogin.data.error})`
    );
    log('  PASS: Account lockout (423), admin unlock, and immediate clean re-authentication verified.');

    log('\n=== ALL 3 DOWNSTREAM ENFORCEMENT FLOWS PASSED 100% ===');
    return { ok: true, logs };
  } finally {
    log('\n[Cleanup] Removing temporary verification records...');
    try {
      await query(`DELETE FROM login_attempts WHERE LOWER(email_norm) = ANY($1::text[])`, [
        [adminEmail, buyerEmail, supplierEmail, lockUserEmail].map((e) => e.toLowerCase()),
      ]).catch(() => {});
      if (createdDebarmentId) {
        await query(`DELETE FROM debarments WHERE id = $1`, [createdDebarmentId]).catch(() => {});
      }
      if (createdCallId) {
        await query(`DELETE FROM bid_sealing_receipts WHERE bid_id IN (SELECT id FROM bids WHERE call_id = $1)`, [createdCallId]).catch(() => {});
        await query(`DELETE FROM bid_price_items WHERE bid_id IN (SELECT id FROM bids WHERE call_id = $1)`, [createdCallId]).catch(() => {});
        await query(`DELETE FROM bids WHERE call_id = $1`, [createdCallId]).catch(() => {});
        await query(`DELETE FROM application_documents WHERE application_id IN (SELECT id FROM applications WHERE call_id = $1)`, [createdCallId]).catch(() => {});
        await query(`DELETE FROM application_timeline WHERE application_id IN (SELECT id FROM applications WHERE call_id = $1)`, [createdCallId]).catch(() => {});
        await query(`DELETE FROM applications WHERE call_id = $1`, [createdCallId]).catch(() => {});
        await query(`DELETE FROM call_required_documents WHERE call_id = $1`, [createdCallId]).catch(() => {});
        await query(`DELETE FROM calls WHERE id = $1`, [createdCallId]).catch(() => {});
      }
      if (createdSupplierId) {
        await query(`DELETE FROM document_files WHERE document_version_id IN (SELECT id FROM supplier_document_versions WHERE document_id IN (SELECT id FROM supplier_documents WHERE supplier_id = $1))`, [createdSupplierId]).catch(() => {});
        await query(`UPDATE supplier_documents SET current_version_id = NULL WHERE supplier_id = $1`, [createdSupplierId]).catch(() => {});
        await query(`DELETE FROM supplier_document_versions WHERE document_id IN (SELECT id FROM supplier_documents WHERE supplier_id = $1)`, [createdSupplierId]).catch(() => {});
        await query(`DELETE FROM supplier_documents WHERE supplier_id = $1`, [createdSupplierId]).catch(() => {});
        await query(`DELETE FROM supplier_members WHERE supplier_id = $1`, [createdSupplierId]).catch(() => {});
        await query(`DELETE FROM suppliers WHERE id = $1`, [createdSupplierId]).catch(() => {});
      }
      if (createdOrgId) {
        await query(`DELETE FROM organization_members WHERE organization_id = $1`, [createdOrgId]).catch(() => {});
        await query(`DELETE FROM organizations WHERE id = $1`, [createdOrgId]).catch(() => {});
      }
      if (createdUserIds.length > 0) {
        await query(`DELETE FROM audit_log WHERE actor_user_id = ANY($1::uuid[])`, [createdUserIds]).catch(() => {});
        await query(`DELETE FROM sessions WHERE user_id = ANY($1::uuid[])`, [createdUserIds]).catch(() => {});
        await query(`DELETE FROM user_verification_tokens WHERE user_id = ANY($1::uuid[])`, [createdUserIds]).catch(() => {});
        await query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [createdUserIds]).catch(() => {});
      }
    } catch (cleanErr: any) {
      log(`[Cleanup warning] ${cleanErr?.message || cleanErr}`);
    }
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  process.argv[1].endsWith('verify-downstream-enforcement.ts');

if (isDirectRun) {
  runDownstreamVerification()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\nDOWNSTREAM VERIFICATION FAILED:', err);
      process.exit(1);
    });
}
