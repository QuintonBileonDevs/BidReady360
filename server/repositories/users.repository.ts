import { query } from '../db/client';

export interface User {
  id: string;
  email: string;
  passwordHash: string | null;
  fullName: string;
  phone: string | null;
  preferredLanguage: string;
  status: 'pending' | 'active' | 'suspended' | 'deleted';
  isPlatformAdmin: boolean;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  mfaEnabled: boolean;
  mfaSecretEncrypted: Buffer | null;
  mfaType: string | null;
  lastLoginAt: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
}

export interface UserTenantMembership {
  tenantType: 'organization' | 'supplier';
  tenantId: string;
  tenantName: string;
  roleId: string;
  roleName: string;
  isOwner: boolean;
  status: string;
  permissions: string[];
}

export class UsersRepository {
  async findByEmail(email: string): Promise<User | null> {
    const res = await query<User>(
      `SELECT id, email, password_hash AS "passwordHash", full_name AS "fullName",
              phone, preferred_language AS "preferredLanguage", status,
              is_platform_admin AS "isPlatformAdmin", email_verified_at AS "emailVerifiedAt",
              phone_verified_at AS "phoneVerifiedAt", mfa_enabled AS "mfaEnabled",
              mfa_secret_encrypted AS "mfaSecretEncrypted", mfa_type AS "mfaType",
              last_login_at AS "lastLoginAt", failed_login_attempts AS "failedLoginAttempts",
              locked_until AS "lockedUntil", created_at AS "createdAt"
       FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email.trim().toLowerCase()]
    );
    return res.rows[0] || null;
  }

  async findById(id: string): Promise<User | null> {
    const res = await query<User>(
      `SELECT id, email, password_hash AS "passwordHash", full_name AS "fullName",
              phone, preferred_language AS "preferredLanguage", status,
              is_platform_admin AS "isPlatformAdmin", email_verified_at AS "emailVerifiedAt",
              phone_verified_at AS "phoneVerifiedAt", mfa_enabled AS "mfaEnabled",
              mfa_secret_encrypted AS "mfaSecretEncrypted", mfa_type AS "mfaType",
              last_login_at AS "lastLoginAt", failed_login_attempts AS "failedLoginAttempts",
              locked_until AS "lockedUntil", created_at AS "createdAt"
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return res.rows[0] || null;
  }

  async recordLoginSuccess(userId: string, ip?: string | null): Promise<void> {
    await query(
      `UPDATE users
       SET last_login_at = NOW(),
           last_login_ip = $2,
           failed_login_attempts = 0,
           locked_until = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, ip || null]
    );
  }

  async recordLoginFailure(userId: string): Promise<{ failedAttempts: number; lockedUntil: string | null }> {
    // Lock for 15 minutes after 5 failed attempts
    const res = await query<{ failedAttempts: number; lockedUntil: string | null }>(
      `UPDATE users
       SET failed_login_attempts = failed_login_attempts + 1,
           locked_until = CASE
             WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
             ELSE locked_until
           END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING failed_login_attempts AS "failedAttempts", locked_until AS "lockedUntil"`,
      [userId]
    );
    return res.rows[0] || { failedAttempts: 1, lockedUntil: null };
  }

  async saveMfaSecret(userId: string, encryptedSecret: Buffer, mfaType: string = 'authenticator'): Promise<void> {
    await query(
      `UPDATE users
       SET mfa_secret_encrypted = $2,
           mfa_type = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, encryptedSecret, mfaType]
    );
  }

  async enableMfa(userId: string): Promise<void> {
    await query(
      `UPDATE users
       SET mfa_enabled = TRUE,
           updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );
  }

  async getUserMemberships(userId: string): Promise<UserTenantMembership[]> {
    // Fetch Organization memberships
    const orgMembersRes = await query(
      `SELECT 'organization' AS "tenantType",
              o.id AS "tenantId",
              o.name AS "tenantName",
              r.id AS "roleId",
              r.name AS "roleName",
              om.is_owner AS "isOwner",
              om.status,
              COALESCE(
                (SELECT json_agg(p.code)
                 FROM role_permissions rp
                 JOIN permissions p ON p.id = rp.permission_id
                 WHERE rp.role_id = r.id),
                '[]'::json
              ) AS permissions
       FROM organization_members om
       JOIN organizations o ON o.id = om.organization_id AND o.deleted_at IS NULL
       JOIN roles r ON r.id = om.role_id
       WHERE om.user_id = $1 AND om.status = 'active'`,
      [userId]
    );

    // Fetch Supplier memberships
    const supMembersRes = await query(
      `SELECT 'supplier' AS "tenantType",
              s.id AS "tenantId",
              s.legal_name AS "tenantName",
              r.id AS "roleId",
              r.name AS "roleName",
              sm.is_owner AS "isOwner",
              sm.status,
              COALESCE(
                (SELECT json_agg(p.code)
                 FROM role_permissions rp
                 JOIN permissions p ON p.id = rp.permission_id
                 WHERE rp.role_id = r.id),
                '[]'::json
              ) AS permissions
       FROM supplier_members sm
       JOIN suppliers s ON s.id = sm.supplier_id AND s.deleted_at IS NULL
       JOIN roles r ON r.id = sm.role_id
       WHERE sm.user_id = $1 AND sm.status = 'active'`,
      [userId]
    );

    return [...orgMembersRes.rows, ...supMembersRes.rows];
  }
}

export const usersRepository = new UsersRepository();
