/**
 * Indian GSTIN, PAN, Phone, and Email Format Validators
 * and Input Validation Rules for Masters & Company Entities
 */

// GSTIN format: 2 digits (state code), 5 letters, 4 digits, 1 letter, 1 alphanumeric, 'Z', 1 alphanumeric
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// PAN format: 5 letters, 4 digits, 1 letter
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

// Indian mobile/landline: 10 digits (optionally prefixed with +91 or 0)
export const PHONE_REGEX = /^(?:(?:\+|0{0,2})91(\s*[-]\s*)?|[0]?)?[6789]\d{9}$/;

// Standard email regex
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidationError {
  field: string;
  message: string;
}

// -------------------------------------------------------------
// Company Input Validation
// -------------------------------------------------------------
export function validateCompanyInput(
  data: {
    companyCode?: string;
    companyName?: string;
    gstin?: string | null;
    panNumber?: string | null;
    email?: string | null;
    phone?: string | null;
    logoPath?: string | null;
  },
  isUpdate = false
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isUpdate) {
    if (!data.companyCode || !data.companyCode.trim()) {
      errors.push({ field: 'companyCode', message: 'Company Code is required.' });
    } else if (data.companyCode.trim().length > 20) {
      errors.push({ field: 'companyCode', message: 'Company Code cannot exceed 20 characters.' });
    }

    if (!data.companyName || !data.companyName.trim()) {
      errors.push({ field: 'companyName', message: 'Company Name is required.' });
    } else if (data.companyName.trim().length < 2) {
      errors.push({ field: 'companyName', message: 'Company Name must be at least 2 characters long.' });
    }
  } else {
    if (data.companyCode !== undefined) {
      if (!data.companyCode.trim()) {
        errors.push({ field: 'companyCode', message: 'Company Code cannot be empty.' });
      } else if (data.companyCode.trim().length > 20) {
        errors.push({ field: 'companyCode', message: 'Company Code cannot exceed 20 characters.' });
      }
    }
    if (data.companyName !== undefined) {
      if (!data.companyName.trim()) {
        errors.push({ field: 'companyName', message: 'Company Name cannot be empty.' });
      } else if (data.companyName.trim().length < 2) {
        errors.push({ field: 'companyName', message: 'Company Name must be at least 2 characters long.' });
      }
    }
  }

  if (data.gstin && data.gstin.trim()) {
    const trimmedGstin = data.gstin.trim().toUpperCase();
    if (!GSTIN_REGEX.test(trimmedGstin)) {
      errors.push({
        field: 'gstin',
        message: 'Invalid GSTIN format. Expected 15-character format (e.g. 24AAAAA0000A1Z5).',
      });
    }
  }

  if (data.panNumber && data.panNumber.trim()) {
    const trimmedPan = data.panNumber.trim().toUpperCase();
    if (!PAN_REGEX.test(trimmedPan)) {
      errors.push({
        field: 'panNumber',
        message: 'Invalid PAN format. Expected 10-character format (e.g. AAAAA0000A).',
      });
    }
  }

  if (data.email && data.email.trim()) {
    if (!EMAIL_REGEX.test(data.email.trim())) {
      errors.push({ field: 'email', message: 'Invalid email address format.' });
    }
  }

  if (data.phone && data.phone.trim()) {
    const cleanPhone = data.phone.replace(/[\s-]/g, '');
    if (!PHONE_REGEX.test(cleanPhone)) {
      errors.push({ field: 'phone', message: 'Invalid phone number format. Expected 10 digits.' });
    }
  }

  return errors;
}

// -------------------------------------------------------------
// Financial Year Input Validation
// -------------------------------------------------------------
export function validateFinancialYearInput(
  data: {
    yearName?: string;
    startDate?: string | Date;
    endDate?: string | Date;
  },
  isUpdate = false
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isUpdate) {
    if (!data.yearName || !data.yearName.trim()) {
      errors.push({ field: 'yearName', message: 'Financial Year Name is required (e.g. 2025-2026).' });
    }
    if (!data.startDate) {
      errors.push({ field: 'startDate', message: 'Start Date is required.' });
    }
    if (!data.endDate) {
      errors.push({ field: 'endDate', message: 'End Date is required.' });
    }
  }

  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    if (isNaN(start.getTime())) {
      errors.push({ field: 'startDate', message: 'Start Date is not a valid date.' });
    }
    if (isNaN(end.getTime())) {
      errors.push({ field: 'endDate', message: 'End Date is not a valid date.' });
    }
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start >= end) {
      errors.push({ field: 'endDate', message: 'End Date must be strictly after Start Date.' });
    }
  }

  return errors;
}

// -------------------------------------------------------------
// 1. Party / Account Input Validation
// -------------------------------------------------------------
export function validatePartyInput(
  data: {
    partyCode?: string;
    partyName?: string;
    partyType?: string;
    gstin?: string | null;
    panNumber?: string | null;
    phone?: string | null;
    email?: string | null;
    openingBalance?: any;
    balanceType?: string;
  },
  isUpdate = false
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isUpdate) {
    if (!data.partyCode || !data.partyCode.trim()) {
      errors.push({ field: 'partyCode', message: 'Party Code is required.' });
    } else if (data.partyCode.trim().length > 30) {
      errors.push({ field: 'partyCode', message: 'Party Code cannot exceed 30 characters.' });
    }

    if (!data.partyName || !data.partyName.trim()) {
      errors.push({ field: 'partyName', message: 'Party Name is required.' });
    } else if (data.partyName.trim().length < 2) {
      errors.push({ field: 'partyName', message: 'Party Name must be at least 2 characters long.' });
    }
  } else {
    if (data.partyCode !== undefined) {
      if (!data.partyCode.trim()) {
        errors.push({ field: 'partyCode', message: 'Party Code cannot be empty.' });
      } else if (data.partyCode.trim().length > 30) {
        errors.push({ field: 'partyCode', message: 'Party Code cannot exceed 30 characters.' });
      }
    }
    if (data.partyName !== undefined) {
      if (!data.partyName.trim()) {
        errors.push({ field: 'partyName', message: 'Party Name cannot be empty.' });
      } else if (data.partyName.trim().length < 2) {
        errors.push({ field: 'partyName', message: 'Party Name must be at least 2 characters long.' });
      }
    }
  }

  if (data.partyType && !['CUSTOMER', 'SUPPLIER', 'BOTH'].includes(data.partyType.toUpperCase())) {
    errors.push({ field: 'partyType', message: 'Party Type must be CUSTOMER, SUPPLIER, or BOTH.' });
  }

  if (data.gstin && data.gstin.trim()) {
    const trimmedGstin = data.gstin.trim().toUpperCase();
    if (!GSTIN_REGEX.test(trimmedGstin)) {
      errors.push({
        field: 'gstin',
        message: 'Invalid GSTIN format. Expected 15-character format (e.g. 24AAAAA0000A1Z5).',
      });
    }
  }

  if (data.panNumber && data.panNumber.trim()) {
    const trimmedPan = data.panNumber.trim().toUpperCase();
    if (!PAN_REGEX.test(trimmedPan)) {
      errors.push({
        field: 'panNumber',
        message: 'Invalid PAN format. Expected 10-character format (e.g. AAAAA0000A).',
      });
    }
  }

  if (data.phone && data.phone.trim()) {
    const cleanPhone = data.phone.replace(/[\s-]/g, '');
    if (!PHONE_REGEX.test(cleanPhone)) {
      errors.push({ field: 'phone', message: 'Invalid phone number format. Expected 10 digits.' });
    }
  }

  if (data.email && data.email.trim()) {
    if (!EMAIL_REGEX.test(data.email.trim())) {
      errors.push({ field: 'email', message: 'Invalid email address format.' });
    }
  }

  if (data.openingBalance !== undefined && data.openingBalance !== null && data.openingBalance !== '') {
    const num = Number(data.openingBalance);
    if (isNaN(num) || num < 0) {
      errors.push({ field: 'openingBalance', message: 'Opening balance must be a non-negative number.' });
    }
  }

  if (data.balanceType && !['DEBIT', 'CREDIT'].includes(data.balanceType.toUpperCase())) {
    errors.push({ field: 'balanceType', message: 'Balance Type must be DEBIT or CREDIT.' });
  }

  return errors;
}

// -------------------------------------------------------------
// 2. Machine Input Validation
// -------------------------------------------------------------
export function validateMachineInput(
  data: {
    machineCode?: string;
    machineName?: string;
  },
  isUpdate = false
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isUpdate) {
    if (!data.machineCode || !data.machineCode.trim()) {
      errors.push({ field: 'machineCode', message: 'Machine Code is required.' });
    } else if (data.machineCode.trim().length > 30) {
      errors.push({ field: 'machineCode', message: 'Machine Code cannot exceed 30 characters.' });
    }
    if (!data.machineName || !data.machineName.trim()) {
      errors.push({ field: 'machineName', message: 'Machine Name is required.' });
    }
  } else {
    if (data.machineCode !== undefined) {
      if (!data.machineCode.trim()) {
        errors.push({ field: 'machineCode', message: 'Machine Code cannot be empty.' });
      } else if (data.machineCode.trim().length > 30) {
        errors.push({ field: 'machineCode', message: 'Machine Code cannot exceed 30 characters.' });
      }
    }
    if (data.machineName !== undefined && !data.machineName.trim()) {
      errors.push({ field: 'machineName', message: 'Machine Name cannot be empty.' });
    }
  }

  return errors;
}

// -------------------------------------------------------------
// 3. Operator Input Validation
// -------------------------------------------------------------
export function validateOperatorInput(
  data: {
    operatorCode?: string;
    operatorName?: string;
    phone?: string | null;
  },
  isUpdate = false
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isUpdate) {
    if (!data.operatorCode || !data.operatorCode.trim()) {
      errors.push({ field: 'operatorCode', message: 'Operator Code is required.' });
    } else if (data.operatorCode.trim().length > 30) {
      errors.push({ field: 'operatorCode', message: 'Operator Code cannot exceed 30 characters.' });
    }
    if (!data.operatorName || !data.operatorName.trim()) {
      errors.push({ field: 'operatorName', message: 'Operator Name is required.' });
    }
  } else {
    if (data.operatorCode !== undefined) {
      if (!data.operatorCode.trim()) {
        errors.push({ field: 'operatorCode', message: 'Operator Code cannot be empty.' });
      } else if (data.operatorCode.trim().length > 30) {
        errors.push({ field: 'operatorCode', message: 'Operator Code cannot exceed 30 characters.' });
      }
    }
    if (data.operatorName !== undefined && !data.operatorName.trim()) {
      errors.push({ field: 'operatorName', message: 'Operator Name cannot be empty.' });
    }
  }

  if (data.phone && data.phone.trim()) {
    const cleanPhone = data.phone.replace(/[\s-]/g, '');
    if (!PHONE_REGEX.test(cleanPhone)) {
      errors.push({ field: 'phone', message: 'Invalid phone number format. Expected 10 digits.' });
    }
  }

  return errors;
}

// -------------------------------------------------------------
// 4. Location / Godown Input Validation
// -------------------------------------------------------------
export function validateLocationInput(
  data: {
    locationName?: string;
  },
  isUpdate = false
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isUpdate) {
    if (!data.locationName || !data.locationName.trim()) {
      errors.push({ field: 'locationName', message: 'Location Name is required.' });
    }
  } else {
    if (data.locationName !== undefined && !data.locationName.trim()) {
      errors.push({ field: 'locationName', message: 'Location Name cannot be empty.' });
    }
  }

  return errors;
}

// -------------------------------------------------------------
// 5. Yarn Quality Input Validation
// -------------------------------------------------------------
export function validateYarnQualityInput(
  data: {
    qualityName?: string;
    denier?: string | null;
  },
  isUpdate = false
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isUpdate) {
    if (!data.qualityName || !data.qualityName.trim()) {
      errors.push({ field: 'qualityName', message: 'Quality Name is required (e.g. 80/72 Polyester DTY).' });
    }
  } else {
    if (data.qualityName !== undefined && !data.qualityName.trim()) {
      errors.push({ field: 'qualityName', message: 'Quality Name cannot be empty.' });
    }
  }

  return errors;
}

// -------------------------------------------------------------
// 6. Yarn Grade Input Validation
// -------------------------------------------------------------
export function validateYarnGradeInput(
  data: {
    gradeName?: string;
  },
  isUpdate = false
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isUpdate) {
    if (!data.gradeName || !data.gradeName.trim()) {
      errors.push({ field: 'gradeName', message: 'Grade Name is required (e.g. A-Grade, Fresh).' });
    }
  } else {
    if (data.gradeName !== undefined && !data.gradeName.trim()) {
      errors.push({ field: 'gradeName', message: 'Grade Name cannot be empty.' });
    }
  }

  return errors;
}

// -------------------------------------------------------------
// 7. Production Book Input Validation
// -------------------------------------------------------------
export function validateProductionBookInput(
  data: {
    prefix?: string;
    bookName?: string;
    financialYearId?: string;
    openingBalance?: any;
  },
  isUpdate = false
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isUpdate) {
    if (!data.prefix || !data.prefix.trim()) {
      errors.push({ field: 'prefix', message: 'Book Prefix is required (e.g. PR-25).' });
    } else if (data.prefix.trim().length > 20) {
      errors.push({ field: 'prefix', message: 'Prefix cannot exceed 20 characters.' });
    }

    if (!data.bookName || !data.bookName.trim()) {
      errors.push({ field: 'bookName', message: 'Book Name is required.' });
    }

    if (!data.financialYearId || !data.financialYearId.trim()) {
      errors.push({ field: 'financialYearId', message: 'Financial Year ID is required for a Production Book.' });
    }
  } else {
    if (data.prefix !== undefined) {
      if (!data.prefix.trim()) {
        errors.push({ field: 'prefix', message: 'Book Prefix cannot be empty.' });
      } else if (data.prefix.trim().length > 20) {
        errors.push({ field: 'prefix', message: 'Prefix cannot exceed 20 characters.' });
      }
    }
    if (data.bookName !== undefined && !data.bookName.trim()) {
      errors.push({ field: 'bookName', message: 'Book Name cannot be empty.' });
    }
  }

  if (data.openingBalance !== undefined && data.openingBalance !== null && data.openingBalance !== '') {
    const num = Number(data.openingBalance);
    if (isNaN(num) || num < 0) {
      errors.push({ field: 'openingBalance', message: 'Opening balance must be a non-negative number.' });
    }
  }

  return errors;
}
