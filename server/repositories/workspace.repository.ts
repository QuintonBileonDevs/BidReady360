import crypto from 'crypto';
import { query, tx } from '../db/client';
import { auditRepository } from './audit.repository';
import { notificationsRepository } from './notifications.repository';
import { generateRandomToken, hashToken } from '../utils/crypto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const ALLOWED_FIELD_TYPES = new Set([
  'text',
  'number',
  'dropdown',
  'date',
  'file_upload',
  'yes_no',
  'textarea',
  'email',
  'phone',
  'currency',
]);

async function hasOrgMemberColumn(columnName: string): Promise<boolean> {
  const res = await query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'organization_members'
         AND column_name = $1
     ) AS exists`,
    [columnName]
  ).catch(() => ({ rows: [{ exists: false }] }));
  return Boolean(res.rows[0]?.exists);
}

function validateSafeWebhookUrl(rawUrl: string): string {
  const trimmed = String(rawUrl || '').trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    const err: any = new Error('Webhook endpoint must be a valid HTTPS URL.');
    err.status = 400;
    throw err;
  }

  if (parsed.protocol !== 'https:') {
    const err: any = new Error('Webhook endpoint URL must use HTTPS.');
    err.status = 400;
    throw err;
  }

  const host = parsed.hostname.toLowerCase();
  const isBlocked =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^127\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

  if (isBlocked) {
    const err: any = new Error('Webhook URL cannot target localhost, loopback, link-local, or private network hosts.');
    err.status = 400;
    throw err;
  }

  return parsed.toString().slice(0, 500);
}

export interface ScoringCriterionConfig {
  id: string;
  label: string;
  weightPercent?: number | null;
  passFail?: boolean;
}

export interface ScoringTemplateConfig {
  id: string;
  name: string;
  badge: string;
  method: 'qcbs' | 'least_cost' | 'custom';
  isActive: boolean;
  criteria: ScoringCriterionConfig[];
}

const DEFAULT_SCORING_TEMPLATES: ScoringTemplateConfig[] = [
  {
    id: 'tpl-qcbs-80-20',
    name: 'Quality & Cost-Based Selection (80% Tech / 20% Fin)',
    badge: 'Standard Works Template',
    method: 'qcbs',
    isActive: true,
    criteria: [
      { id: 'c1', label: 'Technical Capacity & Experience', weightPercent: 35 },
      { id: 'c2', label: 'Key Personnel & Team Qualifications', weightPercent: 25 },
      { id: 'c3', label: 'Methodology & Work Plan', weightPercent: 20 },
      { id: 'c4', label: 'Price Proposal (Unsealed Post-Tech)', weightPercent: 20 },
    ],
  },
  {
    id: 'tpl-least-cost',
    name: 'Compliant Least-Cost Selection (Pass/Fail + Price)',
    badge: 'Commodities & Supplies',
    method: 'least_cost',
    isActive: true,
    criteria: [
      { id: 'lc1', label: 'Statutory Document Verification', passFail: true },
      { id: 'lc2', label: 'Technical Specification Compliance', passFail: true },
      { id: 'lc3', label: 'Evaluated Financial Proposal', weightPercent: 100 },
    ],
  },
];

export class WorkspaceRepository {
  // =========================================================================
  // 1. TEAM, ROLES & INVITATIONS
  // =========================================================================
  async listOrgRoles(orgId: string) {
    const res = await query<any>(
      `SELECT r.id,
              r.name,
              r.description,
              r.is_system AS "isSystem",
              r.approval_limit_bwp AS "approvalLimitBwp",
              COALESCE(
                (SELECT array_agg(p.code ORDER BY p.code)
                 FROM role_permissions rp
                 JOIN permissions p ON p.id = rp.permission_id
                 WHERE rp.role_id = r.id),
                '{}'::text[]
              ) AS permissions
       FROM roles r
       WHERE r.scope = 'organization'
         AND (r.organization_id IS NULL OR r.organization_id = $1)
       ORDER BY r.sort_order ASC, r.is_system DESC, r.name ASC`,
      [orgId]
    );
    return res.rows.map((r: any) => ({
      ...r,
      approvalLimitBwp: r.approvalLimitBwp !== null && r.approvalLimitBwp !== undefined ? Number(r.approvalLimitBwp) : null,
    }));
  }

  async listTeamAndInvitations(orgId: string) {
    const [hasLimitCol, hasConflictCol] = await Promise.all([
      hasOrgMemberColumn('approval_limit_bwp'),
      hasOrgMemberColumn('conflict_declared'),
    ]);

    const limitExpr = hasLimitCol ? 'COALESCE(om.approval_limit_bwp, r.approval_limit_bwp)' : 'r.approval_limit_bwp';
    const conflictExpr = hasConflictCol ? 'COALESCE(om.conflict_declared, FALSE)' : 'FALSE';

    const [membersRes, invitesRes, roles] = await Promise.all([
      query<any>(
        `SELECT om.id,
                om.user_id AS "userId",
                u.full_name AS "fullName",
                u.email::text AS email,
                COALESCE(u.phone, '') AS phone,
                COALESCE(om.department, 'Supply Chain Management') AS department,
                COALESCE(om.job_title, r.name) AS "jobTitle",
                om.role_id AS "roleId",
                r.name AS role,
                ${limitExpr} AS "approvalLimitBWP",
                om.status,
                om.is_owner AS "isOwner",
                om.mfa_enforced AS "mfaEnabled",
                ${conflictExpr} AS "conflictDeclared",
                om.joined_at AS "joinedAt",
                om.last_active_at AS "lastActiveAt",
                om.created_at AS "createdAt"
         FROM organization_members om
         JOIN users u ON u.id = om.user_id AND u.deleted_at IS NULL
         JOIN roles r ON r.id = om.role_id
         WHERE om.organization_id = $1 AND om.status != 'removed'
         ORDER BY om.is_owner DESC, om.created_at ASC`,
        [orgId]
      ),
      query<any>(
        `SELECT i.id,
                i.email::text AS email,
                i.role_id AS "roleId",
                r.name AS role,
                COALESCE(i.department, 'Supply Chain Management') AS department,
                COALESCE(i.job_title, r.name) AS "jobTitle",
                i.approval_limit_bwp AS "approvalLimitBWP",
                i.created_at AS "sentAt",
                i.expires_at AS "expiresAt",
                COALESCE(u.full_name, 'Workspace Admin') AS "invitedByName"
         FROM invitations i
         JOIN roles r ON r.id = i.role_id
         LEFT JOIN users u ON u.id = i.invited_by_user_id
         WHERE i.organization_id = $1
           AND i.accepted_at IS NULL
           AND i.revoked_at IS NULL
           AND i.expires_at > NOW()
         ORDER BY i.created_at DESC`,
        [orgId]
      ),
      this.listOrgRoles(orgId),
    ]);

    return {
      members: membersRes.rows.map((m: any) => ({
        ...m,
        approvalLimitBWP:
          m.approvalLimitBWP !== null && m.approvalLimitBWP !== undefined ? Number(m.approvalLimitBWP) : null,
      })),
      pendingInvitations: invitesRes.rows.map((inv: any) => ({
        ...inv,
        approvalLimitBWP:
          inv.approvalLimitBWP !== null && inv.approvalLimitBWP !== undefined ? Number(inv.approvalLimitBWP) : null,
      })),
      roles,
    };
  }

  async inviteOrgMember(
    orgId: string,
    actor: { userId: string; fullName: string; roleName: string; ipAddress?: string },
    input: {
      email: string;
      roleName?: string;
      roleId?: string;
      department?: string;
      jobTitle?: string;
      approvalLimitBWP?: number | null;
    }
  ) {
    const cleanEmail = String(input.email || '').trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      const err: any = new Error('A valid officer email address is required.');
      err.status = 400;
      throw err;
    }

    return tx(async (client) => {
      const orgRes = await client.query<{ name: string }>(`SELECT name FROM organizations WHERE id = $1`, [orgId]);
      const orgName = orgRes.rows[0]?.name || 'Procuring Organization';

      let roleRow: { id: string; name: string } | undefined;
      if (input.roleId && UUID_REGEX.test(input.roleId)) {
        const rRes = await client.query<{ id: string; name: string }>(
          `SELECT id, name FROM roles WHERE id = $1 AND scope = 'organization' AND (organization_id IS NULL OR organization_id = $2) LIMIT 1`,
          [input.roleId, orgId]
        );
        roleRow = rRes.rows[0];
      }
      if (!roleRow) {
        const targetRoleName = String(input.roleName || 'Procurement Officer').trim();
        const rRes = await client.query<{ id: string; name: string }>(
          `SELECT id, name FROM roles
           WHERE scope = 'organization'
             AND (organization_id IS NULL OR organization_id = $2)
             AND LOWER(name) = LOWER($1)
           LIMIT 1`,
          [targetRoleName, orgId]
        );
        roleRow = rRes.rows[0];
      }
      if (!roleRow) {
        const err: any = new Error('Selected organization role does not exist.');
        err.status = 400;
        throw err;
      }

      // Ensure user is not already an active member of this organization
      const existingMember = await client.query<{ id: string; status: string }>(
        `SELECT om.id, om.status
         FROM organization_members om
         JOIN users u ON u.id = om.user_id
         WHERE om.organization_id = $1 AND LOWER(u.email::text) = LOWER($2) AND om.status != 'removed'
         LIMIT 1`,
        [orgId, cleanEmail]
      );
      if (existingMember.rows.length > 0) {
        const err: any = new Error(`User ${cleanEmail} is already a member of this organization.`);
        err.status = 409;
        throw err;
      }

      // Revoke any earlier pending invitation for this org + email
      await client.query(
        `UPDATE invitations
         SET revoked_at = NOW()
         WHERE organization_id = $1 AND LOWER(email::text) = LOWER($2) AND accepted_at IS NULL AND revoked_at IS NULL`,
        [orgId, cleanEmail]
      );

      const rawToken = generateRandomToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const cleanDept = input.department ? String(input.department).trim().slice(0, 128) : 'Supply Chain Management';
      const cleanTitle = input.jobTitle ? String(input.jobTitle).trim().slice(0, 128) : roleRow.name;
      const numLimit =
        input.approvalLimitBWP !== undefined && input.approvalLimitBWP !== null && !isNaN(Number(input.approvalLimitBWP))
          ? Math.max(0, Number(input.approvalLimitBWP))
          : null;

      const invRes = await client.query<{ id: string; email: string; created_at: string; expires_at: string }>(
        `INSERT INTO invitations (
           organization_id, email, role_id, token_hash, invited_by_user_id,
           department, job_title, approval_limit_bwp, expires_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, email::text AS email, created_at, expires_at`,
        [orgId, cleanEmail, roleRow.id, tokenHash, actor.userId, cleanDept, cleanTitle, numLimit, expiresAt]
      );

      const row = invRes.rows[0];

      await notificationsRepository.queueEmailDelivery(
        {
          recipientEmail: cleanEmail,
          templateCode: 'team_invitation',
          organizationId: orgId,
          vars: {
            tenantName: orgName,
            inviterName: actor.fullName,
            roleName: roleRow.name,
            expiresAt: expiresAt.toISOString().slice(0, 10),
          },
        },
        client
      );

      await auditRepository.logEvent(
        {
          actorName: actor.fullName,
          actorRole: actor.roleName,
          actorUserId: actor.userId,
          organizationId: orgId,
          organizationName: orgName,
          action: 'Team Member Invited',
          entityType: 'Organization',
          entityId: row.id,
          ipAddress: actor.ipAddress,
          details: `Invited ${cleanEmail} as ${roleRow.name} (${cleanDept})${numLimit !== null ? ` with BWP ${numLimit.toLocaleString()} limit` : ''}.`,
        },
        client
      );

      return {
        id: row.id,
        email: row.email,
        role: roleRow.name,
        department: cleanDept,
        jobTitle: cleanTitle,
        approvalLimitBWP: numLimit,
        sentAt: row.created_at,
        expiresAt: row.expires_at,
        inviteToken: rawToken,
      };
    });
  }

  async updateOrgMember(
    orgId: string,
    memberId: string,
    actor: { userId: string; fullName: string; roleName: string; ipAddress?: string },
    updates: {
      roleName?: string;
      roleId?: string;
      department?: string;
      jobTitle?: string;
      approvalLimitBWP?: number | null;
      mfaEnabled?: boolean;
      conflictDeclared?: boolean;
    }
  ) {
    if (!UUID_REGEX.test(memberId)) {
      const err: any = new Error('Invalid member ID.');
      err.status = 400;
      throw err;
    }

    const [hasLimitCol, hasConflictCol] = await Promise.all([
      hasOrgMemberColumn('approval_limit_bwp'),
      hasOrgMemberColumn('conflict_declared'),
    ]);

    return tx(async (client) => {
      const existingRes = await client.query<{
        id: string;
        user_id: string;
        is_owner: boolean;
        full_name: string;
        email: string;
      }>(
        `SELECT om.id, om.user_id, om.is_owner, u.full_name, u.email::text AS email
         FROM organization_members om
         JOIN users u ON u.id = om.user_id
         WHERE om.id = $1 AND om.organization_id = $2
         FOR UPDATE OF om`,
        [memberId, orgId]
      );
      if (!existingRes.rows.length) {
        const err: any = new Error('Organization member not found.');
        err.status = 404;
        throw err;
      }

      let resolvedRoleId: string | null = null;
      let resolvedRoleName: string | null = null;
      if (updates.roleId && UUID_REGEX.test(updates.roleId)) {
        const r = await client.query<{ id: string; name: string }>(
          `SELECT id, name FROM roles WHERE id = $1 AND scope = 'organization' AND (organization_id IS NULL OR organization_id = $2) LIMIT 1`,
          [updates.roleId, orgId]
        );
        if (r.rows[0]) {
          resolvedRoleId = r.rows[0].id;
          resolvedRoleName = r.rows[0].name;
        }
      } else if (updates.roleName) {
        const r = await client.query<{ id: string; name: string }>(
          `SELECT id, name FROM roles WHERE scope = 'organization' AND (organization_id IS NULL OR organization_id = $2) AND LOWER(name) = LOWER($1) LIMIT 1`,
          [updates.roleName.trim(), orgId]
        );
        if (r.rows[0]) {
          resolvedRoleId = r.rows[0].id;
          resolvedRoleName = r.rows[0].name;
        }
      }

      const setClauses: string[] = ['updated_at = NOW()'];
      const params: any[] = [memberId, orgId];
      let idx = 3;

      if (resolvedRoleId) {
        setClauses.push(`role_id = $${idx++}`);
        params.push(resolvedRoleId);
      }
      if (updates.department !== undefined) {
        setClauses.push(`department = $${idx++}`);
        params.push(String(updates.department).trim().slice(0, 128) || null);
      }
      if (updates.jobTitle !== undefined) {
        setClauses.push(`job_title = $${idx++}`);
        params.push(String(updates.jobTitle).trim().slice(0, 128) || null);
      }
      if (updates.mfaEnabled !== undefined) {
        setClauses.push(`mfa_enforced = $${idx++}`);
        params.push(Boolean(updates.mfaEnabled));
      }
      if (hasLimitCol && updates.approvalLimitBWP !== undefined) {
        const val =
          updates.approvalLimitBWP === null || updates.approvalLimitBWP === ('' as any)
            ? null
            : Math.max(0, Number(updates.approvalLimitBWP));
        setClauses.push(`approval_limit_bwp = $${idx++}`);
        params.push(val !== null && !isNaN(val) ? val : null);
      }
      if (hasConflictCol && updates.conflictDeclared !== undefined) {
        setClauses.push(`conflict_declared = $${idx++}`);
        params.push(Boolean(updates.conflictDeclared));
      }

      await client.query(
        `UPDATE organization_members
         SET ${setClauses.join(', ')}
         WHERE id = $1 AND organization_id = $2`,
        params
      );

      await auditRepository.logEvent(
        {
          actorName: actor.fullName,
          actorRole: actor.roleName,
          actorUserId: actor.userId,
          organizationId: orgId,
          action: 'Team Member Updated',
          entityType: 'Organization',
          entityId: memberId,
          ipAddress: actor.ipAddress,
          details: `Updated officer ${existingRes.rows[0].full_name} (${existingRes.rows[0].email})${resolvedRoleName ? ` — Role: ${resolvedRoleName}` : ''}.`,
        },
        client
      );
    });
  }

  async updateOrgMemberStatus(
    orgId: string,
    memberId: string,
    actor: { userId: string; fullName: string; roleName: string; ipAddress?: string },
    status: 'active' | 'suspended',
    reason?: string
  ) {
    if (!UUID_REGEX.test(memberId)) {
      const err: any = new Error('Invalid member ID.');
      err.status = 400;
      throw err;
    }

    return tx(async (client) => {
      const existingRes = await client.query<{ id: string; user_id: string; is_owner: boolean; full_name: string }>(
        `SELECT om.id, om.user_id, om.is_owner, u.full_name
         FROM organization_members om
         JOIN users u ON u.id = om.user_id
         WHERE om.id = $1 AND om.organization_id = $2
         FOR UPDATE OF om`,
        [memberId, orgId]
      );
      if (!existingRes.rows.length) {
        const err: any = new Error('Organization member not found.');
        err.status = 404;
        throw err;
      }
      const target = existingRes.rows[0];
      if (status === 'suspended' && (target.user_id === actor.userId || target.is_owner)) {
        const err: any = new Error('You cannot suspend your own account or the organization primary owner.');
        err.status = 400;
        throw err;
      }

      await client.query(
        `UPDATE organization_members SET status = $3, updated_at = NOW() WHERE id = $1 AND organization_id = $2`,
        [memberId, orgId, status]
      );

      await auditRepository.logEvent(
        {
          actorName: actor.fullName,
          actorRole: actor.roleName,
          actorUserId: actor.userId,
          organizationId: orgId,
          action: status === 'suspended' ? 'Team Member Suspended' : 'Team Member Reactivated',
          entityType: 'Organization',
          entityId: memberId,
          ipAddress: actor.ipAddress,
          details: `${status === 'suspended' ? 'Suspended' : 'Reactivated'} ${target.full_name}${reason ? `. Reason: ${reason.trim()}` : ''}.`,
        },
        client
      );
    });
  }

  async removeOrgMember(
    orgId: string,
    memberId: string,
    actor: { userId: string; fullName: string; roleName: string; ipAddress?: string }
  ) {
    if (!UUID_REGEX.test(memberId)) {
      const err: any = new Error('Invalid member ID.');
      err.status = 400;
      throw err;
    }

    return tx(async (client) => {
      const existingRes = await client.query<{ id: string; user_id: string; is_owner: boolean; full_name: string }>(
        `SELECT om.id, om.user_id, om.is_owner, u.full_name
         FROM organization_members om
         JOIN users u ON u.id = om.user_id
         WHERE om.id = $1 AND om.organization_id = $2
         FOR UPDATE OF om`,
        [memberId, orgId]
      );
      if (!existingRes.rows.length) {
        const err: any = new Error('Organization member not found.');
        err.status = 404;
        throw err;
      }
      const target = existingRes.rows[0];
      if (target.user_id === actor.userId || target.is_owner) {
        const err: any = new Error('Cannot remove your own membership or the organization owner.');
        err.status = 400;
        throw err;
      }

      await client.query(
        `UPDATE organization_members SET status = 'removed', updated_at = NOW() WHERE id = $1 AND organization_id = $2`,
        [memberId, orgId]
      );

      await auditRepository.logEvent(
        {
          actorName: actor.fullName,
          actorRole: actor.roleName,
          actorUserId: actor.userId,
          organizationId: orgId,
          action: 'Team Member Removed',
          entityType: 'Organization',
          entityId: memberId,
          ipAddress: actor.ipAddress,
          details: `Removed officer ${target.full_name} from organization workspace.`,
        },
        client
      );
    });
  }

  async revokeOrgInvitation(
    orgId: string,
    invitationId: string,
    actor: { userId: string; fullName: string; roleName: string; ipAddress?: string }
  ) {
    if (!UUID_REGEX.test(invitationId)) {
      const err: any = new Error('Invalid invitation ID.');
      err.status = 400;
      throw err;
    }
    const res = await query<{ id: string; email: string }>(
      `UPDATE invitations
       SET revoked_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND accepted_at IS NULL AND revoked_at IS NULL
       RETURNING id, email::text AS email`,
      [invitationId, orgId]
    );
    if (!res.rows.length) {
      const err: any = new Error('Pending invitation not found.');
      err.status = 404;
      throw err;
    }
    await auditRepository.logEvent({
      actorName: actor.fullName,
      actorRole: actor.roleName,
      actorUserId: actor.userId,
      organizationId: orgId,
      action: 'Team Invitation Revoked',
      entityType: 'Organization',
      entityId: invitationId,
      ipAddress: actor.ipAddress,
      details: `Revoked pending invitation for ${res.rows[0].email}.`,
    });
  }

  async resendOrgInvitation(
    orgId: string,
    invitationId: string,
    actor: { userId: string; fullName: string; roleName: string; ipAddress?: string }
  ) {
    if (!UUID_REGEX.test(invitationId)) {
      const err: any = new Error('Invalid invitation ID.');
      err.status = 400;
      throw err;
    }

    return tx(async (client) => {
      const invRes = await client.query<{
        id: string;
        email: string;
        role_name: string;
        org_name: string;
      }>(
        `SELECT i.id, i.email::text AS email, r.name AS role_name, o.name AS org_name
         FROM invitations i
         JOIN roles r ON r.id = i.role_id
         JOIN organizations o ON o.id = i.organization_id
         WHERE i.id = $1 AND i.organization_id = $2 AND i.accepted_at IS NULL AND i.revoked_at IS NULL
         FOR UPDATE OF i`,
        [invitationId, orgId]
      );
      if (!invRes.rows.length) {
        const err: any = new Error('Pending invitation not found or already closed.');
        err.status = 404;
        throw err;
      }

      const rawToken = generateRandomToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await client.query(
        `UPDATE invitations SET token_hash = $3, expires_at = $4 WHERE id = $1 AND organization_id = $2`,
        [invitationId, orgId, tokenHash, expiresAt]
      );

      await notificationsRepository.queueEmailDelivery(
        {
          recipientEmail: invRes.rows[0].email,
          templateCode: 'team_invitation',
          organizationId: orgId,
          vars: {
            tenantName: invRes.rows[0].org_name,
            inviterName: actor.fullName,
            roleName: invRes.rows[0].role_name,
            expiresAt: expiresAt.toISOString().slice(0, 10),
          },
        },
        client
      );

      return {
        id: invitationId,
        email: invRes.rows[0].email,
        expiresAt: expiresAt.toISOString(),
        inviteToken: rawToken,
      };
    });
  }

  // =========================================================================
  // 2. ORGANIZATION BRANDING
  // =========================================================================
  async getBranding(orgId: string) {
    const res = await query<any>(
      `SELECT id,
              name,
              slug,
              COALESCE(brand_subtext, 'Procurement & Asset Disposal Board') AS "brandSubtext",
              COALESCE(brand_primary_color, '#1F5F99') AS "brandPrimaryColor",
              COALESCE(custom_domain, '') AS "customDomain",
              COALESCE(contact_email::text, '') AS "contactEmail",
              COALESCE(contact_phone, '') AS "contactPhone",
              COALESCE(physical_address, '') AS "physicalAddress",
              COALESCE(city, '') AS city,
              COALESCE(settings->>'welcomeNotice', '') AS "welcomeNotice"
       FROM organizations
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [orgId]
    );
    return res.rows[0] || null;
  }

  async updateBranding(
    orgId: string,
    actor: { userId: string; fullName: string; roleName: string; ipAddress?: string },
    input: {
      name?: string;
      brandSubtext?: string;
      brandPrimaryColor?: string;
      customDomain?: string;
      contactEmail?: string;
      contactPhone?: string;
      welcomeNotice?: string;
    }
  ) {
    const cleanName = String(input.name || '').trim().slice(0, 255);
    if (!cleanName) {
      const err: any = new Error('Official entity name is required.');
      err.status = 400;
      throw err;
    }

    const color = String(input.brandPrimaryColor || '#1F5F99').trim();
    if (!HEX_COLOR_REGEX.test(color)) {
      const err: any = new Error('Primary theme accent must be a valid 6-digit hex color (e.g. #1F5F99).');
      err.status = 400;
      throw err;
    }

    const subtext = String(input.brandSubtext || '').trim().slice(0, 255);
    const customDomain = String(input.customDomain || '').trim().toLowerCase().slice(0, 255) || null;
    if (customDomain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(customDomain)) {
      const err: any = new Error('Custom domain must be a valid hostname (e.g. tenders.council.gov.bw).');
      err.status = 400;
      throw err;
    }

    const welcomeNotice = String(input.welcomeNotice || '').trim().slice(0, 500);
    const contactEmail = input.contactEmail ? String(input.contactEmail).trim().toLowerCase().slice(0, 200) : null;
    const contactPhone = input.contactPhone ? String(input.contactPhone).trim().slice(0, 32) : null;

    await query(
      `UPDATE organizations
       SET name = $2,
           brand_subtext = $3,
           brand_primary_color = $4,
           custom_domain = $5,
           contact_email = COALESCE($6, contact_email),
           contact_phone = COALESCE($7, contact_phone),
           settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('welcomeNotice', $8::text),
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [orgId, cleanName, subtext, color, customDomain, contactEmail, contactPhone, welcomeNotice]
    );

    await auditRepository.logEvent({
      actorName: actor.fullName,
      actorRole: actor.roleName,
      actorUserId: actor.userId,
      organizationId: orgId,
      organizationName: cleanName,
      action: 'Organization Branding Updated',
      entityType: 'Organization',
      entityId: orgId,
      ipAddress: actor.ipAddress,
      details: `Updated branding profile: name="${cleanName}", accent=${color}, subtext="${subtext}".`,
    });

    return this.getBranding(orgId);
  }

  // =========================================================================
  // 3. ORGANIZATION SETTINGS (organization_settings)
  // =========================================================================
  async getSettings(orgId: string) {
    const res = await query<{ setting_key: string; setting_value: any }>(
      `SELECT setting_key, setting_value
       FROM organization_settings
       WHERE organization_id = $1`,
      [orgId]
    );
    const map = new Map(res.rows.map((r) => [r.setting_key, r.setting_value]));

    return {
      minRfpAdvertisingDays: Number(map.get('min_rfp_advertising_days') ?? 21),
      defaultCurrency: String(map.get('default_currency') ?? 'BWP'),
      defaultClosingTimeCat: String(map.get('default_closing_time_cat') ?? '14:00'),
      clarificationCutoffDays: Number(map.get('clarification_cutoff_days') ?? 7),
      requireGazetteNotice: Boolean(map.get('require_gazette_notice') ?? true),
      autoDeadlineReminders: Boolean(map.get('auto_deadline_reminders') ?? true),
      requireMfaEvaluators: Boolean(map.get('require_mfa_evaluators') ?? true),
    };
  }

  async updateSettings(
    orgId: string,
    actor: { userId: string; fullName: string; roleName: string; ipAddress?: string },
    input: {
      minRfpAdvertisingDays?: number;
      defaultCurrency?: string;
      defaultClosingTimeCat?: string;
      clarificationCutoffDays?: number;
      requireGazetteNotice?: boolean;
      autoDeadlineReminders?: boolean;
      requireMfaEvaluators?: boolean;
    }
  ) {
    const minDays = Number(input.minRfpAdvertisingDays ?? 21);
    if (!Number.isFinite(minDays) || minDays < 7 || minDays > 90) {
      const err: any = new Error('Minimum advertising period must be between 7 and 90 days.');
      err.status = 400;
      throw err;
    }

    const cutoffDays = Number(input.clarificationCutoffDays ?? 7);
    if (!Number.isFinite(cutoffDays) || cutoffDays < 1 || cutoffDays > 30) {
      const err: any = new Error('Clarification cut-off must be between 1 and 30 days before closing.');
      err.status = 400;
      throw err;
    }

    const closingTime = String(input.defaultClosingTimeCat || '14:00').trim();
    if (!/^\d{2}:\d{2}$/.test(closingTime)) {
      const err: any = new Error('Default closing time must use HH:MM format.');
      err.status = 400;
      throw err;
    }

    const currency = String(input.defaultCurrency || 'BWP').trim().toUpperCase().slice(0, 6);
    const entries: { key: string; value: any; type: string; desc: string }[] = [
      { key: 'min_rfp_advertising_days', value: minDays, type: 'number', desc: 'Minimum advertising period for competitive RFPs (days)' },
      { key: 'default_currency', value: currency, type: 'string', desc: 'Default procurement currency' },
      { key: 'default_closing_time_cat', value: closingTime, type: 'string', desc: 'Default tender closing time (CAT)' },
      { key: 'clarification_cutoff_days', value: cutoffDays, type: 'number', desc: 'Days before closing when clarification questions close' },
      { key: 'require_gazette_notice', value: Boolean(input.requireGazetteNotice ?? true), type: 'boolean', desc: 'Require statutory gazette notice reference on RFPs' },
      { key: 'auto_deadline_reminders', value: Boolean(input.autoDeadlineReminders ?? true), type: 'boolean', desc: 'Send automated tender closing reminders to bidders' },
      { key: 'require_mfa_evaluators', value: Boolean(input.requireMfaEvaluators ?? true), type: 'boolean', desc: 'Require MFA for evaluation panel scoring sessions' },
    ];

    await tx(async (client) => {
      for (const item of entries) {
        await client.query(
          `INSERT INTO organization_settings (
             organization_id, setting_key, setting_value, setting_type, description, updated_by_user_id, updated_at
           ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, NOW())
           ON CONFLICT (organization_id, setting_key) DO UPDATE
           SET setting_value = EXCLUDED.setting_value,
               setting_type = EXCLUDED.setting_type,
               description = EXCLUDED.description,
               updated_by_user_id = EXCLUDED.updated_by_user_id,
               updated_at = NOW()`,
          [orgId, item.key, JSON.stringify(item.value), item.type, item.desc, actor.userId]
        );
      }

      await auditRepository.logEvent(
        {
          actorName: actor.fullName,
          actorRole: actor.roleName,
          actorUserId: actor.userId,
          organizationId: orgId,
          action: 'Organization Settings Updated',
          entityType: 'Organization',
          entityId: orgId,
          ipAddress: actor.ipAddress,
          details: `Updated council procurement settings: minDays=${minDays}, cutoff=${cutoffDays}d, closingTime=${closingTime} CAT, currency=${currency}.`,
        },
        client
      );
    });

    return this.getSettings(orgId);
  }

  // =========================================================================
  // 4. FORM TEMPLATES & FIELDS
  // =========================================================================
  async listFormTemplates(orgId: string) {
    const res = await query<any>(
      `SELECT ft.id,
              ft.organization_id AS "organizationId",
              ft.name AS title,
              ft.purpose,
              COALESCE(ft.description, '') AS description,
              ft.status,
              ft.updated_at AS "updatedAt",
              v.id AS "versionId",
              v.version_no AS "versionNo",
              COALESCE(v.label, 'v' || v.version_no::text || '.0') AS version,
              v.schema_json AS "schemaJson"
       FROM form_templates ft
       LEFT JOIN LATERAL (
         SELECT id, version_no, label, schema_json
         FROM form_template_versions
         WHERE template_id = ft.id
         ORDER BY version_no DESC
         LIMIT 1
       ) v ON TRUE
       WHERE ft.organization_id = $1 AND ft.status != 'archived'
       ORDER BY ft.updated_at DESC`,
      [orgId]
    );

    const versionIds = res.rows.map((r: any) => r.versionId).filter(Boolean);
    const fieldsByVersion = new Map<string, any[]>();

    if (versionIds.length > 0) {
      const fieldsRes = await query<any>(
        `SELECT id,
                form_version_id AS "formVersionId",
                field_key AS "fieldKey",
                label,
                field_type AS type,
                is_required AS required,
                placeholder,
                help_text AS "helpText",
                options,
                sort_order AS "sortOrder"
         FROM form_fields
         WHERE form_version_id = ANY($1::uuid[])
         ORDER BY sort_order ASC, created_at ASC`,
        [versionIds]
      );
      for (const f of fieldsRes.rows) {
        const list = fieldsByVersion.get(f.formVersionId) || [];
        list.push({
          id: f.id,
          label: f.label,
          type: f.type,
          required: Boolean(f.required),
          placeholder: f.placeholder || '',
          helpText: f.helpText || '',
          options: Array.isArray(f.options) ? f.options : undefined,
        });
        fieldsByVersion.set(f.formVersionId, list);
      }
    }

    return res.rows.map((r: any) => {
      const dbFields = r.versionId ? fieldsByVersion.get(r.versionId) : undefined;
      const schemaFields = Array.isArray(r.schemaJson?.fields) ? r.schemaJson.fields : [];
      return {
        id: r.id,
        organizationId: r.organizationId,
        title: r.title,
        purpose: r.purpose,
        description: r.description,
        version: r.version,
        versionNo: r.versionNo || 1,
        updatedAt: r.updatedAt,
        fields: dbFields && dbFields.length > 0 ? dbFields : schemaFields,
      };
    });
  }

  async createFormTemplate(
    orgId: string,
    actor: { userId: string; fullName: string; roleName: string; ipAddress?: string },
    input: {
      title: string;
      purpose?: 'registration' | 'eoi' | 'rfp_questionnaire' | 'other';
      description?: string;
      version?: string;
      fields: any[];
    }
  ) {
    const title = String(input.title || '').trim().slice(0, 200);
    if (!title) {
      const err: any = new Error('Form template title is required.');
      err.status = 400;
      throw err;
    }

    const purpose = ['registration', 'eoi', 'rfp_questionnaire', 'other'].includes(String(input.purpose))
      ? String(input.purpose)
      : 'rfp_questionnaire';
    const description = String(input.description || '').trim().slice(0, 500);
    const versionLabel = String(input.version || 'v1.0').trim().slice(0, 100);
    const fields = Array.isArray(input.fields) ? input.fields : [];

    return tx(async (client) => {
      const tplRes = await client.query<{ id: string }>(
        `INSERT INTO form_templates (organization_id, name, purpose, description, status, created_by_user_id)
         VALUES ($1, $2, $3, $4, 'active', $5)
         RETURNING id`,
        [orgId, title, purpose, description || null, actor.userId]
      );
      const templateId = tplRes.rows[0].id;

      const verRes = await client.query<{ id: string }>(
        `INSERT INTO form_template_versions (
           template_id, version_no, label, schema_json, status, published_by_user_id, published_at
         ) VALUES ($1, 1, $2, $3::jsonb, 'published', $4, NOW())
         RETURNING id`,
        [templateId, versionLabel, JSON.stringify({ fields }), actor.userId]
      );
      const versionId = verRes.rows[0].id;

      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        const safeType = ALLOWED_FIELD_TYPES.has(String(f.type)) ? String(f.type) : 'text';
        const fieldKey = `field_${i + 1}_${String(f.label || 'q').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}`;
        await client.query(
          `INSERT INTO form_fields (
             form_version_id, field_key, label, field_type, is_required, placeholder, help_text, options, sort_order
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
          [
            versionId,
            fieldKey,
            String(f.label || `Question ${i + 1}`).trim().slice(0, 255),
            safeType,
            Boolean(f.required),
            f.placeholder ? String(f.placeholder).slice(0, 255) : null,
            f.helpText ? String(f.helpText).slice(0, 1000) : null,
            Array.isArray(f.options) ? JSON.stringify(f.options) : null,
            i,
          ]
        );
      }

      await auditRepository.logEvent(
        {
          actorName: actor.fullName,
          actorRole: actor.roleName,
          actorUserId: actor.userId,
          organizationId: orgId,
          action: 'Form Template Created',
          entityType: 'FormTemplate',
          entityId: templateId,
          ipAddress: actor.ipAddress,
          details: `Created tender form template "${title}" (${versionLabel}) with ${fields.length} fields.`,
        },
        client
      );

      return templateId;
    });
  }

  async updateFormTemplate(
    orgId: string,
    templateId: string,
    actor: { userId: string; fullName: string; roleName: string; ipAddress?: string },
    input: {
      title?: string;
      description?: string;
      version?: string;
      fields: any[];
    }
  ) {
    if (!UUID_REGEX.test(templateId)) {
      const err: any = new Error('Invalid form template ID.');
      err.status = 400;
      throw err;
    }

    const fields = Array.isArray(input.fields) ? input.fields : [];

    await tx(async (client) => {
      const existing = await client.query<{ id: string; name: string }>(
        `SELECT id, name FROM form_templates WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [templateId, orgId]
      );
      if (!existing.rows.length) {
        const err: any = new Error('Form template not found for your organization.');
        err.status = 404;
        throw err;
      }

      const nextTitle = input.title ? String(input.title).trim().slice(0, 200) : existing.rows[0].name;
      const nextDesc = input.description !== undefined ? String(input.description).trim().slice(0, 500) : undefined;

      await client.query(
        `UPDATE form_templates
         SET name = $3,
             description = COALESCE($4, description),
             updated_at = NOW()
         WHERE id = $1 AND organization_id = $2`,
        [templateId, orgId, nextTitle, nextDesc !== undefined ? nextDesc : null]
      );

      const maxVerRes = await client.query<{ max_ver: number }>(
        `SELECT COALESCE(MAX(version_no), 0)::int AS max_ver FROM form_template_versions WHERE template_id = $1`,
        [templateId]
      );
      const nextVersionNo = (maxVerRes.rows[0]?.max_ver || 0) + 1;
      const versionLabel = String(input.version || `v${nextVersionNo}.0`).trim().slice(0, 100);

      const verRes = await client.query<{ id: string }>(
        `INSERT INTO form_template_versions (
           template_id, version_no, label, schema_json, status, published_by_user_id, published_at
         ) VALUES ($1, $2, $3, $4::jsonb, 'published', $5, NOW())
         RETURNING id`,
        [templateId, nextVersionNo, versionLabel, JSON.stringify({ fields }), actor.userId]
      );
      const versionId = verRes.rows[0].id;

      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        const safeType = ALLOWED_FIELD_TYPES.has(String(f.type)) ? String(f.type) : 'text';
        const fieldKey = `field_${i + 1}_${String(f.label || 'q').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40)}`;
        await client.query(
          `INSERT INTO form_fields (
             form_version_id, field_key, label, field_type, is_required, placeholder, help_text, options, sort_order
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
          [
            versionId,
            fieldKey,
            String(f.label || `Question ${i + 1}`).trim().slice(0, 255),
            safeType,
            Boolean(f.required),
            f.placeholder ? String(f.placeholder).slice(0, 255) : null,
            f.helpText ? String(f.helpText).slice(0, 1000) : null,
            Array.isArray(f.options) ? JSON.stringify(f.options) : null,
            i,
          ]
        );
      }

      await auditRepository.logEvent(
        {
          actorName: actor.fullName,
          actorRole: actor.roleName,
          actorUserId: actor.userId,
          organizationId: orgId,
          action: 'Form Template Version Published',
          entityType: 'FormTemplate',
          entityId: templateId,
          ipAddress: actor.ipAddress,
          details: `Published revision #${nextVersionNo} (${versionLabel}) for form template "${nextTitle}" (${fields.length} fields).`,
        },
        client
      );
    });
  }

  async deleteFormTemplate(
    orgId: string,
    templateId: string,
    actor: { userId: string; fullName: string; roleName: string; ipAddress?: string }
  ) {
    if (!UUID_REGEX.test(templateId)) {
      const err: any = new Error('Invalid form template ID.');
      err.status = 400;
      throw err;
    }
    const res = await query<{ id: string; name: string }>(
      `UPDATE form_templates SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING id, name`,
      [templateId, orgId]
    );
    if (!res.rows.length) {
      const err: any = new Error('Form template not found.');
      err.status = 404;
      throw err;
    }
    await auditRepository.logEvent({
      actorName: actor.fullName,
      actorRole: actor.roleName,
      actorUserId: actor.userId,
      organizationId: orgId,
      action: 'Form Template Archived',
      entityType: 'FormTemplate',
      entityId: templateId,
      ipAddress: actor.ipAddress,
      details: `Archived form template "${res.rows[0].name}".`,
    });
  }

  // =========================================================================
  // 5. WORKFLOWS & SCORING TEMPLATES
  // =========================================================================
  async getWorkflowsAndScoring(orgId: string) {
    const [stagesRes, settingsRes, roles] = await Promise.all([
      query<any>(
        `SELECT ws.id,
                ws.applies_to AS "appliesTo",
                ws.name,
                ws.sequence_no AS "sequenceNo",
                ws.stage_type AS "stageType",
                ws.required_role_id AS "requiredRoleId",
                r.name AS "requiredRoleName",
                ws.sla_days AS "slaDays",
                ws.created_at AS "createdAt"
         FROM workflow_stages ws
         LEFT JOIN roles r ON r.id = ws.required_role_id
         WHERE ws.organization_id = $1
         ORDER BY ws.applies_to ASC, ws.sequence_no ASC`,
        [orgId]
      ),
      query<{ setting_value: any }>(
        `SELECT setting_value FROM organization_settings
         WHERE organization_id = $1 AND setting_key = 'scoring_templates'
         LIMIT 1`,
        [orgId]
      ),
      this.listOrgRoles(orgId),
    ]);

    const storedTemplates = settingsRes.rows[0]?.setting_value;
    const scoringTemplates: ScoringTemplateConfig[] =
      Array.isArray(storedTemplates) && storedTemplates.length > 0 ? storedTemplates : DEFAULT_SCORING_TEMPLATES;

    return {
      stages: stagesRes.rows,
      scoringTemplates,
      roles,
    };
  }

  async createWorkflowStage(
    orgId: string,
    actor: { userId: string; fullName: string; roleName: string; ipAddress?: string },
    input: {
      appliesTo: 'registration' | 'eoi' | 'rfp';
      name: string;
      sequenceNo: number;
      stageType: 'review' | 'approval';
      requiredRoleId?: string | null;
      slaDays?: number | null;
    }
  ) {
    const appliesTo = ['registration', 'eoi', 'rfp'].includes(input.appliesTo) ? input.appliesTo : 'rfp';
    const stageType = ['review', 'approval'].includes(input.stageType) ? input.stageType : 'review';
    const name = String(input.name || '').trim().slice(0, 100);
    if (!name) {
      const err: any = new Error('Workflow stage name is required.');
      err.status = 400;
      throw err;
    }
    const seq = Math.max(1, Math.min(20, Number(input.sequenceNo) || 1));
    const safeRoleId = input.requiredRoleId && UUID_REGEX.test(input.requiredRoleId) ? input.requiredRoleId : null;
    const slaDays =
      input.slaDays !== undefined && input.slaDays !== null && !isNaN(Number(input.slaDays))
        ? Math.max(1, Math.min(90, Number(input.slaDays)))
        : null;

    const ins = await query<{ id: string }>(
      `INSERT INTO workflow_stages (organization_id, applies_to, name, sequence_no, stage_type, required_role_id, sla_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [orgId, appliesTo, name, seq, stageType, safeRoleId, slaDays]
    );

    await auditRepository.logEvent({
      actorName: actor.fullName,
      actorRole: actor.roleName,
      actorUserId: actor.userId,
      organizationId: orgId,
      action: 'Workflow Stage Configured',
      entityType: 'Organization',
      entityId: ins.rows[0].id,
      ipAddress: actor.ipAddress,
      details: `Added ${appliesTo.toUpperCase()} workflow stage #${seq}: "${name}" (${stageType}).`,
    });

    return ins.rows[0].id;
  }

  async deleteWorkflowStage(
    orgId: string,
    stageId: string,
    actor: { userId: string; fullName: string; roleName: string; ipAddress?: string }
  ) {
    if (!UUID_REGEX.test(stageId)) {
      const err: any = new Error('Invalid stage ID.');
      err.status = 400;
      throw err;
    }
    const res = await query<{ id: string; name: string }>(
      `DELETE FROM workflow_stages WHERE id = $1 AND organization_id = $2 RETURNING id, name`,
      [stageId, orgId]
    );
    if (!res.rows.length) {
      const err: any = new Error('Workflow stage not found.');
      err.status = 404;
      throw err;
    }
    await auditRepository.logEvent({
      actorName: actor.fullName,
      actorRole: actor.roleName,
      actorUserId: actor.userId,
      organizationId: orgId,
      action: 'Workflow Stage Removed',
      entityType: 'Organization',
      entityId: stageId,
      ipAddress: actor.ipAddress,
      details: `Removed workflow stage "${res.rows[0].name}".`,
    });
  }

  async saveScoringTemplates(
    orgId: string,
    actor: { userId: string; fullName: string; roleName: string; ipAddress?: string },
    templates: ScoringTemplateConfig[]
  ) {
    if (!Array.isArray(templates) || templates.length === 0) {
      const err: any = new Error('At least one scoring template is required.');
      err.status = 400;
      throw err;
    }

    const sanitized: ScoringTemplateConfig[] = templates.map((t, idx) => {
      const name = String(t.name || `Template ${idx + 1}`).trim().slice(0, 150);
      const criteria = Array.isArray(t.criteria)
        ? t.criteria.map((c, cIdx) => ({
            id: String(c.id || `crit-${idx}-${cIdx}`),
            label: String(c.label || `Criterion ${cIdx + 1}`).trim().slice(0, 150),
            weightPercent: c.passFail ? null : Math.max(0, Math.min(100, Number(c.weightPercent) || 0)),
            passFail: Boolean(c.passFail),
          }))
        : [];
      return {
        id: String(t.id || `tpl-${Date.now()}-${idx}`),
        name,
        badge: String(t.badge || 'Custom Template').trim().slice(0, 80),
        method: ['qcbs', 'least_cost', 'custom'].includes(t.method) ? t.method : 'custom',
        isActive: t.isActive !== false,
        criteria,
      };
    });

    await query(
      `INSERT INTO organization_settings (
         organization_id, setting_key, setting_value, setting_type, description, updated_by_user_id, updated_at
       ) VALUES ($1, 'scoring_templates', $2::jsonb, 'array', 'Evaluation scoring matrices and criteria templates', $3, NOW())
       ON CONFLICT (organization_id, setting_key) DO UPDATE
       SET setting_value = EXCLUDED.setting_value,
           updated_by_user_id = EXCLUDED.updated_by_user_id,
           updated_at = NOW()`,
      [orgId, JSON.stringify(sanitized), actor.userId]
    );

    await auditRepository.logEvent({
      actorName: actor.fullName,
      actorRole: actor.roleName,
      actorUserId: actor.userId,
      organizationId: orgId,
      action: 'Scoring Templates Saved',
      entityType: 'Organization',
      entityId: orgId,
      ipAddress: actor.ipAddress,
      details: `Updated ${sanitized.length} evaluation scoring template(s) for organization workspace.`,
    });

    return sanitized;
  }

  // =========================================================================
  // 6. INTEGRATIONS (api_clients & webhook_endpoints)
  // =========================================================================
  async getIntegrations(orgId: string) {
    const [clientsRes, webhooksRes] = await Promise.all([
      query<any>(
        `SELECT ac.id,
                ac.name,
                ac.key_prefix AS "keyPrefix",
                ac.scopes,
                ac.last_used_at AS "lastUsedAt",
                ac.revoked_at AS "revokedAt",
                ac.created_at AS "createdAt",
                COALESCE(u.full_name, 'Admin') AS "createdByName"
         FROM api_clients ac
         LEFT JOIN users u ON u.id = ac.created_by_user_id
         WHERE ac.organization_id = $1
         ORDER BY ac.created_at DESC`,
        [orgId]
      ),
      query<any>(
        `SELECT id,
                url,
                event_types AS "eventTypes",
                is_active AS "isActive",
                created_at AS "createdAt"
         FROM webhook_endpoints
         WHERE organization_id = $1
         ORDER BY created_at DESC`,
        [orgId]
      ),
    ]);

    return {
      apiClients: clientsRes.rows,
      webhooks: webhooksRes.rows,
    };
  }

  async createApiClient(
    orgId: string,
    actor: { userId: string; fullName: string; roleName: string; ipAddress?: string },
    input: { name: string; scopes?: string[] }
  ) {
    const name = String(input.name || '').trim().slice(0, 150);
    if (!name) {
      const err: any = new Error('API client name is required.');
      err.status = 400;
      throw err;
    }

    const rawSecret = `br360_${crypto.randomBytes(24).toString('hex')}`;
    const keyPrefix = rawSecret.slice(0, 12);
    const keyHash = crypto.createHash('sha256').update(rawSecret).digest('hex');
    const scopes = Array.isArray(input.scopes) && input.scopes.length > 0
      ? input.scopes.map((s) => String(s).trim()).filter(Boolean)
      : ['calls.read', 'awards.read', 'applications.read'];

    const res = await query<any>(
      `INSERT INTO api_clients (organization_id, name, key_prefix, key_hash, scopes, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING id, name, key_prefix AS "keyPrefix", scopes, created_at AS "createdAt"`,
      [orgId, name, keyPrefix, keyHash, JSON.stringify(scopes), actor.userId]
    );

    await auditRepository.logEvent({
      actorName: actor.fullName,
      actorRole: actor.roleName,
      actorUserId: actor.userId,
      organizationId: orgId,
      action: 'API Client Key Created',
      entityType: 'ApiClient',
      entityId: res.rows[0].id,
      ipAddress: actor.ipAddress,
      details: `Issued new API integration key "${name}" (${keyPrefix}...) with scopes: ${scopes.join(', ')}.`,
    });

    return {
      ...res.rows[0],
      plainKeyOnce: rawSecret,
    };
  }

  async revokeApiClient(
    orgId: string,
    clientId: string,
    actor: { userId: string; fullName: string; roleName: string; ipAddress?: string }
  ) {
    if (!UUID_REGEX.test(clientId)) {
      const err: any = new Error('Invalid API client ID.');
      err.status = 400;
      throw err;
    }
    const res = await query<{ id: string; name: string }>(
      `UPDATE api_clients SET revoked_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND revoked_at IS NULL
       RETURNING id, name`,
      [clientId, orgId]
    );
    if (!res.rows.length) {
      const err: any = new Error('Active API key not found.');
      err.status = 404;
      throw err;
    }
    await auditRepository.logEvent({
      actorName: actor.fullName,
      actorRole: actor.roleName,
      actorUserId: actor.userId,
      organizationId: orgId,
      action: 'API Client Key Revoked',
      entityType: 'ApiClient',
      entityId: clientId,
      ipAddress: actor.ipAddress,
      details: `Revoked API integration key "${res.rows[0].name}".`,
    });
  }

  async saveWebhookEndpoint(
    orgId: string,
    actor: { userId: string; fullName: string; roleName: string; ipAddress?: string },
    input: { id?: string; url: string; eventTypes?: string[]; isActive?: boolean }
  ) {
    const safeUrl = validateSafeWebhookUrl(input.url);
    const eventTypes =
      Array.isArray(input.eventTypes) && input.eventTypes.length > 0
        ? input.eventTypes.map((e) => String(e).trim()).filter(Boolean)
        : ['award.approved', 'application.submitted', 'bid.opened'];

    if (input.id && UUID_REGEX.test(input.id)) {
      const upd = await query<any>(
        `UPDATE webhook_endpoints
         SET url = $3, event_types = $4::jsonb, is_active = $5
         WHERE id = $1 AND organization_id = $2
         RETURNING id, url, event_types AS "eventTypes", is_active AS "isActive", created_at AS "createdAt"`,
        [input.id, orgId, safeUrl, JSON.stringify(eventTypes), input.isActive !== false]
      );
      if (!upd.rows.length) {
        const err: any = new Error('Webhook endpoint not found.');
        err.status = 404;
        throw err;
      }
      await auditRepository.logEvent({
        actorName: actor.fullName,
        actorRole: actor.roleName,
        actorUserId: actor.userId,
        organizationId: orgId,
        action: 'Webhook Endpoint Updated',
        entityType: 'WebhookEndpoint',
        entityId: input.id,
        ipAddress: actor.ipAddress,
        details: `Updated outbound webhook endpoint to ${safeUrl} (${eventTypes.join(', ')}).`,
      });
      return upd.rows[0];
    }

    const signingSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
    const secretHash = crypto.createHash('sha256').update(signingSecret).digest('hex');

    const ins = await query<any>(
      `INSERT INTO webhook_endpoints (organization_id, url, secret_hash, event_types, is_active)
       VALUES ($1, $2, $3, $4::jsonb, TRUE)
       RETURNING id, url, event_types AS "eventTypes", is_active AS "isActive", created_at AS "createdAt"`,
      [orgId, safeUrl, secretHash, JSON.stringify(eventTypes)]
    );

    await auditRepository.logEvent({
      actorName: actor.fullName,
      actorRole: actor.roleName,
      actorUserId: actor.userId,
      organizationId: orgId,
      action: 'Webhook Endpoint Created',
      entityType: 'WebhookEndpoint',
      entityId: ins.rows[0].id,
      ipAddress: actor.ipAddress,
      details: `Registered outbound HTTPS webhook ${safeUrl} for events: ${eventTypes.join(', ')}.`,
    });

    return {
      ...ins.rows[0],
      signingSecretOnce: signingSecret,
    };
  }

  async deleteWebhookEndpoint(
    orgId: string,
    endpointId: string,
    actor: { userId: string; fullName: string; roleName: string; ipAddress?: string }
  ) {
    if (!UUID_REGEX.test(endpointId)) {
      const err: any = new Error('Invalid webhook endpoint ID.');
      err.status = 400;
      throw err;
    }
    const res = await query<{ id: string; url: string }>(
      `DELETE FROM webhook_endpoints WHERE id = $1 AND organization_id = $2 RETURNING id, url`,
      [endpointId, orgId]
    );
    if (!res.rows.length) {
      const err: any = new Error('Webhook endpoint not found.');
      err.status = 404;
      throw err;
    }
    await auditRepository.logEvent({
      actorName: actor.fullName,
      actorRole: actor.roleName,
      actorUserId: actor.userId,
      organizationId: orgId,
      action: 'Webhook Endpoint Removed',
      entityType: 'WebhookEndpoint',
      entityId: endpointId,
      ipAddress: actor.ipAddress,
      details: `Removed outbound webhook endpoint ${res.rows[0].url}.`,
    });
  }

  // =========================================================================
  // 7. ORGANIZATION BILLING, SUBSCRIPTION & USAGE
  // =========================================================================
  async getOrgBilling(orgId: string) {
    const [subRes, fallbackPlansRes, callsCountRes, seatsCountRes, invoicesRes] = await Promise.all([
      query<any>(
        `SELECT s.id,
                s.status,
                s.current_period_start AS "currentPeriodStart",
                s.current_period_end AS "currentPeriodEnd",
                s.trial_ends_at AS "trialEndsAt",
                p.id AS "planId",
                p.code AS "planCode",
                p.name AS "planName",
                p.price,
                p.currency,
                p.billing_interval AS "billingInterval",
                p.max_users AS "maxUsers",
                p.max_calls_per_year AS "maxCallsPerYear",
                p.features
         FROM subscriptions s
         JOIN plans p ON p.id = s.plan_id
         WHERE s.organization_id = $1
         ORDER BY (s.status = 'active') DESC, s.created_at DESC
         LIMIT 1`,
        [orgId]
      ),
      query<any>(
        `SELECT id, code, name, price, currency, billing_interval AS "billingInterval",
                max_users AS "maxUsers", max_calls_per_year AS "maxCallsPerYear", features
         FROM plans
         WHERE audience = 'buyer' AND is_active = TRUE
         ORDER BY sort_order ASC, price ASC`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM calls
         WHERE organization_id = $1
           AND created_at >= date_trunc('year', NOW())`,
        [orgId]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM organization_members
         WHERE organization_id = $1 AND status IN ('active', 'invited')`,
        [orgId]
      ),
      query<any>(
        `SELECT id,
                invoice_no AS "invoiceNumber",
                total::numeric AS amount,
                currency,
                status,
                issued_at AS "issuedAt",
                due_at AS "dueAt",
                paid_at AS "paidAt"
         FROM platform_invoices
         WHERE organization_id = $1
         ORDER BY created_at DESC
         LIMIT 25`,
        [orgId]
      ),
    ]);

    const sub = subRes.rows[0] || null;
    const defaultPlan = fallbackPlansRes.rows[0] || null;

    return {
      subscription: sub
        ? {
            id: sub.id,
            status: sub.status,
            currentPeriodStart: sub.currentPeriodStart,
            currentPeriodEnd: sub.currentPeriodEnd,
            planName: sub.planName,
            planCode: sub.planCode,
            price: Number(sub.price) || 0,
            currency: sub.currency || 'BWP',
            billingInterval: sub.billingInterval || 'monthly',
            maxUsers: sub.maxUsers !== null ? Number(sub.maxUsers) : null,
            maxCallsPerYear: sub.maxCallsPerYear !== null ? Number(sub.maxCallsPerYear) : null,
            features: sub.features || {},
          }
        : defaultPlan
        ? {
            id: null,
            status: 'trial',
            currentPeriodStart: null,
            currentPeriodEnd: null,
            planName: defaultPlan.name,
            planCode: defaultPlan.code,
            price: Number(defaultPlan.price) || 0,
            currency: defaultPlan.currency || 'BWP',
            billingInterval: defaultPlan.billingInterval || 'monthly',
            maxUsers: defaultPlan.maxUsers !== null ? Number(defaultPlan.maxUsers) : null,
            maxCallsPerYear: defaultPlan.maxCallsPerYear !== null ? Number(defaultPlan.maxCallsPerYear) : null,
            features: defaultPlan.features || {},
          }
        : null,
      usage: {
        callsPublishedThisYear: Number(callsCountRes.rows[0]?.count || 0),
        activeSeatsUsed: Number(seatsCountRes.rows[0]?.count || 0),
      },
      availablePlans: fallbackPlansRes.rows.map((p: any) => ({
        ...p,
        price: Number(p.price) || 0,
      })),
      invoices: invoicesRes.rows.map((inv: any) => ({
        ...inv,
        amount: Number(inv.amount) || 0,
      })),
    };
  }
}

export const workspaceRepository = new WorkspaceRepository();
