/**
 * Standard PostgreSQL error code translations for production user-facing messages.
 */
export interface SafeDbError {
  status: number;
  message: string;
  code: string;
  field?: string;
}

export function translateDbError(err: any): SafeDbError {
  if (!err || typeof err !== 'object') {
    return {
      status: 500,
      message: 'An unexpected database error occurred. Please try again.',
      code: 'INTERNAL_ERROR',
    };
  }

  const sqlState = err.code;

  switch (sqlState) {
    case '23505': {
      // Unique violation
      const detail = err.detail || '';
      let fieldMatch = detail.match(/Key \((.*?)\)=/);
      const field = fieldMatch ? fieldMatch[1] : undefined;
      let userFriendlyField = field ? field.replace(/_/g, ' ') : '';
      if (field === 'cipa_uin') userFriendlyField = 'CIPA registration number';
      if (field === 'email') userFriendlyField = 'email address';
      return {
        status: 409,
        message: field
          ? `The ${userFriendlyField} provided is already registered to another account.`
          : 'That value is already in use.',
        code: 'UNIQUE_VIOLATION',
        field,
      };
    }

    case '23503': {
      // Foreign key violation
      return {
        status: 400,
        message: 'Referenced record does not exist or has been removed.',
        code: 'FOREIGN_KEY_VIOLATION',
      };
    }

    case '23514': {
      // Check constraint violation
      const constraint = err.constraint || '';
      let msg = 'The submitted information does not satisfy required business validation rules.';
      if (constraint.includes('chk_calls_dates')) {
        msg = 'Closing date and time must be strictly after the opening date.';
      } else if (constraint.includes('chk_contracts_dates')) {
        msg = 'Contract end date must be after the start date.';
      } else if (constraint.includes('chk_invitation_one_tenant') || constraint.includes('chk_subscription_one_tenant')) {
        msg = 'Record must belong to either an organization or a supplier, not both.';
      }
      return {
        status: 422,
        message: msg,
        code: 'CHECK_VIOLATION',
      };
    }

    case '23502': {
      // Not null violation
      const column = err.column || 'field';
      return {
        status: 400,
        message: `Missing required parameter: ${column.replace(/_/g, ' ')}.`,
        code: 'NOT_NULL_VIOLATION',
      };
    }

    case '22P02': {
      // Invalid text representation
      return {
        status: 400,
        message: 'Invalid input format provided. Please check all entered parameters.',
        code: 'INVALID_INPUT_SYNTAX',
      };
    }

    case '40P01': {
      // Deadlock detected
      return {
        status: 503,
        message: 'The system encountered high concurrency. Please retry your request.',
        code: 'DEADLOCK_DETECTED',
      };
    }

    case 'P0001': {
      // Raised exception from trigger
      return {
        status: 403,
        message: err.message || 'Operation forbidden by compliance rules.',
        code: 'TRIGGER_RULE_REJECTED',
      };
    }

    default:
      if (err.message && typeof err.message === 'string' && !err.message.includes('Query execution failed')) {
        return {
          status: err.status || 400,
          message: err.message,
          code: sqlState || err.code || 'BAD_REQUEST',
          field: err.field,
        };
      }
      return {
        status: 500,
        message: 'Unable to process your request at this time. Please verify your details and try again.',
        code: sqlState || 'DB_ERROR',
      };
  }
}
