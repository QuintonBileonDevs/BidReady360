import { query, tx } from '../db/client';
import { auditRepository } from './audit.repository';
import { notificationsRepository } from './notifications.repository';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface OpenCallView {
  id: string;
  referenceNo: string;
  title: string;
  callType: string;
  summary: string | null;
  description: string | null;
  status: string;
  visibility: string;
  opensAt: string | null;
  clarificationDeadline: string | null;
  closesAt: string | null;
  estimatedValue: string | null;
  currency: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  orgBrandPrimaryColor?: string;
  orgBrandSubtext?: string;
  orgCustomDomain?: string;
  orgWelcomeNotice?: string;
  daysRemaining: number | null;
  categories: { id: string; name: string }[];
}

export interface CallDetail extends OpenCallView {
  requiredDocuments: { documentTypeId: string; code: string; name: string; isMandatory: boolean }[];
  priceItems: { id: string; lineNo: number; description: string; unit: string; quantity: number }[];
  addenda: {
    id: string;
    addendumNo: number;
    title: string;
    body: string;
    publishedAt: string;
    newClosesAt: string | null;
    acknowledgementsCount: number;
    acknowledged?: boolean;
  }[];
  clarificationsCount: number;
}

export interface ClarificationItem {
  id: string;
  callId: string;
  question: string;
  publishedQuestion: string | null;
  answer: string | null;
  responderTitle: string | null;
  topic: string | null;
  status: 'Pending' | 'Answered';
  askedAt: string;
  answeredAt: string | null;
  isPublished: boolean;
}

export class CallsRepository {
  /**
   * Reads open tenders/EOIs respecting call visibility rules:
   * - 'open' & 'category_restricted': publicly discoverable
   * - 'invite_only': visible only if the supplier has a row in call_invitations
   * - 'approved_suppliers': visible only if the supplier is active in approved_suppliers for that org
   */
  async listOpen(filters?: {
    query?: string;
    callType?: string;
    categoryId?: string;
    supplierId?: string;
  }): Promise<OpenCallView[]> {
    const validSupplierId =
      filters?.supplierId && UUID_REGEX.test(filters.supplierId) ? filters.supplierId : null;

    const params: any[] = [validSupplierId];
    let sql = `
      SELECT c.id, c.reference_no AS "referenceNo", c.title, c.call_type AS "callType",
             c.summary, c.description, c.status, c.visibility,
             c.opens_at AS "opensAt", c.clarification_deadline AS "clarificationDeadline",
             c.closes_at AS "closesAt", c.estimated_value AS "estimatedValue", c.currency,
             o.id AS "organizationId", o.name AS "organizationName", o.slug AS "organizationSlug",
             COALESCE(o.brand_primary_color, '#1F5F99') AS "orgBrandPrimaryColor",
             COALESCE(o.brand_subtext, '') AS "orgBrandSubtext",
             COALESCE(o.custom_domain, '') AS "orgCustomDomain",
             COALESCE(o.settings->>'welcomeNotice', '') AS "orgWelcomeNotice",
             CASE WHEN c.closes_at IS NOT NULL THEN EXTRACT(DAY FROM (c.closes_at - NOW())) ELSE NULL END AS "daysRemaining",
             COALESCE(
               (SELECT json_agg(json_build_object('id', cat.id, 'name', cat.name))
                FROM call_categories cc
                JOIN categories cat ON cat.id = cc.category_id
                WHERE cc.call_id = c.id),
               '[]'::json
             ) AS categories
      FROM calls c
      JOIN organizations o ON o.id = c.organization_id
      WHERE c.status IN ('open', 'published')
        AND o.status = 'active'
        AND o.deleted_at IS NULL
        AND (
          c.visibility IN ('open', 'category_restricted')
          OR (
            $1::uuid IS NOT NULL
            AND (
              (c.visibility = 'invite_only' AND EXISTS (
                SELECT 1 FROM call_invitations ci WHERE ci.call_id = c.id AND ci.supplier_id = $1::uuid
              ))
              OR (c.visibility = 'approved_suppliers' AND EXISTS (
                SELECT 1 FROM approved_suppliers ap
                WHERE ap.supplier_id = $1::uuid AND ap.organization_id = c.organization_id AND ap.status = 'active'
              ))
            )
          )
        )
    `;

    if (filters?.callType && filters.callType !== 'all') {
      params.push(filters.callType);
      sql += ` AND c.call_type = $${params.length}`;
    }

    if (filters?.query) {
      params.push(`%${filters.query}%`);
      sql += ` AND (c.title ILIKE $${params.length} OR c.reference_no ILIKE $${params.length} OR c.summary ILIKE $${params.length})`;
    }

    sql += ` ORDER BY c.closes_at ASC NULLS LAST, c.created_at DESC`;

    const res = await query<OpenCallView>(sql, params);
    return res.rows;
  }

  async getById(
    callId: string,
    access?: { supplierId?: string; organizationId?: string; isPlatformAdmin?: boolean }
  ): Promise<CallDetail | null> {
    const callRes = await query<OpenCallView>(
      `SELECT c.id, c.reference_no AS "referenceNo", c.title, c.call_type AS "callType",
              c.summary, c.description, c.status, c.visibility,
              c.opens_at AS "opensAt", c.clarification_deadline AS "clarificationDeadline",
              c.closes_at AS "closesAt", c.estimated_value AS "estimatedValue", c.currency,
              o.id AS "organizationId", o.name AS "organizationName", o.slug AS "organizationSlug",
              COALESCE(o.brand_primary_color, '#1F5F99') AS "orgBrandPrimaryColor",
              COALESCE(o.brand_subtext, '') AS "orgBrandSubtext",
              COALESCE(o.custom_domain, '') AS "orgCustomDomain",
              COALESCE(o.settings->>'welcomeNotice', '') AS "orgWelcomeNotice",
              CASE WHEN c.closes_at IS NOT NULL THEN EXTRACT(DAY FROM (c.closes_at - NOW())) ELSE NULL END AS "daysRemaining",
              COALESCE(
                (SELECT json_agg(json_build_object('id', cat.id, 'name', cat.name))
                 FROM call_categories cc
                 JOIN categories cat ON cat.id = cc.category_id
                 WHERE cc.call_id = c.id),
                '[]'::json
              ) AS categories
       FROM calls c
       JOIN organizations o ON o.id = c.organization_id
       WHERE c.id = $1`,
      [callId]
    );

    if (!callRes.rows.length) return null;
    const base = callRes.rows[0];

    const isOwnerOrg = Boolean(access?.organizationId && access.organizationId === base.organizationId);
    const validSupplierId = access?.supplierId && UUID_REGEX.test(access.supplierId) ? access.supplierId : null;

    if (!access?.isPlatformAdmin && !isOwnerOrg && base.visibility === 'invite_only') {
      if (!validSupplierId) return null;
      const invRes = await query<{ ok: boolean }>(
        `SELECT TRUE AS ok FROM call_invitations WHERE call_id = $1 AND supplier_id = $2 LIMIT 1`,
        [callId, validSupplierId]
      );
      if (!invRes.rows.length) return null;
    }

    if (!access?.isPlatformAdmin && !isOwnerOrg && base.visibility === 'approved_suppliers') {
      if (!validSupplierId) return null;
      const apRes = await query<{ ok: boolean }>(
        `SELECT TRUE AS ok FROM approved_suppliers WHERE supplier_id = $1 AND organization_id = $2 AND status = 'active' LIMIT 1`,
        [validSupplierId, base.organizationId]
      );
      if (!apRes.rows.length) return null;
    }

    const [docsRes, priceRes, addendaRes, clarCountRes] = await Promise.all([
      query(
        `SELECT crd.document_type_id AS "documentTypeId", dt.code, dt.name, crd.is_mandatory AS "isMandatory"
         FROM call_required_documents crd
         JOIN document_types dt ON dt.id = crd.document_type_id
         WHERE crd.call_id = $1`,
        [callId]
      ),
      query(
        `SELECT id, line_no AS "lineNo", description, unit, quantity
         FROM call_price_items
         WHERE call_id = $1
         ORDER BY line_no ASC`,
        [callId]
      ),
      query(
        `SELECT ca.id, ca.addendum_no AS "addendumNo", ca.title, ca.body,
                ca.published_at AS "publishedAt", ca.new_closes_at AS "newClosesAt",
                (SELECT COUNT(*)::int FROM call_addendum_acknowledgements caa WHERE caa.addendum_id = ca.id) AS "acknowledgementsCount",
                CASE WHEN $2::uuid IS NOT NULL
                  THEN EXISTS (SELECT 1 FROM call_addendum_acknowledgements caa WHERE caa.addendum_id = ca.id AND caa.supplier_id = $2::uuid)
                  ELSE FALSE
                END AS acknowledged
         FROM call_addenda ca
         WHERE ca.call_id = $1
         ORDER BY ca.addendum_no ASC`,
        [callId, validSupplierId]
      ),
      query<{ count: string }>(
        `SELECT count(*) FROM clarifications WHERE call_id = $1 AND is_published = TRUE`,
        [callId]
      ),
    ]);

    return {
      ...base,
      requiredDocuments: docsRes.rows,
      priceItems: priceRes.rows,
      addenda: addendaRes.rows,
      clarificationsCount: parseInt(clarCountRes.rows[0]?.count || '0', 10),
    };
  }

  async listClarifications(callId: string, supplierId?: string): Promise<ClarificationItem[]> {
    const validSupplierId = supplierId && UUID_REGEX.test(supplierId) ? supplierId : null;

    const res = await query<ClarificationItem>(
      `SELECT id, call_id AS "callId",
              COALESCE(published_question, question) AS question,
              published_question AS "publishedQuestion",
              answer, responder_title AS "responderTitle", topic, status,
              asked_at AS "askedAt", answered_at AS "answeredAt", is_published AS "isPublished",
              (asked_by_supplier_id = $2::uuid) AS "isOwnQuestion"
       FROM clarifications
       WHERE call_id = $1
         AND (is_published = TRUE OR ($2::uuid IS NOT NULL AND asked_by_supplier_id = $2::uuid))
       ORDER BY asked_at DESC`,
      [callId, validSupplierId]
    );
    return res.rows;
  }

  async listClarificationsByOrganization(orgId: string): Promise<any[]> {
    const res = await query(
      `SELECT cl.id, cl.call_id AS "callId", c.reference_no AS "callNumber", c.title AS "callTitle",
              cl.asked_by_supplier_id AS "supplierId",
              COALESCE(s.legal_name, cl.supplier_name_snapshot, 'Prospective Bidder') AS "supplierName",
              cl.question, cl.published_question AS "publishedQuestion",
              cl.answer, cl.responder_title AS "responderTitle",
              cl.topic, cl.status, cl.is_published AS "isPublished",
              cl.asked_at AS "askedAt", cl.answered_at AS "answeredAt"
       FROM clarifications cl
       JOIN calls c ON c.id = cl.call_id
       LEFT JOIN suppliers s ON s.id = cl.asked_by_supplier_id
       WHERE c.organization_id = $1
       ORDER BY cl.asked_at DESC`,
      [orgId]
    );
    return res.rows;
  }

  async askClarification(data: { callId: string; supplierId: string; userId: string; question: string; topic?: string }): Promise<ClarificationItem> {
    if (!data.question || !data.question.trim()) {
      const err: any = new Error('Clarification question text is required.');
      err.status = 400;
      throw err;
    }

    const call = await this.getById(data.callId, { supplierId: data.supplierId });
    if (!call) {
      const err: any = new Error('Call does not exist or is restricted to invited/approved suppliers.');
      err.status = 404;
      throw err;
    }

    if (!['open', 'published'].includes(String(call.status || '').toLowerCase())) {
      const err: any = new Error('Clarifications can only be submitted on open tender calls.');
      err.status = 400;
      throw err;
    }

    if (call.clarificationDeadline && new Date() > new Date(call.clarificationDeadline)) {
      const err: any = new Error('The clarification window for this tender has closed. Questions can no longer be submitted.');
      err.status = 400;
      throw err;
    }

    const supRes = await query<{ legal_name: string }>(
      `SELECT legal_name FROM suppliers WHERE id = $1 LIMIT 1`,
      [data.supplierId]
    );
    const supplierSnapshot = supRes.rows[0]?.legal_name || null;

    const res = await query<ClarificationItem>(
      `INSERT INTO clarifications (
        call_id, asked_by_supplier_id, asked_by_user_id, supplier_name_snapshot, question, topic, is_published, status, asked_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, FALSE, 'Pending', NOW()
      ) RETURNING id, call_id AS "callId", question, published_question AS "publishedQuestion",
                  answer, responder_title AS "responderTitle", topic, status,
                  asked_at AS "askedAt", answered_at AS "answeredAt", is_published AS "isPublished"`,
      [data.callId, data.supplierId, data.userId, supplierSnapshot, data.question.trim(), data.topic || 'General']
    );

    await notificationsRepository.notifyOrganizationMembers(
      call.organizationId,
      {
        supplierId: data.supplierId,
        eventType: 'clarification_asked',
        title: `New clarification question on ${call.referenceNo}`,
        body: `${supplierSnapshot || 'A prospective supplier'} asked a clarification question under ${data.topic || 'General'}. Review the question and publish an official response.`,
        linkUrl: 'clarifications',
        priority: 'info',
        permissionCode: 'calls.manage',
        data: {
          callId: data.callId,
          callNumber: call.referenceNo,
          supplierName: supplierSnapshot || 'A prospective supplier',
          topic: data.topic || 'General',
          clarificationId: res.rows[0].id,
        },
      }
    ).catch((e) => console.warn('[clarification notify warning]', e?.message || e));

    return res.rows[0];
  }

  async answerClarification(
    clarificationId: string,
    answer: string,
    responderTitle: string,
    userId: string,
    orgId: string,
    actor?: { actorName?: string; actorRole?: string; ipAddress?: string }
  ): Promise<void> {
    const cleanAnswer = answer ? String(answer).trim() : '';
    if (!cleanAnswer) {
      const err: any = new Error('Official clarification response cannot be empty.');
      err.status = 400;
      throw err;
    }

    await tx(async (client) => {
      const res = await client.query<{
        id: string;
        call_id: string;
        asked_by_supplier_id: string;
        reference_no: string;
        title: string;
      }>(
        `UPDATE clarifications cl
         SET answer = $2,
             responder_title = $3,
             answered_by_user_id = $4,
             answered_at = NOW(),
             status = 'Answered',
             is_published = TRUE,
             published_question = COALESCE(cl.published_question, cl.question)
         FROM calls c
         WHERE cl.id = $1
           AND cl.call_id = c.id
           AND c.organization_id = $5
         RETURNING cl.id, cl.call_id, cl.asked_by_supplier_id, c.reference_no, c.title`,
        [clarificationId, cleanAnswer, responderTitle, userId, orgId]
      );

      if (res.rowCount === 0) {
        const err: any = new Error('Clarification question not found for your organization.');
        err.status = 404;
        throw err;
      }

      const row = res.rows[0];

      await auditRepository.logEvent(
        {
          actorName: actor?.actorName || responderTitle || 'Procurement Officer',
          actorRole: actor?.actorRole || 'Buyer',
          actorUserId: userId,
          organizationId: orgId,
          action: 'Clarification Answer Published',
          entityType: 'Clarification',
          entityId: row.id,
          ipAddress: actor?.ipAddress,
          details: `Published official clarification response for ${row.reference_no} (${row.title}).`,
        },
        client
      );

      const supRes = await client.query<{ supplier_id: string }>(
        `SELECT $2::uuid AS supplier_id
         UNION
         SELECT supplier_id FROM applications WHERE call_id = $1 AND status <> 'Draft'
         UNION
         SELECT supplier_id FROM call_invitations WHERE call_id = $1`,
        [row.call_id, row.asked_by_supplier_id]
      );

      for (const s of supRes.rows) {
        if (!s.supplier_id) continue;
        await notificationsRepository.notifySupplierMembers(
          s.supplier_id,
          {
            organizationId: orgId,
            eventType: 'clarification_answered',
            title: `Clarification answer published for ${row.reference_no}`,
            body: `An official clarification response was published for ${row.title}. Open the tender call to read the answer before submitting.`,
            linkUrl: `call:${row.call_id}`,
            priority: 'info',
            data: {
              callId: row.call_id,
              callNumber: row.reference_no,
              callTitle: row.title,
              clarificationId: row.id,
            },
          },
          client
        );
      }
    });
  }

  async listByOrganization(orgId: string): Promise<any[]> {
    const res = await query(
      `SELECT c.id, c.reference_no AS "referenceNo", c.title, c.call_type AS "callType",
              c.summary, c.description, c.status, c.visibility,
              c.opens_at AS "opensAt", c.clarification_deadline AS "clarificationDeadline",
              c.closes_at AS "closesAt", c.estimated_value AS "estimatedValue", c.currency,
              c.sealed_bid_protocol_enforced AS "isSealed",
              c.organization_id AS "organizationId", o.name AS "organizationName", o.slug AS "organizationSlug",
              (SELECT count(*)::int FROM applications a WHERE a.call_id = c.id AND a.status <> 'Draft') AS "applicationsCount",
              (SELECT count(*)::int FROM call_invitations ci WHERE ci.call_id = c.id) AS "invitationsCount",
              COALESCE(
                (SELECT json_agg(json_build_object('id', cat.id, 'name', cat.name))
                 FROM call_categories cc
                 JOIN categories cat ON cat.id = cc.category_id
                 WHERE cc.call_id = c.id),
                '[]'::json
              ) AS categories,
              COALESCE(
                (SELECT json_agg(json_build_object('code', dt.code, 'name', dt.name))
                 FROM call_required_documents crd
                 JOIN document_types dt ON dt.id = crd.document_type_id
                 WHERE crd.call_id = c.id),
                '[]'::json
              ) AS "requiredDocuments",
              COALESCE(
                (SELECT json_agg(json_build_object(
                   'id', ca.id,
                   'addendumNo', ca.addendum_no,
                   'title', ca.title,
                   'body', ca.body,
                   'publishedAt', ca.published_at,
                   'newClosesAt', ca.new_closes_at,
                   'acknowledgementsCount', (SELECT count(*)::int FROM call_addendum_acknowledgements caa WHERE caa.addendum_id = ca.id)
                 ) ORDER BY ca.addendum_no ASC)
                 FROM call_addenda ca
                 WHERE ca.call_id = c.id),
                '[]'::json
              ) AS addenda,
              COALESCE(o.brand_primary_color, '#1F5F99') AS "orgBrandPrimaryColor",
              COALESCE(o.brand_subtext, '') AS "orgBrandSubtext",
              COALESCE(o.custom_domain, '') AS "orgCustomDomain",
              COALESCE(o.settings->>'welcomeNotice', '') AS "orgWelcomeNotice"
       FROM calls c
       JOIN organizations o ON o.id = c.organization_id
       WHERE c.organization_id = $1
       ORDER BY c.created_at DESC`,
      [orgId]
    );
    return res.rows;
  }

  /**
   * Create a new Call / Tender with strict statutory criteria weighting validation (must sum to 100%).
   */
  async createCall(data: {
    organizationId: string;
    referenceNo: string;
    title: string;
    callType: 'registration_drive' | 'eoi' | 'rfp' | 'rfq';
    summary: string;
    description: string;
    status?: 'draft' | 'open';
    visibility?: 'open' | 'approved_suppliers' | 'category_restricted' | 'invite_only';
    isSealed?: boolean;
    opensAt: string;
    closesAt: string;
    clarificationDeadline?: string;
    estimatedValue?: number;
    currency?: string;
    userId: string;
    categoryIds?: string[];
    criteria?: { name: string; weight: number; maxScore: number; criterionType: 'pass_fail' | 'scored' | 'price'; isMandatoryGate: boolean }[];
    requiredDocTypeCodes?: string[];
    priceItems?: { description: string; unit: string; quantity: number }[];
  }): Promise<string> {
    // 1. Validate Criteria Sum if scoring criteria provided
    if (data.criteria && data.criteria.length > 0) {
      const scored = data.criteria.filter((c) => c.criterionType === 'scored' || c.criterionType === 'price');
      if (scored.length > 0) {
        const totalWeight = scored.reduce((sum, c) => sum + Number(c.weight || 0), 0);
        if (Math.abs(totalWeight - 100) > 0.01) {
          throw new Error(`Criteria weight validation failed: Scored criteria weights must sum to exactly 100% (currently ${totalWeight}%).`);
        }
      }
    }

    const allowedStatuses = ['draft', 'open'];
    const resolvedStatus = allowedStatuses.includes(String(data.status || '').toLowerCase())
      ? String(data.status).toLowerCase()
      : 'open';

    const allowedVisibilities = ['open', 'approved_suppliers', 'category_restricted', 'invite_only'];
    const resolvedVisibility = allowedVisibilities.includes(String(data.visibility || '').toLowerCase())
      ? String(data.visibility).toLowerCase()
      : 'open';

    const isSealed = data.isSealed !== undefined ? Boolean(data.isSealed) : true;

    return tx(async (client) => {
      // 2. Check organization approval & active status (pending/suspended/rejected organizations cannot publish calls)
      const orgCheck = await client.query<{ status: string; verification_status: string; rejection_reason: string | null }>(
        `SELECT status, verification_status, rejection_reason FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
        [data.organizationId]
      );
      const orgRow = orgCheck.rows[0];
      if (!orgRow) {
        const err: any = new Error('Procuring organization record not found.');
        err.status = 403;
        err.code = 'ORGANIZATION_NOT_FOUND';
        throw err;
      }
      if (orgRow.status === 'pending' || orgRow.verification_status === 'pending_review' || orgRow.verification_status === 'pending') {
        const err: any = new Error('Your organization is pending verification and approval. You cannot publish tender calls yet.');
        err.status = 403;
        err.code = 'ORGANIZATION_PENDING_APPROVAL';
        throw err;
      }
      if (orgRow.status !== 'active' || orgRow.verification_status === 'rejected') {
        const code = orgRow.verification_status === 'rejected' ? 'ORGANIZATION_REJECTED' : 'ORGANIZATION_SUSPENDED';
        const err: any = new Error(
          orgRow.rejection_reason
            ? `Your organization is currently ${orgRow.status} (${orgRow.rejection_reason}) and cannot publish tender calls.`
            : `Your organization is currently ${orgRow.status} and cannot publish tender calls.`
        );
        err.status = 403;
        err.code = code;
        throw err;
      }

      // 3. Insert call
      const callRes = await client.query<{ id: string }>(
        `INSERT INTO calls (
          organization_id, reference_no, title, call_type, summary, description,
          status, visibility, sealed_bid_protocol_enforced,
          opens_at, closes_at, clarification_deadline,
          estimated_value, currency, created_by_user_id,
          published_by_user_id, published_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15,
          CASE WHEN $7 = 'open' THEN $15 ELSE NULL END,
          CASE WHEN $7 = 'open' THEN NOW() ELSE NULL END,
          NOW(), NOW()
        ) RETURNING id`,
        [
          data.organizationId,
          data.referenceNo.trim(),
          data.title.trim(),
          data.callType,
          (data.summary || '').trim(),
          (data.description || data.summary || '').trim(),
          resolvedStatus,
          resolvedVisibility,
          isSealed,
          data.opensAt,
          data.closesAt,
          data.clarificationDeadline || null,
          data.estimatedValue || null,
          data.currency || 'BWP',
          data.userId,
        ]
      );
      const callId = callRes.rows[0].id;

      // 4. Insert categories
      if (Array.isArray(data.categoryIds) && data.categoryIds.length > 0) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let idx = 0;
        for (const catId of data.categoryIds) {
          if (!uuidRegex.test(String(catId))) continue;
          await client.query(
            `INSERT INTO call_categories (call_id, category_id, is_primary)
             VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [callId, catId, idx === 0]
          );
          idx++;
        }
      }

      // 5. Insert required documents
      if (data.requiredDocTypeCodes && data.requiredDocTypeCodes.length) {
        for (const code of data.requiredDocTypeCodes) {
          const docType = await client.query<{ id: string }>(
            `SELECT id FROM document_types WHERE code = $1 OR LOWER(name) = LOWER($1) LIMIT 1`,
            [code]
          );
          if (docType.rows.length) {
            await client.query(
              `INSERT INTO call_required_documents (call_id, document_type_id, is_mandatory)
               VALUES ($1, $2, TRUE) ON CONFLICT DO NOTHING`,
              [callId, docType.rows[0].id]
            );
          }
        }
      }

      // 6. Insert criteria
      if (data.criteria && data.criteria.length) {
        for (let i = 0; i < data.criteria.length; i++) {
          const crit = data.criteria[i];
          await client.query(
            `INSERT INTO evaluation_criteria (
              call_id, name, criterion_type, weight, max_score, is_mandatory_gate, sort_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              callId,
              crit.name,
              crit.criterionType,
              crit.weight || 0,
              crit.maxScore || 100,
              crit.isMandatoryGate || false,
              i + 1,
            ]
          );
        }
      }

      // 7. Insert price items
      if (data.priceItems && data.priceItems.length) {
        for (let i = 0; i < data.priceItems.length; i++) {
          const pi = data.priceItems[i];
          await client.query(
            `INSERT INTO call_price_items (call_id, line_no, description, unit, quantity)
             VALUES ($1, $2, $3, $4, $5)`,
            [callId, i + 1, pi.description, pi.unit, pi.quantity]
          );
        }
      }

      return callId;
    });
  }

  async updateCall(callId: string, orgId: string, userId: string, data: {
    status?: string;
    visibility?: string;
    closesAt?: string;
    clarificationDeadline?: string;
  }): Promise<void> {
    const sets: string[] = [];
    const params: any[] = [callId, orgId];

    if (data.status !== undefined) {
      const allowed = ['draft', 'open', 'closed', 'evaluating', 'awarded', 'cancelled'];
      const cleanStatus = String(data.status).toLowerCase();
      if (!allowed.includes(cleanStatus)) {
        const err: any = new Error('Invalid call status.');
        err.status = 400;
        throw err;
      }
      params.push(cleanStatus);
      sets.push(`status = $${params.length}`);
      if (cleanStatus === 'open') {
        params.push(userId);
        sets.push(`published_by_user_id = COALESCE(published_by_user_id, $${params.length})`);
        sets.push(`published_at = COALESCE(published_at, NOW())`);
      }
    }

    if (data.visibility !== undefined) {
      const allowedVis = ['open', 'approved_suppliers', 'category_restricted', 'invite_only'];
      const cleanVis = String(data.visibility).toLowerCase();
      if (!allowedVis.includes(cleanVis)) {
        const err: any = new Error('Invalid call visibility.');
        err.status = 400;
        throw err;
      }
      params.push(cleanVis);
      sets.push(`visibility = $${params.length}`);
    }

    if (data.closesAt !== undefined) {
      params.push(data.closesAt);
      sets.push(`closes_at = $${params.length}`);
    }

    if (data.clarificationDeadline !== undefined) {
      params.push(data.clarificationDeadline || null);
      sets.push(`clarification_deadline = $${params.length}`);
    }

    if (!sets.length) return;
    sets.push(`updated_at = NOW()`);

    const res = await query(
      `UPDATE calls SET ${sets.join(', ')} WHERE id = $1 AND organization_id = $2`,
      params
    );
    if (res.rowCount === 0) {
      const err: any = new Error('Call not found for your organization.');
      err.status = 404;
      throw err;
    }
  }

  async createAddendum(
    callId: string,
    orgId: string,
    userId: string,
    data: {
      title: string;
      body?: string;
      summary?: string;
      newClosesAt?: string;
    },
    actor?: { actorName?: string; actorRole?: string; ipAddress?: string }
  ): Promise<any> {
    const cleanBody = (data.body ?? data.summary ?? '').trim();
    if (!data.title?.trim() || !cleanBody) {
      const err: any = new Error('Addendum title and details are required.');
      err.status = 400;
      throw err;
    }

    return tx(async (client) => {
      const check = await client.query<{ id: string; reference_no: string; title: string }>(
        `SELECT id, reference_no, title FROM calls WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [callId, orgId]
      );
      if (!check.rows.length) {
        const err: any = new Error('Tender call not found for your organization.');
        err.status = 404;
        throw err;
      }
      const callRow = check.rows[0];

      const maxRes = await client.query<{ next_no: number }>(
        `SELECT COALESCE(MAX(addendum_no), 0) + 1 AS next_no FROM call_addenda WHERE call_id = $1`,
        [callId]
      );
      const addendumNo = maxRes.rows[0].next_no;

      const ins = await client.query(
        `INSERT INTO call_addenda (
          call_id, addendum_no, title, body, new_closes_at, published_by_user_id, published_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, NOW()
        ) RETURNING id, call_id AS "callId", addendum_no AS "addendumNo", title, body, new_closes_at AS "newClosesAt", published_at AS "publishedAt"`,
        [callId, addendumNo, data.title.trim(), cleanBody, data.newClosesAt || null, userId]
      );
      const addendum = ins.rows[0];

      if (data.newClosesAt) {
        await client.query(
          `UPDATE calls SET closes_at = $2, updated_at = NOW() WHERE id = $1 AND organization_id = $3`,
          [callId, data.newClosesAt, orgId]
        );
      }

      await auditRepository.logEvent(
        {
          actorName: actor?.actorName || 'Procurement Officer',
          actorRole: actor?.actorRole || 'Buyer',
          actorUserId: userId,
          organizationId: orgId,
          action: 'Call Addendum Issued',
          entityType: 'CallAddendum',
          entityId: addendum.id,
          ipAddress: actor?.ipAddress,
          afterJson: { callId, addendumNo, newClosesAt: data.newClosesAt || null },
          details: `Issued Addendum #${addendumNo} ("${data.title.trim()}") for ${callRow.reference_no}${data.newClosesAt ? ` — closing extended to ${data.newClosesAt}` : ''}.`,
        },
        client
      );

      // Notify all applicant, bidder, and invited suppliers
      const targetSuppliers = await client.query<{ supplier_id: string }>(
        `SELECT supplier_id FROM applications WHERE call_id = $1 AND status <> 'Draft'
         UNION
         SELECT supplier_id FROM bids WHERE call_id = $1 AND status <> 'withdrawn'
         UNION
         SELECT supplier_id FROM call_invitations WHERE call_id = $1`,
        [callId]
      );

      for (const sup of targetSuppliers.rows) {
        await notificationsRepository.notifySupplierMembers(
          sup.supplier_id,
          {
            organizationId: orgId,
            eventType: 'addendum_published',
            title: `Addendum #${addendumNo} published for ${callRow.reference_no}`,
            body: `${data.title.trim()} was issued for ${callRow.title}. Open the tender call to review and acknowledge this addendum.`,
            linkUrl: `call:${callId}`,
            priority: 'urgent',
            data: {
              callId,
              callNumber: callRow.reference_no,
              callTitle: callRow.title,
              addendumId: addendum.id,
              addendumNo,
              addendumTitle: data.title.trim(),
            },
          },
          client
        );
      }

      return { ...addendum, acknowledgementsCount: 0 };
    });
  }

  async acknowledgeAddendum(data: {
    callId: string;
    addendumId: string;
    supplierId: string;
    userId: string;
    actorName: string;
    actorRole: string;
    ipAddress?: string;
  }): Promise<{ addendumId: string; acknowledgedAt: string }> {
    if (!UUID_REGEX.test(data.callId) || !UUID_REGEX.test(data.addendumId)) {
      const err: any = new Error('Invalid call or addendum identifier.');
      err.status = 400;
      throw err;
    }

    const accessibleCall = await this.getById(data.callId, { supplierId: data.supplierId });
    if (!accessibleCall) {
      const err: any = new Error('Tender call not found or not accessible to your supplier account.');
      err.status = 404;
      throw err;
    }

    return tx(async (client) => {
      const addRes = await client.query<{ id: string; addendum_no: number; title: string }>(
        `SELECT id, addendum_no, title FROM call_addenda WHERE id = $1 AND call_id = $2 LIMIT 1`,
        [data.addendumId, data.callId]
      );
      if (!addRes.rows.length) {
        const err: any = new Error('Addendum not found for this tender call.');
        err.status = 404;
        throw err;
      }
      const addendum = addRes.rows[0];

      await client.query(
        `INSERT INTO call_addendum_acknowledgements (addendum_id, supplier_id, acknowledged_by_user_id, acknowledged_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (addendum_id, supplier_id) DO NOTHING`,
        [data.addendumId, data.supplierId, data.userId]
      );

      await auditRepository.logEvent(
        {
          actorName: data.actorName,
          actorRole: data.actorRole,
          actorUserId: data.userId,
          supplierId: data.supplierId,
          organizationId: accessibleCall.organizationId,
          action: 'Addendum Acknowledged',
          entityType: 'CallAddendum',
          entityId: data.addendumId,
          ipAddress: data.ipAddress,
          details: `Supplier acknowledged Addendum #${addendum.addendum_no} ("${addendum.title}") on ${accessibleCall.referenceNo}.`,
        },
        client
      );

      return { addendumId: data.addendumId, acknowledgedAt: new Date().toISOString() };
    });
  }

  async listInvitations(callId: string, orgId: string): Promise<any[]> {
    const ownCheck = await query(`SELECT id FROM calls WHERE id = $1 AND organization_id = $2 LIMIT 1`, [callId, orgId]);
    if (!ownCheck.rows.length) {
      const err: any = new Error('Tender call not found for your organization.');
      err.status = 404;
      throw err;
    }

    const res = await query(
      `SELECT ci.call_id AS "callId",
              ci.supplier_id AS "supplierId",
              s.legal_name AS "supplierLegalName",
              s.cipa_uin AS "cipaNumber",
              s.email,
              s.compliance_status AS "complianceStatus",
              u.full_name AS "invitedByName",
              ci.invited_at AS "invitedAt"
       FROM call_invitations ci
       JOIN suppliers s ON s.id = ci.supplier_id
       JOIN users u ON u.id = ci.invited_by_user_id
       WHERE ci.call_id = $1
       ORDER BY ci.invited_at DESC`,
      [callId]
    );
    return res.rows;
  }

  async inviteSuppliers(data: {
    callId: string;
    orgId: string;
    userId: string;
    actorName: string;
    actorRole: string;
    supplierIds: string[];
    ipAddress?: string;
  }): Promise<{ invitedCount: number; invitations: any[] }> {
    const cleanIds = Array.from(new Set((data.supplierIds || []).filter((id) => UUID_REGEX.test(String(id)))));
    if (!cleanIds.length) {
      const err: any = new Error('Select at least one valid supplier to invite.');
      err.status = 400;
      throw err;
    }

    await tx(async (client) => {
      const callRes = await client.query<{ id: string; reference_no: string; title: string; org_name: string }>(
        `SELECT c.id, c.reference_no, c.title, o.name AS org_name
         FROM calls c
         JOIN organizations o ON o.id = c.organization_id
         WHERE c.id = $1 AND c.organization_id = $2
         LIMIT 1`,
        [data.callId, data.orgId]
      );
      if (!callRes.rows.length) {
        const err: any = new Error('Tender call not found for your organization.');
        err.status = 404;
        throw err;
      }
      const call = callRes.rows[0];

      const supRes = await client.query<{ id: string; legal_name: string; email: string | null }>(
        `SELECT id, legal_name, email FROM suppliers WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
        [cleanIds]
      );

      for (const sup of supRes.rows) {
        const ins = await client.query(
          `INSERT INTO call_invitations (call_id, supplier_id, invited_by_user_id, invited_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (call_id, supplier_id) DO NOTHING
           RETURNING supplier_id`,
          [data.callId, sup.id, data.userId]
        );

        if ((ins.rowCount || 0) > 0) {
          await notificationsRepository.notifySupplierMembers(
            sup.id,
            {
              organizationId: data.orgId,
              eventType: 'call_invitation',
              title: `You are invited to bid on ${call.reference_no}`,
              body: `${call.org_name} invited your company to respond to ${call.title}. Open the tender call to review requirements and deadlines.`,
              linkUrl: `call:${data.callId}`,
              priority: 'urgent',
              data: {
                callId: data.callId,
                callNumber: call.reference_no,
                callTitle: call.title,
                organizationName: call.org_name,
              },
            },
            client
          );
        }
      }

      await auditRepository.logEvent(
        {
          actorName: data.actorName,
          actorRole: data.actorRole,
          actorUserId: data.userId,
          organizationId: data.orgId,
          action: 'Suppliers Invited to Tender',
          entityType: 'Call',
          entityId: data.callId,
          ipAddress: data.ipAddress,
          afterJson: { invitedSupplierIds: supRes.rows.map((s) => s.id) },
          details: `Issued formal tender invitations on ${call.reference_no} to ${supRes.rows.map((s) => s.legal_name).join(', ')}.`,
        },
        client
      );
    });

    const invitations = await this.listInvitations(data.callId, data.orgId);
    return { invitedCount: cleanIds.length, invitations };
  }

  async listSupplierInvitations(supplierId: string): Promise<any[]> {
    if (!UUID_REGEX.test(supplierId)) return [];
    const res = await query(
      `SELECT ci.call_id AS "callId",
              c.reference_no AS "referenceNo",
              c.title,
              c.call_type AS "callType",
              c.status,
              c.visibility,
              c.closes_at AS "closesAt",
              o.id AS "organizationId",
              o.name AS "organizationName",
              u.full_name AS "invitedByName",
              ci.invited_at AS "invitedAt"
       FROM call_invitations ci
       JOIN calls c ON c.id = ci.call_id
       JOIN organizations o ON o.id = c.organization_id
       JOIN users u ON u.id = ci.invited_by_user_id
       WHERE ci.supplier_id = $1 AND o.status = 'active' AND o.deleted_at IS NULL
       ORDER BY ci.invited_at DESC`,
      [supplierId]
    );
    return res.rows;
  }
}

export const callsRepository = new CallsRepository();
