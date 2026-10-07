import { query, withTransaction } from '../db/client';
import { auditRepository } from './audit.repository';

export interface EvaluationCriterionRecord {
  id: string;
  callId: string;
  name: string;
  description: string | null;
  criterionType: 'pass_fail' | 'scored' | 'price';
  stage: string;
  weight: number;
  maxScore: number;
  isMandatoryGate: boolean;
  sortOrder: number;
}

export interface ScoreMatrixEntry {
  criterionId: string;
  bidId: string;
  evaluatorAssignmentId: string;
  scoreValue: number | null;
  passFail: string | null;
  comment: string | null;
  lockedAt: string | null;
}

export class EvaluationsRepository {
  async getCriteria(callId: string): Promise<EvaluationCriterionRecord[]> {
    const res = await query<EvaluationCriterionRecord>(
      `SELECT id, call_id AS "callId", name, description,
              criterion_type AS "criterionType", stage, weight,
              max_score AS "maxScore", is_mandatory_gate AS "isMandatoryGate", sort_order AS "sortOrder"
       FROM evaluation_criteria
       WHERE call_id = $1
       ORDER BY sort_order ASC`,
      [callId]
    );
    return res.rows;
  }

  async getEvaluatorAssignment(callId: string, userId: string): Promise<any | null> {
    const res = await query(
      `SELECT id, call_id AS "callId", user_id AS "userId", organization_id AS "organizationId",
              evaluator_role AS "evaluatorRole", coi_status AS "coiStatus", coi_declared_at AS "coiDeclaredAt",
              scorecard_locked AS "scorecardLocked", scorecard_locked_at AS "scorecardLockedAt"
       FROM evaluator_assignments
       WHERE call_id = $1 AND user_id = $2`,
      [callId, userId]
    );
    return res.rows[0] || null;
  }

  async signConflictDeclaration(callId: string, userId: string, orgId: string, hasConflict: boolean, details?: string): Promise<void> {
    await withTransaction(async (client) => {
      // Find or create assignment
      let assignmentRes = await client.query<{ id: string }>(
        `SELECT id FROM evaluator_assignments WHERE call_id = $1 AND user_id = $2`,
        [callId, userId]
      );

      let assignmentId = assignmentRes.rows[0]?.id;
      if (!assignmentId) {
        const createRes = await client.query<{ id: string }>(
          `INSERT INTO evaluator_assignments (call_id, user_id, organization_id, evaluator_role, assigned_by_user_id, coi_status, coi_declared_at, coi_details)
           VALUES ($1, $2, $3, 'evaluator', $2, $4, NOW(), $5) RETURNING id`,
          [callId, userId, orgId, hasConflict ? 'conflict' : 'none', details || null]
        );
        assignmentId = createRes.rows[0].id;
      } else {
        await client.query(
          `UPDATE evaluator_assignments
           SET coi_status = $2, coi_declared_at = NOW(), coi_details = $3
           WHERE id = $1`,
          [assignmentId, hasConflict ? 'conflict' : 'none', details || null]
        );
      }

      await client.query(
        `INSERT INTO conflict_declarations (evaluator_assignment_id, has_conflict, details, declared_at)
         VALUES ($1, $2, $3, NOW())`,
        [assignmentId, hasConflict, details || null]
      );
    });
  }

  async submitScore(data: {
    callId: string;
    userId: string;
    criterionId: string;
    bidId: string;
    score: number;
    comment?: string;
  }): Promise<void> {
    const assignment = await this.getEvaluatorAssignment(data.callId, data.userId);
    if (!assignment) {
      throw new Error('You are not assigned as an evaluator for this tender.');
    }

    if (assignment.coiStatus !== 'none') {
      throw new Error('Conflict of Interest Declaration Required: You must sign the statutory independence declaration before scoring.');
    }

    if (assignment.scorecardLocked) {
      throw new Error('This scorecard has been locked and finalized. No further score modifications are permitted.');
    }

    await query(
      `INSERT INTO evaluation_scores (
        criterion_id, bid_id, evaluator_assignment_id, score_value, comment, submitted_at
      ) VALUES (
        $1, $2, $3, $4, $5, NOW()
      )
      ON CONFLICT (criterion_id, bid_id, evaluator_assignment_id) DO UPDATE
      SET score_value = EXCLUDED.score_value,
          comment = EXCLUDED.comment,
          submitted_at = NOW()`,
      [data.criterionId, data.bidId, assignment.id, data.score, data.comment || null]
    );
  }

  async lockScorecard(data: {
    callId: string;
    userId: string;
    actorName: string;
    actorRole: string;
    orgId: string;
    ipAddress?: string;
  }): Promise<void> {
    const assignment = await this.getEvaluatorAssignment(data.callId, data.userId);
    if (!assignment) throw new Error('Evaluator assignment not found.');

    await withTransaction(async (client) => {
      // 1. Lock assignment
      await client.query(
        `UPDATE evaluator_assignments
         SET scorecard_locked = TRUE, scorecard_locked_at = NOW()
         WHERE id = $1`,
        [assignment.id]
      );

      // 2. Lock individual score records (database trigger will protect them from subsequent edits)
      await client.query(
        `UPDATE evaluation_scores
         SET locked_at = NOW()
         WHERE evaluator_assignment_id = $1`,
        [assignment.id]
      );

      // 3. Write Audit Event
      await auditRepository.logEvent({
        actorName: data.actorName,
        actorRole: data.actorRole,
        actorUserId: data.userId,
        organizationId: data.orgId,
        action: 'Scorecard Finalized & Locked',
        entityType: 'EvaluatorAssignment',
        entityId: assignment.id,
        ipAddress: data.ipAddress,
        details: `Evaluator scorecard locked and finalized for call ${data.callId}.`,
      });
    });
  }

  async listScores(callId: string): Promise<ScoreMatrixEntry[]> {
    const res = await query<ScoreMatrixEntry>(
      `SELECT es.criterion_id AS "criterionId", es.bid_id AS "bidId",
              es.evaluator_assignment_id AS "evaluatorAssignmentId",
              es.score_value AS "scoreValue", es.pass_fail AS "passFail",
              es.comment, es.locked_at AS "lockedAt"
       FROM evaluation_scores es
       JOIN evaluation_criteria ec ON ec.id = es.criterion_id
       WHERE ec.call_id = $1`,
      [callId]
    );
    return res.rows;
  }
}

export const evaluationsRepository = new EvaluationsRepository();
