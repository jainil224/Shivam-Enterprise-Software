/**
 * Phase 15.2 - Validation for report master data.
 * Every validator returns a list of field-level errors so the API can reply
 * with a stable 400 payload and the UI can highlight the offending input.
 */
import { ValidationError, PHONE_REGEX } from './validators.js';

const isBlank = (value?: string | null): boolean =>
  value === undefined || value === null || value.trim().length === 0;

const tooLong = (value: string, max: number): boolean => value.trim().length > max;

function validatePhone(phone: string | null | undefined, errors: ValidationError[]) {
  if (phone === undefined || phone === null || phone.trim().length === 0) return;
  if (!PHONE_REGEX.test(phone.trim())) {
    errors.push({ field: 'phone', message: 'Phone must be a valid 10-digit Indian number.' });
  }
}

export function validateNamedGroupInput(
  data: { groupName?: string; description?: string | null },
  isUpdate = false,
  fieldName: 'groupName' | 'areaName' = 'groupName'
): ValidationError[] {
  const errors: ValidationError[] = [];
  const value = (data as any)[fieldName] as string | undefined;

  if (!isUpdate || value !== undefined) {
    if (isBlank(value)) {
      errors.push({ field: fieldName, message: 'Name is required.' });
    } else if (tooLong(value as string, 80)) {
      errors.push({ field: fieldName, message: 'Name must be 80 characters or fewer.' });
    }
  }

  if (data.description !== undefined && data.description !== null && tooLong(data.description, 255)) {
    errors.push({ field: 'description', message: 'Description must be 255 characters or fewer.' });
  }

  return errors;
}

export function validateAreaInput(
  data: { areaName?: string; description?: string | null },
  isUpdate = false
): ValidationError[] {
  return validateNamedGroupInput(data, isUpdate, 'areaName');
}

export function validateCodedMasterInput(
  data: { code?: string; name?: string; phone?: string | null },
  isUpdate = false,
  labels: { codeField: string; nameField: string; codeLabel: string; nameLabel: string } = {
    codeField: 'code',
    nameField: 'name',
    codeLabel: 'Code',
    nameLabel: 'Name',
  }
): ValidationError[] {
  const errors: ValidationError[] = [];
  const code = (data as any)[labels.codeField] as string | undefined;
  const name = (data as any)[labels.nameField] as string | undefined;

  if (!isUpdate || code !== undefined) {
    if (isBlank(code)) {
      errors.push({ field: labels.codeField, message: `${labels.codeLabel} is required.` });
    } else if (tooLong(code as string, 20)) {
      errors.push({ field: labels.codeField, message: `${labels.codeLabel} must be 20 characters or fewer.` });
    } else if (!/^[A-Za-z0-9_-]+$/.test((code as string).trim())) {
      errors.push({
        field: labels.codeField,
        message: `${labels.codeLabel} may only contain letters, numbers, hyphen and underscore.`,
      });
    }
  }

  if (!isUpdate || name !== undefined) {
    if (isBlank(name)) {
      errors.push({ field: labels.nameField, message: `${labels.nameLabel} is required.` });
    } else if (tooLong(name as string, 120)) {
      errors.push({ field: labels.nameField, message: `${labels.nameLabel} must be 120 characters or fewer.` });
    }
  }

  validatePhone(data.phone, errors);
  return errors;
}

export function validateBrokerInput(
  data: { brokerCode?: string; brokerName?: string; phone?: string | null },
  isUpdate = false
): ValidationError[] {
  return validateCodedMasterInput(data, isUpdate, {
    codeField: 'brokerCode',
    nameField: 'brokerName',
    codeLabel: 'Broker code',
    nameLabel: 'Broker name',
  });
}

export function validateTransporterInput(
  data: { transporterCode?: string; transporterName?: string; phone?: string | null },
  isUpdate = false
): ValidationError[] {
  return validateCodedMasterInput(data, isUpdate, {
    codeField: 'transporterCode',
    nameField: 'transporterName',
    codeLabel: 'Transporter code',
    nameLabel: 'Transporter name',
  });
}

export function validateSalespersonInput(
  data: { salespersonCode?: string; salespersonName?: string; phone?: string | null },
  isUpdate = false
): ValidationError[] {
  return validateCodedMasterInput(data, isUpdate, {
    codeField: 'salespersonCode',
    nameField: 'salespersonName',
    codeLabel: 'Salesperson code',
    nameLabel: 'Salesperson name',
  });
}

export function validatePurchaseBookInput(
  data: { prefix?: string; bookName?: string; financialYearId?: string },
  isUpdate = false
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!isUpdate || data.financialYearId !== undefined) {
    if (isBlank(data.financialYearId)) {
      errors.push({ field: 'financialYearId', message: 'Financial year is required.' });
    }
  }

  if (!isUpdate || data.prefix !== undefined) {
    if (isBlank(data.prefix)) {
      errors.push({ field: 'prefix', message: 'Prefix is required.' });
    } else if (tooLong(data.prefix as string, 12)) {
      errors.push({ field: 'prefix', message: 'Prefix must be 12 characters or fewer.' });
    } else if (!/^[A-Za-z0-9/_-]+$/.test((data.prefix as string).trim())) {
      errors.push({
        field: 'prefix',
        message: 'Prefix may only contain letters, numbers, slash, hyphen and underscore.',
      });
    }
  }

  if (!isUpdate || data.bookName !== undefined) {
    if (isBlank(data.bookName)) {
      errors.push({ field: 'bookName', message: 'Book name is required.' });
    } else if (tooLong(data.bookName as string, 60)) {
      errors.push({ field: 'bookName', message: 'Book name must be 60 characters or fewer.' });
    }
  }

  return errors;
}