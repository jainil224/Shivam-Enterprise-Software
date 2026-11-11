// Phase 15.1 - saved report column layouts.
// Company scoped: no user identity infrastructure exists yet, so a layout is
// visible to every session working in the same company.

import { Prisma } from '@prisma/client';
import {
  reportLayoutRepository,
  ReportColumnLayoutRow,
} from '../repositories/reportLayoutRepository.js';
import { REPORT_COLUMNS, REQUIRED_COLUMNS } from './reportService.js';
import type { ReportColumnLayout, ReportColumnLayoutInput } from '../types/reportTypes.js';

type LayoutError = Error & { statusCode: number };

function layoutError(message: string, statusCode: number): LayoutError {
  const error = new Error(message) as LayoutError;
  error.statusCode = statusCode;
  return error;
}

const DEFAULT_REPORT_TYPE = 'BILL_BASE';
const MAX_NAME_LENGTH = 60;

function readColumnArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function catalogueKeys(): Set<string> {
  return new Set(REPORT_COLUMNS.map((column) => column.key));
}

/**
 * Validates and normalises a column list: every id must exist in the current
 * catalogue, required columns must be present, duplicates are removed and the
 * caller supplied order is preserved.
 */
function validateColumns(input: unknown, label: string): string[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw layoutError(label + ' must be a non-empty array of column ids.', 400);
  }
  const available = catalogueKeys();
  const columns: string[] = [];
  const unknown: string[] = [];
  for (const entry of input) {
    const key = String(entry ?? '').trim();
    if (key.length === 0) continue;
    if (!available.has(key)) {
      if (!unknown.includes(key)) unknown.push(key);
      continue;
    }
    if (!columns.includes(key)) columns.push(key);
  }
  if (unknown.length > 0) {
    throw layoutError('Unknown report column(s): ' + unknown.join(', ') + '.', 400);
  }
  if (columns.length === 0) {
    throw layoutError('At least one valid column is required.', 400);
  }
  const missing = REQUIRED_COLUMNS.filter((key) => !columns.includes(key));
  if (missing.length > 0) {
    throw layoutError(
      'Required column(s) cannot be removed: ' +
        missing.map((key) => REPORT_COLUMNS.find((column) => column.key === key)?.label ?? key).join(', ') +
        '.',
      400
    );
  }
  return columns;
}

function validateName(input: unknown): string {
  const name = String(input ?? '').trim();
  if (name.length === 0) throw layoutError('A layout name is required.', 400);
  if (name.length > MAX_NAME_LENGTH) {
    throw layoutError('A layout name cannot be longer than ' + MAX_NAME_LENGTH + ' characters.', 400);
  }
  return name;
}

function resolveReportType(input: unknown): string {
  const reportType = String(input ?? DEFAULT_REPORT_TYPE).trim().toUpperCase();
  return reportType.length === 0 ? DEFAULT_REPORT_TYPE : reportType;
}

function toLayout(row: ReportColumnLayoutRow): ReportColumnLayout {
  const available = catalogueKeys();
  const selected = readColumnArray(row.selectedColumns);
  const order = readColumnArray(row.columnOrder);
  const stored = order.length > 0 ? order : selected;
  const columns: string[] = [];
  const unavailable: string[] = [];
  for (const key of stored) {
    if (!available.has(key)) {
      if (!unavailable.includes(key)) unavailable.push(key);
      continue;
    }
    if (!columns.includes(key)) columns.push(key);
  }
  for (const key of REQUIRED_COLUMNS) {
    if (!columns.includes(key)) columns.push(key);
  }
  return {
    id: row.id,
    reportType: row.reportType,
    name: row.layoutName,
    columns,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    unavailableColumns: unavailable,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export class ReportLayoutService {
  async list(companyId: string, reportTypeInput?: unknown): Promise<ReportColumnLayout[]> {
    const reportType = resolveReportType(reportTypeInput);
    const rows = await reportLayoutRepository.list(companyId, reportType);
    return rows.map(toLayout);
  }

  async getById(companyId: string, id: string, reportTypeInput?: unknown): Promise<ReportColumnLayout> {
    const reportType = resolveReportType(reportTypeInput);
    const layoutId = String(id ?? '').trim();
    if (layoutId.length === 0) throw layoutError('A layout id is required.', 400);
    const row = await reportLayoutRepository.findById(companyId, reportType, layoutId);
    if (!row) throw layoutError('Saved layout not found for this company.', 404);
    return toLayout(row);
  }

  async create(companyId: string, input: ReportColumnLayoutInput): Promise<ReportColumnLayout> {
    const reportType = resolveReportType(input?.reportType);
    const name = validateName(input?.name);
    const columns = validateColumns(input?.columns, 'columns');

    const existing = await reportLayoutRepository.findByName(companyId, reportType, name);
    if (existing) throw layoutError('A layout named "' + name + '" already exists for this company.', 409);

    try {
      const row = await reportLayoutRepository.create({
        companyId,
        reportType,
        layoutName: name,
        selectedColumns: columns,
        columnOrder: columns,
        isDefault: input?.isDefault === true,
        createdBy: null,
      });
      if (row.isDefault) {
        await reportLayoutRepository.clearDefault(companyId, reportType, row.id);
      }
      return toLayout(row);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw layoutError('A layout named "' + name + '" already exists for this company.', 409);
      }
      throw err;
    }
  }

  async update(
    companyId: string,
    id: string,
    input: Partial<ReportColumnLayoutInput>
  ): Promise<ReportColumnLayout> {
    const reportType = resolveReportType(input?.reportType);
    const layoutId = String(id ?? '').trim();
    if (layoutId.length === 0) throw layoutError('A layout id is required.', 400);
    const current = await reportLayoutRepository.findById(companyId, reportType, layoutId);
    if (!current) throw layoutError('Saved layout not found for this company.', 404);

    const name = input?.name === undefined ? current.layoutName : validateName(input.name);
    if (name !== current.layoutName) {
      const duplicate = await reportLayoutRepository.findByName(companyId, reportType, name, layoutId);
      if (duplicate) throw layoutError('A layout named "' + name + '" already exists for this company.', 409);
    }
    const columns =
      input?.columns === undefined
        ? toLayout(current).columns
        : validateColumns(input.columns, 'columns');

    try {
      const row = await reportLayoutRepository.update(layoutId, {
        layoutName: name,
        selectedColumns: columns,
        columnOrder: columns,
        ...(input?.isDefault !== undefined ? { isDefault: input.isDefault === true } : {}),
      });
      if (row.isDefault) {
        await reportLayoutRepository.clearDefault(companyId, reportType, row.id);
      }
      return toLayout(row);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw layoutError('A layout named "' + name + '" already exists for this company.', 409);
      }
      throw err;
    }
  }

  async remove(companyId: string, id: string, reportTypeInput?: unknown): Promise<void> {
    const reportType = resolveReportType(reportTypeInput);
    const layoutId = String(id ?? '').trim();
    if (layoutId.length === 0) throw layoutError('A layout id is required.', 400);
    const row = await reportLayoutRepository.findById(companyId, reportType, layoutId);
    if (!row) throw layoutError('Saved layout not found for this company.', 404);
    await reportLayoutRepository.remove(layoutId);
  }

  async setDefault(companyId: string, id: string, reportTypeInput?: unknown): Promise<ReportColumnLayout> {
    const reportType = resolveReportType(reportTypeInput);
    const layoutId = String(id ?? '').trim();
    if (layoutId.length === 0) throw layoutError('A layout id is required.', 400);
    const row = await reportLayoutRepository.findById(companyId, reportType, layoutId);
    if (!row) throw layoutError('Saved layout not found for this company.', 404);
    const updated = await reportLayoutRepository.setDefault(companyId, reportType, layoutId);
    return toLayout(updated);
  }
}

export const reportLayoutService = new ReportLayoutService();
