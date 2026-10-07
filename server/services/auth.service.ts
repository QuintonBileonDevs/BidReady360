import { withTransaction, query } from '../db/client';
import { usersRepository, User, UserTenantMembership } from '../repositories/users.repository';
import {
  hashPassword,
  verifyPassword,
  encryptData,
  decryptData,
  generateTotpSecret,
  verifyTotpCode,
  signSessionToken,
  verifySessionToken,
  SessionPayload,
} from '../utils/crypto';

export interface SupplierSignupDTO {
  legalName: string;
  cipaUin: string;
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  ip?: string;
  userAgent?: string;
}

export interface BuyerSignupDTO {
  organizationName: string;
  organizationType?: 'ministry' | 'parastatal' | 'local_authority' | 'private_company' | 'ngo' | 'other';
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  ip?: string;
  userAgent?: string;
}

export interface AuthResponse {
  requiresMfa?: boolean;
  mfaUserId?: string;
  token?: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
    isPlatformAdmin: boolean;
    memberships: UserTenantMembership[];
  };
}

export class AuthService {
  /**
   * Register a new Supplier account and link the primary user as owner.
   */
  async registerSupplier(dto: SupplierSignupDTO): Promise<AuthResponse> {
    const cleanEmail = dto.email.trim().toLowerCase();
    const cleanCipa = dto.cipaUin.trim().toUpperCase();

    const existingUser = await usersRepository.findByEmail(cleanEmail);
    if (existingUser) {
      const err: any = new Error('An account with this email address already exists.');
      err.code = '23505';
      err.detail = 'Key (email)=(' + cleanEmail + ')';
      throw err;
    }

    const passwordHash = await hashPassword(dto.password);

    const { newUser, newSupplier } = await withTransaction(async (client) => {
      // 1. Create User
      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, full_name, phone, status, email_verified_at)
         VALUES ($1, $2, $3, $4, 'active', NOW())
         RETURNING id, email, full_name AS "fullName", is_platform_admin AS "isPlatformAdmin"`,
        [cleanEmail, passwordHash, dto.fullName.trim(), dto.phone || null]
      );
      const user = userRes.rows[0];

      // 2. Create Supplier
      const supplierRes = await client.query(
        `INSERT INTO suppliers (legal_name, cipa_uin, status, verification_status, compliance_status)
         VALUES ($1, $2, 'active', 'unverified', 'Action required')
         RETURNING id, legal_name AS "legalName"`,
        [dto.legalName.trim(), cleanCipa]
      );
      const supplier = supplierRes.rows[0];

      // 3. Get Supplier Admin System Role
      const roleRes = await client.query(
        `SELECT id FROM roles WHERE scope = 'supplier' AND name = 'Supplier Admin' AND is_system = TRUE LIMIT 1`
      );
      const roleId = roleRes.rows[0]?.id;

      // 4. Link User to Supplier
      await client.query(
        `INSERT INTO supplier_members (supplier_id, user_id, role_id, is_owner, status, joined_at)
         VALUES ($1, $2, $3, TRUE, 'active', NOW())`,
        [supplier.id, user.id, roleId]
      );

      // 5. Add primary Director
      await client.query(
        `INSERT INTO supplier_people (supplier_id, full_name, person_role, email, is_active)
         VALUES ($1, $2, 'director', $3, TRUE)`,
        [supplier.id, dto.fullName.trim(), cleanEmail]
      );

      // 6. Record Legal Acceptance
      await client.query(
        `INSERT INTO legal_acceptances (user_id, document_code, document_version, ip_address, user_agent)
         VALUES ($1, 'supplier_terms', '1.0', $2, $3)`,
        [user.id, dto.ip || null, dto.userAgent || null]
      );

      return { newUser: user, newSupplier: supplier };
    });

    const memberships = await usersRepository.getUserMemberships(newUser.id);
    const token = signSessionToken({
      userId: newUser.id,
      email: newUser.email,
      isPlatformAdmin: false,
      activeTenantType: 'supplier',
      activeTenantId: newSupplier.id,
      role: 'Supplier Admin',
    });

    return {
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        isPlatformAdmin: false,
        memberships,
      },
    };
  }

  /**
   * Register a new Buying Entity (Organization).
   * Status defaults to 'pending' with 'pending_review' verification gate.
   */
  async registerOrganization(dto: BuyerSignupDTO): Promise<AuthResponse> {
    const cleanEmail = dto.email.trim().toLowerCase();
    const cleanOrgName = dto.organizationName.trim();
    const slug = cleanOrgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'org-' + Date.now();

    const existingUser = await usersRepository.findByEmail(cleanEmail);
    if (existingUser) {
      const err: any = new Error('An account with this email address already exists.');
      err.code = '23505';
      err.detail = 'Key (email)=(' + cleanEmail + ')';
      throw err;
    }

    const passwordHash = await hashPassword(dto.password);

    const { newUser, newOrg } = await withTransaction(async (client) => {
      // 1. Create User
      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, full_name, phone, status, email_verified_at)
         VALUES ($1, $2, $3, $4, 'active', NOW())
         RETURNING id, email, full_name AS "fullName", is_platform_admin AS "isPlatformAdmin"`,
        [cleanEmail, passwordHash, dto.fullName.trim(), dto.phone || null]
      );
      const user = userRes.rows[0];

      // 2. Create Organization (Pending review)
      const orgRes = await client.query(
        `INSERT INTO organizations (name, slug, organization_type, status, verification_status, contact_email, verification_submitted_at)
         VALUES ($1, $2, $3, 'pending', 'pending_review', $4, NOW())
         RETURNING id, name`,
        [cleanOrgName, slug, dto.organizationType || 'other', cleanEmail]
      );
      const org = orgRes.rows[0];

      // 3. Get Org Admin System Role
      const roleRes = await client.query(
        `SELECT id FROM roles WHERE scope = 'organization' AND name = 'Org Admin' AND is_system = TRUE LIMIT 1`
      );
      const roleId = roleRes.rows[0]?.id;

      // 4. Link User to Organization
      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role_id, is_owner, status, joined_at)
         VALUES ($1, $2, $3, TRUE, 'active', NOW())`,
        [org.id, user.id, roleId]
      );

      // 5. Record Legal Acceptance
      await client.query(
        `INSERT INTO legal_acceptances (user_id, document_code, document_version, ip_address, user_agent)
         VALUES ($1, 'buyer_terms', '1.0', $2, $3)`,
        [user.id, dto.ip || null, dto.userAgent || null]
      );

      return { newUser: user, newOrg: org };
    });

    const memberships = await usersRepository.getUserMemberships(newUser.id);
    const token = signSessionToken({
      userId: newUser.id,
      email: newUser.email,
      isPlatformAdmin: false,
      activeTenantType: 'organization',
      activeTenantId: newOrg.id,
      role: 'Org Admin',
    });

    return {
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        isPlatformAdmin: false,
        memberships,
      },
    };
  }

  /**
   * Authenticate user with password & check account locking.
   * If MFA is enabled, returns { requiresMfa: true, mfaUserId: ... }
   */
  async login(email: string, passwordPlain: string, ip?: string): Promise<AuthResponse> {
    const user = await usersRepository.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new Error('Invalid email or password.');
    }

    // Check account lockout
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
      throw new Error(`Account temporarily locked due to repeated failed logins. Please retry in ${minutesLeft} minutes.`);
    }

    const isMatch = await verifyPassword(passwordPlain, user.passwordHash);
    if (!isMatch) {
      const lockStatus = await usersRepository.recordLoginFailure(user.id);
      if (lockStatus.lockedUntil) {
        throw new Error('Too many failed login attempts. Account has been locked for 15 minutes.');
      }
      throw new Error('Invalid email or password.');
    }

    // If MFA is enabled, challenge for 6-digit TOTP code
    if (user.mfaEnabled && user.mfaSecretEncrypted) {
      return {
        requiresMfa: true,
        mfaUserId: user.id,
      };
    }

    await usersRepository.recordLoginSuccess(user.id, ip);
    const memberships = await usersRepository.getUserMemberships(user.id);

    const primaryMembership = memberships[0];
    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin,
      activeTenantType: primaryMembership?.tenantType,
      activeTenantId: primaryMembership?.tenantId,
      role: primaryMembership?.roleName,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isPlatformAdmin: user.isPlatformAdmin,
        memberships,
      },
    };
  }

  /**
   * Complete MFA verification and issue authenticated session token.
   */
  async verifyMfa(userId: string, totpCode: string, ip?: string): Promise<AuthResponse> {
    const user = await usersRepository.findById(userId);
    if (!user || !user.mfaSecretEncrypted) {
      throw new Error('Invalid MFA session.');
    }

    const secretHex = decryptData(user.mfaSecretEncrypted);
    const isValid = verifyTotpCode(secretHex, totpCode);
    if (!isValid) {
      throw new Error('Invalid or expired MFA verification code. Please check your authenticator.');
    }

    await usersRepository.recordLoginSuccess(user.id, ip);
    const memberships = await usersRepository.getUserMemberships(user.id);

    const primaryMembership = memberships[0];
    const token = signSessionToken({
      userId: user.id,
      email: user.email,
      isPlatformAdmin: user.isPlatformAdmin,
      activeTenantType: primaryMembership?.tenantType,
      activeTenantId: primaryMembership?.tenantId,
      role: primaryMembership?.roleName,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isPlatformAdmin: user.isPlatformAdmin,
        memberships,
      },
    };
  }

  /**
   * Generate new TOTP setup secret for enrollment.
   */
  async setupMfaEnrollment(userId: string): Promise<{ secret: string; otpAuthUrl: string }> {
    const user = await usersRepository.findById(userId);
    if (!user) throw new Error('User not found.');

    const secretHex = generateTotpSecret();
    const encryptedSecret = encryptData(secretHex);
    await usersRepository.saveMfaSecret(userId, encryptedSecret, 'authenticator');

    const issuer = 'BidReady360';
    const otpAuthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(user.email)}?secret=${secretHex}&issuer=${encodeURIComponent(issuer)}`;

    return { secret: secretHex, otpAuthUrl };
  }

  /**
   * Confirm enrollment with first valid code and activate MFA on account.
   */
  async confirmMfaEnrollment(userId: string, code: string): Promise<void> {
    const user = await usersRepository.findById(userId);
    if (!user || !user.mfaSecretEncrypted) throw new Error('MFA setup not initialized.');

    const secretHex = decryptData(user.mfaSecretEncrypted);
    if (!verifyTotpCode(secretHex, code)) {
      throw new Error('Verification code does not match. Please verify your clock and try again.');
    }

    await usersRepository.enableMfa(userId);
  }

  /**
   * Resolve session token into active profile and memberships.
   */
  async getSessionProfile(token: string): Promise<{ user: User; memberships: UserTenantMembership[] } | null> {
    const payload = verifySessionToken(token);
    if (!payload) return null;

    const user = await usersRepository.findById(payload.userId);
    if (!user || user.status !== 'active') return null;

    const memberships = await usersRepository.getUserMemberships(user.id);
    return { user, memberships };
  }
}

export const authService = new AuthService();
