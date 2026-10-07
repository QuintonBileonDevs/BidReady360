import { query, withTransaction } from '../db/client';

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
  daysRemaining: number | null;
  categories: { id: string; name: string }[];
}

export interface CallDetail extends OpenCallView {
  requiredDocuments: { documentTypeId: string; code: string; name: string; isMandatory: boolean }[];
  priceItems: { id: string; lineNo: number; description: string; unit: string; quantity: number }[];
  addenda: { id: string; addendumNo: number; title: string; body: string; publishedAt: string; newClosesAt: string | null }[];
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
   * Reads public open tenders and EOIs live from the database / view.
   */
  async listOpen(filters?: { query?: string; callType?: string; categoryId?: string }): Promise<OpenCallView[]> {
    let sql = `
      SELECT c.id, c.reference_no AS "referenceNo", c.title, c.call_type AS "callType",
             c.summary, c.description, c.status, c.visibility,
             c.opens_at AS "opensAt", c.clarification_deadline AS "clarificationDeadline",
             c.closes_at AS "closesAt", c.estimated_value AS "estimatedValue", c.currency,
             o.id AS "organizationId", o.name AS "organizationName", o.slug AS "organizationSlug",
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
        AND c.visibility = 'open'
    `;

    const params: any[] = [];
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

  async getById(callId: string): Promise<CallDetail | null> {
    const callRes = await query<OpenCallView>(
      `SELECT c.id, c.reference_no AS "referenceNo", c.title, c.call_type AS "callType",
              c.summary, c.description, c.status, c.visibility,
              c.opens_at AS "opensAt", c.clarification_deadline AS "clarificationDeadline",
              c.closes_at AS "closesAt", c.estimated_value AS "estimatedValue", c.currency,
              o.id AS "organizationId", o.name AS "organizationName", o.slug AS "organizationSlug",
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
        `SELECT id, addendum_no AS "addendumNo", title, body, published_at AS "publishedAt", new_closes_at AS "newClosesAt"
         FROM call_addenda
         WHERE call_id = $1
         ORDER BY addendum_no ASC`,
        [callId]
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

  async listClarifications(callId: string): Promise<ClarificationItem[]> {
    const res = await query<ClarificationItem>(
      `SELECT id, call_id AS "callId", question, published_question AS "publishedQuestion",
              answer, responder_title AS "responderTitle", topic, status,
              asked_at AS "askedAt", answered_at AS "answeredAt", is_published AS "isPublished"
       FROM clarifications
       WHERE call_id = $1 AND is_published = TRUE
       ORDER BY asked_at DESC`,
      [callId]
    );
    return res.rows;
  }

  async askClarification(data: { callId: string; supplierId: string; userId: string; question: string; topic?: string }): Promise<ClarificationItem> {
    // Check clarification deadline
    const call = await this.getById(data.callId);
    if (!call) throw new Error('Call does not exist.');

    if (call.clarificationDeadline && new Date() > new Date(call.clarificationDeadline)) {
      throw new Error('The clarification window for this tender has closed. Questions can no longer be submitted.');
    }

    const res = await query<ClarificationItem>(
      `INSERT INTO clarifications (
        call_id, asked_by_supplier_id, asked_by_user_id, question, topic, is_published, status, asked_at
      ) VALUES (
        $1, $2, $3, $4, $5, TRUE, 'Pending', NOW()
      ) RETURNING id, call_id AS "callId", question, published_question AS "publishedQuestion",
                  answer, responder_title AS "responderTitle", topic, status,
                  asked_at AS "askedAt", answered_at AS "answeredAt", is_published AS "isPublished"`,
      [data.callId, data.supplierId, data.userId, data.question.trim(), data.topic || 'General']
    );
    return res.rows[0];
  }

  async answerClarification(clarificationId: string, answer: string, responderTitle: string, userId: string): Promise<void> {
    await query(
      `UPDATE clarifications
       SET answer = $2,
           responder_title = $3,
           answered_by_user_id = $4,
           answered_at = NOW(),
           status = 'Answered',
           is_published = TRUE
       WHERE id = $1`,
      [clarificationId, answer.trim(), responderTitle, userId]
    );
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
    opensAt: string;
    closesAt: string;
    clarificationDeadline?: string;
    estimatedValue?: number;
    currency?: string;
    userId: string;
    criteria?: { name: string; weight: number; maxScore: number; criterionType: 'pass_fail' | 'scored' | 'price'; isMandatoryGate: boolean }[];
    requiredDocTypeCodes?: string[];
    priceItems?: { description: string; unit: string; quantity: number }[];
  }): Promise<string> {
    // 1. Validate Criteria Sum if scoring criteria provided
    if (data.criteria && data.criteria.length > 0) {
      const totalWeight = data.criteria
        .filter((c) => c.criterionType === 'scored')
        .reduce((sum, c) => sum + Number(c.weight || 0), 0);

      if (Math.abs(totalWeight - 100) > 0.01) {
        throw new Error(`Criteria weight validation failed: Scored criteria weights must sum to exactly 100% (currently ${totalWeight}%).`);
      }
    }

    return withTransaction(async (client) => {
      // 2. Insert call
      const callRes = await client.query<{ id: string }>(
        `INSERT INTO calls (
          organization_id, reference_no, title, call_type, summary, description,
          status, visibility, opens_at, closes_at, clarification_deadline,
          estimated_value, currency, created_by_user_id, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 'open', 'open', $7, $8, $9, $10, $11, $12, NOW(), NOW()
        ) RETURNING id`,
        [
          data.organizationId,
          data.referenceNo.trim(),
          data.title.trim(),
          data.callType,
          data.summary.trim(),
          data.description.trim(),
          data.opensAt,
          data.closesAt,
          data.clarificationDeadline || null,
          data.estimatedValue || null,
          data.currency || 'BWP',
          data.userId,
        ]
      );
      const callId = callRes.rows[0].id;

      // 3. Insert required documents
      if (data.requiredDocTypeCodes && data.requiredDocTypeCodes.length) {
        for (const code of data.requiredDocTypeCodes) {
          const docType = await client.query<{ id: string }>(
            `SELECT id FROM document_types WHERE code = $1 LIMIT 1`,
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

      // 4. Insert criteria
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

      // 5. Insert price items
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
}

export const callsRepository = new CallsRepository();
