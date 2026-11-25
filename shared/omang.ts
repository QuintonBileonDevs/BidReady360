// Rule supplied by owner; verify against the official Omang specification

export type OmangGender = 'male' | 'female';

export type OmangValidationCode =
  | 'VALID'
  | 'INVALID_LENGTH_OR_CHARS'
  | 'INVALID_GENDER_DIGIT'
  | 'GENDER_MISMATCH';

export interface OmangValidationResult {
  ok: boolean;
  code: OmangValidationCode;
  message: string;
  normalised: string;
  derivedGender: OmangGender | null;
}

export function normaliseOmang(s: string | null | undefined): string {
  if (typeof s !== 'string') return '';
  return s.trim().replace(/[\s-]+/g, '');
}

export function genderFromOmang(s: string | null | undefined): OmangGender | null {
  const n = normaliseOmang(s);
  if (!/^\d{9}$/.test(n)) return null;
  const fifth = n[4];
  if (fifth === '1') return 'male';
  if (fifth === '2') return 'female';
  return null;
}

export function validateOmang(
  s: string | null | undefined,
  gender?: string | null
): OmangValidationResult {
  const n = normaliseOmang(s);
  if (!/^\d{9}$/.test(n)) {
    return {
      ok: false,
      code: 'INVALID_LENGTH_OR_CHARS',
      message: 'ID number must be 9 digits.',
      normalised: n,
      derivedGender: null,
    };
  }

  const fifth = n[4];
  if (fifth !== '1' && fifth !== '2') {
    return {
      ok: false,
      code: 'INVALID_GENDER_DIGIT',
      message: 'The 5th digit must be 1 (male) or 2 (female).',
      normalised: n,
      derivedGender: null,
    };
  }

  const derivedGender: OmangGender = fifth === '1' ? 'male' : 'female';
  const normGender = typeof gender === 'string' ? gender.trim().toLowerCase() : '';
  if ((normGender === 'male' || normGender === 'female') && normGender !== derivedGender) {
    return {
      ok: false,
      code: 'GENDER_MISMATCH',
      message: 'The ID number does not match the selected gender.',
      normalised: n,
      derivedGender,
    };
  }

  return {
    ok: true,
    code: 'VALID',
    message: '',
    normalised: n,
    derivedGender,
  };
}
