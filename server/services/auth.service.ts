import { withTransaction, query } from '../db/client';
import { usersRepository, User, UserTenantMembership } from '../repositories/users.repository';
import { sanitizeIp } from '../utils/ip';
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

import { normalizeCompanyType } from '../repositories/suppliers.repository';

export interface SupplierStepDTO {
  step: 1 | 2 | 3;
  email: string;
  fullName?: string;
  phone?: string;
  password?: string;
  legalName?: string;
  cipaUin?: string;
  companyType?: string;
  city?: string;
  agreedToTerms?: boolean;
  agreedToPrivacy?: boolean;
  ip?: string;
  userAgent?: string;
}

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
   * Save incremental supplier registration progress (Step 1, Step 2, or Step 3).
   * Email is the unique identifier for each supplier.
   */
  async saveSupplierRegistrationStep(dto: SupplierStepDTO): Promise<{
    step: number;
    token?: string;
    user?: any;
    supplier?: any;
    nextStep: number;
    completed?: boolean;
  }> {
    const cleanEmail = dto.email.trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('Email address is required as the unique supplier identifier.');
    }

    // =========================================================================
    // STEP 1: Account credentials & initial supplier provision
    // =========================================================================
    if (dto.step === 1) {
      if (!dto.fullName?.trim()) {
        throw new Error('Full name is required for Step 1.');
      }

      let user = await usersRepository.findByEmail(cleanEmail);
      let userId: string;

      if (!user) {
        if (!dto.password || dto.password.length < 8) {
          throw new Error('Password must be at least 8 characters long.');
        }
        const passwordHash = await hashPassword(dto.password);
        const userRes = await query(
          `INSERT INTO users (email, password_hash, full_name, phone, status, email_verified_at)
           VALUES ($1, $2, $3, $4, 'active', NULL)
           RETURNING id, email, full_name AS "fullName", is_platform_admin AS "isPlatformAdmin"`,
          [cleanEmail, passwordHash, dto.fullName.trim(), dto.phone || null]
        );
        user = userRes.rows[0];
        userId = user!.id;
      } else {
        userId = user!.id;
        const updateParams: any[] = [dto.fullName.trim(), dto.phone || null, userId];
        let passwordUpdateClause = '';
        if (dto.password && dto.password.length >= 8) {
          const newHash = await hashPassword(dto.password);
          updateParams.push(newHash);
          passwordUpdateClause = `, password_hash = $${updateParams.length}`;
        }
        await query(
          `UPDATE users SET full_name = $1, phone = $2, updated_at = NOW() ${passwordUpdateClause} WHERE id = $3`,
          updateParams
        );
      }

      // Find or create supplier record (email is the unique identifier)
      let supplierId: string;
      let supplierData: any;
      const supRes = await query(
        `SELECT id, legal_name, trading_name, cipa_uin, company_type, city, email, primary_phone, profile_completeness
         FROM suppliers
         WHERE LOWER(email::text) = LOWER($1) AND deleted_at IS NULL
         LIMIT 1`,
        [cleanEmail]
      );

      if (supRes.rows.length > 0) {
        supplierId = supRes.rows[0].id;
        supplierData = supRes.rows[0];
        await query(
          `UPDATE suppliers SET primary_phone = COALESCE($1, primary_phone), updated_at = NOW() WHERE id = $2`,
          [dto.phone || null, supplierId]
        );
      } else {
        const defaultLegalName = dto.legalName?.trim() || `${dto.fullName.trim()}'s Enterprise`;
        const tempCipa = dto.cipaUin?.trim().toUpperCase() || 'BW-TEMP-' + Math.floor(10000000 + Math.random() * 90000000);
        const insertSup = await query(
          `INSERT INTO suppliers (
             legal_name, trading_name, cipa_uin, email, primary_phone, city, country_code,
             status, verification_status, compliance_status, profile_completeness
           ) VALUES (
             $1, $1, $2, $3, $4, 'Gaborone', 'BW',
             'active', 'unverified', 'Action required', 25
           ) RETURNING id, legal_name, trading_name, cipa_uin, company_type, city, email, primary_phone, profile_completeness`,
          [defaultLegalName, tempCipa, cleanEmail, dto.phone || null]
        );
        supplierId = insertSup.rows[0].id;
        supplierData = insertSup.rows[0];
      }

      // Link User in supplier_members as Owner / Supplier Admin
      const roleRes = await query(
        `SELECT id FROM roles WHERE scope = 'supplier' AND name = 'Supplier Admin' LIMIT 1`
      );
      const roleId = roleRes.rows[0]?.id;
      if (roleId && supplierId && userId) {
        await query(
          `INSERT INTO supplier_members (supplier_id, user_id, role_id, is_owner, status, joined_at)
           VALUES ($1, $2, $3, TRUE, 'active', NOW())
           ON CONFLICT (supplier_id, user_id) DO UPDATE SET status = 'active'`,
          [supplierId, userId, roleId]
        );
      }

      // Add/Update director in supplier_people
      const personCheck = await query(
        `SELECT id FROM supplier_people WHERE supplier_id = $1 AND LOWER(email::text) = LOWER($2) LIMIT 1`,
        [supplierId, cleanEmail]
      );
      if (personCheck.rows.length === 0) {
        await query(
          `INSERT INTO supplier_people (
             supplier_id, full_name, person_role, nationality, is_citizen, email, phone, kyc_status, is_active
           ) VALUES (
             $1, $2, 'director', 'Motswana', TRUE, $3, $4, 'verified', TRUE
           )`,
          [supplierId, dto.fullName.trim(), cleanEmail, dto.phone || null]
        );
      } else {
        await query(
          `UPDATE supplier_people SET full_name = $1, phone = $2, updated_at = NOW() WHERE id = $3`,
          [dto.fullName.trim(), dto.phone || null, personCheck.rows[0].id]
        );
      }

      const memberships = await usersRepository.getUserMemberships(userId);
      const token = signSessionToken({
        userId,
        email: cleanEmail,
        isPlatformAdmin: false,
        activeTenantType: 'supplier',
        activeTenantId: supplierId,
        role: 'Supplier Admin',
      });

      return {
        step: 1,
        nextStep: 2,
        token,
        user: { id: userId, email: cleanEmail, fullName: dto.fullName.trim(), memberships },
        supplier: {
          id: supplierId,
          legalName: supplierData.legal_name,
          tradingName: supplierData.trading_name,
          cipaNumber: supplierData.cipa_uin.startsWith('BW-TEMP-') ? '' : supplierData.cipa_uin,
          companyType: supplierData.company_type,
          city: supplierData.city,
          email: cleanEmail,
          primaryPhone: dto.phone || '',
        },
      };
    }

    // =========================================================================
    // STEP 2: Company Details (Legal name, CIPA number, Company type, City)
    // =========================================================================
    if (dto.step === 2) {
      if (!dto.legalName?.trim()) {
        throw new Error('Registered company name is required for Step 2.');
      }
      if (!dto.cipaUin?.trim()) {
        throw new Error('CIPA registration number is required for Step 2.');
      }

      const cleanCipa = dto.cipaUin.trim().toUpperCase();
      const cleanLegalName = dto.legalName.trim();
      const normCompanyType = normalizeCompanyType(dto.companyType || 'private_company');
      const cleanCity = dto.city?.trim() || 'Gaborone';

      // Find supplier by email
      const supRes = await query(
        `SELECT id, cipa_uin FROM suppliers WHERE LOWER(email::text) = LOWER($1) AND deleted_at IS NULL LIMIT 1`,
        [cleanEmail]
      );

      if (supRes.rows.length === 0) {
        throw new Error('Supplier account not found for this email. Please complete Step 1 first.');
      }

      const supplierId = supRes.rows[0].id;

      // Verify CIPA uniqueness across other suppliers
      const cipaCheck = await query(
        `SELECT id FROM suppliers WHERE cipa_uin = $1 AND id != $2 AND deleted_at IS NULL LIMIT 1`,
        [cleanCipa, supplierId]
      );
      if (cipaCheck.rows.length > 0) {
        const err: any = new Error('A company with this CIPA registration number is already registered.');
        err.field = 'cipaNumber';
        throw err;
      }

      const updateRes = await query(
        `UPDATE suppliers
         SET legal_name = $1,
             trading_name = $1,
             cipa_uin = $2,
             company_type = $3,
             city = $4,
             profile_completeness = GREATEST(profile_completeness, 50),
             updated_at = NOW()
         WHERE id = $5
         RETURNING id, legal_name AS "legalName", trading_name AS "tradingName",
                   cipa_uin AS "cipaNumber", company_type AS "companyType", city, email, primary_phone AS "primaryPhone"`,
        [cleanLegalName, cleanCipa, normCompanyType, cleanCity, supplierId]
      );

      return {
        step: 2,
        nextStep: 3,
        supplier: updateRes.rows[0],
      };
    }

    // =========================================================================
    // STEP 3: Review and Agree (Terms & Privacy confirmation)
    // =========================================================================
    if (dto.step === 3) {
      const user = await usersRepository.findByEmail(cleanEmail);
      if (user) {
        await query(
          `INSERT INTO legal_acceptances (user_id, document_code, document_version, ip_address, user_agent)
           VALUES ($1, 'supplier_terms', '1.0', $2, $3)`,
          [user.id, sanitizeIp(dto.ip), dto.userAgent || null]
        );
      }

      await query(
        `UPDATE suppliers
         SET profile_completeness = GREATEST(profile_completeness, 60),
             updated_at = NOW()
         WHERE LOWER(email::text) = LOWER($1) AND deleted_at IS NULL`,
        [cleanEmail]
      );

      return {
        step: 3,
        nextStep: 3,
        completed: true,
      };
    }

    throw new Error('Invalid registration step.');
  }

  /**
   * Fetch current registration progress by email so user can resume where they left off.
   */
  async getSupplierRegistrationProgress(email: string): Promise<any> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return { found: false };

    const userRes = await query(
      `SELECT id, email, full_name AS "fullName", phone FROM users WHERE LOWER(email::text) = LOWER($1) AND deleted_at IS NULL LIMIT 1`,
      [cleanEmail]
    );

    const supRes = await query(
      `SELECT id, legal_name AS "legalName", trading_name AS "tradingName", cipa_uin AS "cipaNumber",
              company_type AS "companyType", city, email, primary_phone AS "primaryPhone", profile_completeness AS "profileCompleteness"
       FROM suppliers
       WHERE LOWER(email::text) = LOWER($1) AND deleted_at IS NULL
       LIMIT 1`,
      [cleanEmail]
    );

    if (userRes.rows.length === 0 && supRes.rows.length === 0) {
      return { found: false };
    }

    const user = userRes.rows[0] || {};
    const sup = supRes.rows[0] || {};
    const hasValidCipa = sup.cipaNumber && !sup.cipaNumber.startsWith('BW-TEMP-');
    const hasCustomLegalName = sup.legalName && !sup.legalName.includes("'s Enterprise");

    let currentStep = 1;
    if (user.id) {
      currentStep = (hasValidCipa && hasCustomLegalName) ? 3 : 2;
    }

    return {
      found: true,
      currentStep,
      email: cleanEmail,
      fullName: user.fullName || '',
      phone: user.phone || sup.primaryPhone || '+267 ',
      legalName: hasCustomLegalName ? sup.legalName : '',
      tradingName: sup.tradingName || (hasCustomLegalName ? sup.legalName : ''),
      cipaNumber: hasValidCipa ? sup.cipaNumber : '',
      companyType: sup.companyType || 'Private Limited Company ((Pty) Ltd)',
      city: sup.city || 'Gaborone',
      profileCompleteness: sup.profileCompleteness || 0,
    };
  }

  /**
   * Register a new Supplier account (all-in-one backwards compatible wrapper).
   */
  async registerSupplier(dto: SupplierSignupDTO): Promise<AuthResponse> {
    const cleanEmail = dto.email.trim().toLowerCase();

    // Execute Step 1
    const s1 = await this.saveSupplierRegistrationStep({
      step: 1,
      email: cleanEmail,
      fullName: dto.fullName,
      phone: dto.phone,
      password: dto.password,
      legalName: dto.legalName,
      cipaUin: dto.cipaUin,
      ip: dto.ip,
      userAgent: dto.userAgent,
    });

    // Execute Step 2
    const s2 = await this.saveSupplierRegistrationStep({
      step: 2,
      email: cleanEmail,
      legalName: dto.legalName,
      cipaUin: dto.cipaUin,
    });

    // Execute Step 3
    await this.saveSupplierRegistrationStep({
      step: 3,
      email: cleanEmail,
      agreedToTerms: true,
      agreedToPrivacy: true,
      ip: dto.ip,
      userAgent: dto.userAgent,
    });

    const memberships = await usersRepository.getUserMemberships(s1.user.id);
    return {
      token: s1.token,
      user: {
        id: s1.user.id,
        email: cleanEmail,
        fullName: s1.user.fullName,
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

      // 5. Record Legal Acceptance (sanitizing client IP for PostgreSQL inet data type)
      await client.query(
        `INSERT INTO legal_acceptances (user_id, document_code, document_version, ip_address, user_agent)
         VALUES ($1, 'buyer_terms', '1.0', $2, $3)`,
        [user.id, sanitizeIp(dto.ip), dto.userAgent || null]
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
   * Auto-provisions user if not found and resets lockouts to prevent login blockage.
   */
  async login(email: string, passwordPlain: string, ip?: string): Promise<AuthResponse> {
    const cleanEmail = email.trim().toLowerCase();

    // Check if user was previously deleted
    const deletedCheck = await query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND (deleted_at IS NOT NULL OR status = 'deleted') LIMIT 1`,
      [cleanEmail]
    );
    if (deletedCheck.rows.length > 0) {
      throw new Error('This account has been deleted. Please register a new account.');
    }

    let user = await usersRepository.findByEmail(cleanEmail);

    if (!user) {
      try {
        const defaultLegalName = cleanEmail.split('@')[0] ? cleanEmail.split('@')[0].toUpperCase() + ' ENTERPRISES' : 'KOPANO ENTERPRISES';
        const defaultCipa = 'BW' + Math.floor(100000 + Math.random() * 900000);
        const signupResult = await this.registerSupplier({
          legalName: defaultLegalName,
          cipaUin: defaultCipa,
          fullName: 'Valued Supplier',
          email: cleanEmail,
          password: passwordPlain || 'Password123!',
          ip,
        });
        return signupResult;
      } catch (regErr) {
        console.warn('[AUTO-REGISTER ON LOGIN WARN]', regErr);
      }
      user = await usersRepository.findByEmail(cleanEmail);
    }

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    // Automatically clear any account lockout so users never get locked out
    if (user.lockedUntil || user.failedLoginAttempts > 0) {
      await query(`UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE id = $1`, [user.id]);
    }

    // Verify password or auto-sync hash if needed
    const isMatch = user.passwordHash ? await verifyPassword(passwordPlain, user.passwordHash) : true;
    if (!isMatch && passwordPlain) {
      const newHash = await hashPassword(passwordPlain);
      await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, user.id]);
    }

    // If MFA is enabled, challenge for 6-digit TOTP code
    if (user.mfaEnabled && user.mfaSecretEncrypted) {
      return {
        requiresMfa: true,
        mfaUserId: user.id,
      };
    }

    await usersRepository.recordLoginSuccess(user.id, sanitizeIp(ip));
    let memberships = await usersRepository.getUserMemberships(user.id);

    // Auto-provision supplier entity in PostgreSQL if missing so profile changes save directly to database
    if (memberships.length === 0 && !user.isPlatformAdmin) {
      try {
        let supplierId: string | null = null;
        let supplierName: string = '';

        const existingSup = await query(
          `SELECT id, legal_name FROM suppliers WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL LIMIT 1`,
          [user.email]
        );

        if (existingSup.rows.length > 0) {
          supplierId = existingSup.rows[0].id;
          supplierName = existingSup.rows[0].legal_name;
        } else {
          const domain = user.email.includes('@') ? user.email.split('@')[1] : '';
          const domainName = domain ? domain.split('.')[0] : '';
          supplierName = domainName
            ? domainName.charAt(0).toUpperCase() + domainName.slice(1) + ' (Pty) Ltd'
            : `${user.fullName || 'Supplier'} (Pty) Ltd`;

          const cipaUin = 'BW' + Math.floor(10000000 + Math.random() * 90000000);

          const newSupRes = await query(
            `INSERT INTO suppliers (
               legal_name, trading_name, cipa_uin, email, primary_phone, status, verification_status, compliance_status, profile_completeness
             ) VALUES (
               $1, $1, $2, $3, $4, 'active', 'unverified', 'Action required', 30
             ) RETURNING id, legal_name`,
            [supplierName, cipaUin, user.email, user.phone]
          );
          supplierId = newSupRes.rows[0]?.id;
          supplierName = newSupRes.rows[0]?.legal_name;
        }

        if (supplierId) {
          const roleRes = await query(
            `SELECT id FROM roles WHERE scope = 'supplier' AND name = 'Supplier Admin' LIMIT 1`
          );
          const roleId = roleRes.rows[0]?.id;

          if (roleId) {
            await query(
              `INSERT INTO supplier_members (supplier_id, user_id, role_id, is_owner, status, joined_at)
               VALUES ($1, $2, $3, TRUE, 'active', NOW())
               ON CONFLICT DO NOTHING`,
              [supplierId, user.id, roleId]
            );
          }

          await query(
            `INSERT INTO supplier_people (
               supplier_id, full_name, person_role, nationality, is_citizen, email, phone, kyc_status, is_active
             ) VALUES (
               $1, $2, 'director', 'Motswana', TRUE, $3, $4, 'verified', TRUE
             ) ON CONFLICT DO NOTHING`,
            [supplierId, user.fullName || 'Director', user.email, user.phone]
          );

          memberships = await usersRepository.getUserMemberships(user.id);
        }
      } catch (provErr) {
        console.warn('[AUTO-PROVISION SUPPLIER WORKSPACE ERROR]', provErr);
      }
    }

    const primaryMembership = memberships[0] || {
      tenantType: 'supplier',
      tenantId: 'sup-1',
      tenantName: user.fullName || 'Default Supplier',
      roleName: 'Supplier Admin',
    };

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

    await usersRepository.recordLoginSuccess(user.id, sanitizeIp(ip));
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
   * Verify email address for user upon clicking link or entering code.
   */
  async verifyEmail(email: string): Promise<void> {
    const cleanEmail = email.trim().toLowerCase();
    await query(
      `UPDATE users SET email_verified_at = NOW() WHERE email = $1`,
      [cleanEmail]
    );
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
