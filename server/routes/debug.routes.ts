import { Router, Request, Response } from 'express';
import { query } from '../db/client';
import { requireAuth } from '../middleware/auth.middleware';
import { usersRepository } from '../repositories/users.repository';

const router = Router();

// GET /api/debug/bootstrap-trace
// Dev-only endpoint returning raw trace data for active session, memberships, chosen tenant, and raw DB row
router.get('/bootstrap-trace', requireAuth, async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Debug endpoint is disabled in production.' });
    return;
  }

  try {
    const user = req.user!;
    const session = req.session!;

    // 1. Fetch all memberships for this user
    const membershipsRes = await query<{
      supplierId: string;
      legalName: string;
      isOwner: boolean;
      status: string;
      profileCompleteness: number;
      complianceStatus: string;
      cipaUin: string;
      createdAt: string;
    }>(
      `SELECT sm.supplier_id AS "supplierId",
              s.legal_name AS "legalName",
              sm.is_owner AS "isOwner",
              sm.status,
              s.profile_completeness AS "profileCompleteness",
              s.compliance_status AS "complianceStatus",
              s.cipa_uin AS "cipaUin",
              s.created_at AS "createdAt"
       FROM supplier_members sm
       JOIN suppliers s ON s.id = sm.supplier_id AND s.deleted_at IS NULL
       WHERE sm.user_id = $1 AND sm.status = 'active'`,
      [user.id]
    );

    const memberships = membershipsRes.rows;

    // 2. Trace how activeTenant was or would be chosen
    let chosenSupplierId: string | null = null;
    let ruleFired = '';

    if (session.tenantType === 'supplier' && session.tenantId) {
      const match = memberships.find((m) => m.supplierId === session.tenantId);
      if (match) {
        chosenSupplierId = match.supplierId;
        ruleFired = 'RULE 1: Matched session.tenant_id with active supplier membership';
      } else {
        ruleFired = 'RULE 1 FAILED: session.tenant_id is not in active supplier memberships';
      }
    }

    if (!chosenSupplierId && memberships.length > 0) {
      // Deterministic fallback: Owner first, then oldest
      const owners = memberships.filter((m) => m.isOwner);
      if (owners.length > 0) {
        chosenSupplierId = owners[0].supplierId;
        ruleFired = 'RULE 2 FALLBACK: Preferred supplier membership with is_owner = true';
      } else {
        chosenSupplierId = memberships[0].supplierId;
        ruleFired = 'RULE 3 FALLBACK: Defaulted to first available membership';
      }
    }

    if (!chosenSupplierId) {
      ruleFired = 'NO_SUPPLIER_FOUND: User has no active supplier memberships';
    }

    // 3. Fetch the raw unmapped database row for the chosen supplier
    let rawSupplierRow: any = null;
    let rawPeople: any[] = [];
    let rawDocuments: any[] = [];

    if (chosenSupplierId) {
      const supRes = await query('SELECT * FROM suppliers WHERE id = $1', [chosenSupplierId]);
      rawSupplierRow = supRes.rows[0] || null;

      const peopleRes = await query('SELECT * FROM supplier_people WHERE supplier_id = $1', [chosenSupplierId]);
      rawPeople = peopleRes.rows;

      const docsRes = await query(
        `SELECT sd.*, dt.code AS doc_type_code, dt.name AS doc_type_name,
                sdv.version_no, sdv.expiry_date, sdv.verification_status, sdv.file_name
         FROM supplier_documents sd
         JOIN document_types dt ON dt.id = sd.document_type_id
         LEFT JOIN supplier_document_versions sdv ON sdv.id = sd.current_version_id
         WHERE sd.supplier_id = $1`,
        [chosenSupplierId]
      );
      rawDocuments = docsRes.rows;
    }

    res.json({
      sessionId: session.id,
      sessionTenantType: session.tenantType,
      sessionTenantId: session.tenantId,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      memberships,
      chosenSupplierId,
      ruleFired,
      queriesExecutedWithSupplierId: chosenSupplierId,
      rawSupplierRow,
      rawPeople,
      rawDocuments,
    });
  } catch (err: any) {
    console.error('[DEBUG BOOTSTRAP-TRACE ERROR]:', err);
    res.status(500).json({ error: 'TRACE_FAILED', message: err.message });
  }
});

export const debugRouter = router;
