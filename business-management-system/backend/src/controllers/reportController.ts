// Phase 15 - Sales & Purchase Report (Bill Base) HTTP layer.

import { Request, Response } from 'express';
import { reportService } from '../services/reportService.js';
import type { ReportRunRequest } from '../types/reportTypes.js';

function readScope(req: Request): { companyId: string; financialYearId: string } | null {
  const companyId = req.headers['x-company-id'] as string;
  const financialYearId = req.headers['x-financial-year-id'] as string;
  if (!companyId || !financialYearId) return null;
  return { companyId, financialYearId };
}

function fail(res: Response, err: unknown, fallback: string): void {
  const error = err as { statusCode?: number; message?: string };
  const statusCode = error.statusCode ?? 500;
  res.status(statusCode).json({ error: { message: error.message ?? fallback } });
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toRunRequest(body: Record<string, unknown>): ReportRunRequest {
  return {
    dateFrom: String(body.dateFrom ?? ''),
    dateTo: String(body.dateTo ?? ''),
    mode: (body.mode as ReportRunRequest['mode']) ?? 'PURCHASE',
    sources: Array.isArray(body.sources) ? (body.sources as ReportRunRequest['sources']) : undefined,
    format: String(body.format ?? ''),
    bookId: body.bookId ? String(body.bookId) : null,
    partyId: body.partyId ? String(body.partyId) : null,
    itemId: body.itemId ? String(body.itemId) : null,
    itemGroup: body.itemGroup ? String(body.itemGroup) : null,
    quality: body.quality ? String(body.quality) : null,
    partyCity: body.partyCity ? String(body.partyCity) : null,
    rateColumn: (body.rateColumn as ReportRunRequest['rateColumn']) ?? 'BASIC',
    rateFrom: parseNumber(body.rateFrom),
    rateTo: parseNumber(body.rateTo),
    detailMode: body.detailMode === 'SUMMARY' ? 'SUMMARY' : 'DETAIL',
    printItemDetails: body.printItemDetails === true,
    columns: Array.isArray(body.columns) ? (body.columns as string[]) : undefined,
    groupBy: Array.isArray(body.groupBy) ? (body.groupBy as string[]) : undefined,
    page: parseNumber(body.page) ?? 1,
    pageSize: parseNumber(body.pageSize) ?? 100,
    sortBy: body.sortBy ? String(body.sortBy) : null,
    sortDir: body.sortDir === 'desc' ? 'desc' : 'asc',
    includeCancelled: body.includeCancelled === true,
  };
}

export const getReportOptions = async (req: Request, res: Response): Promise<void> => {
  const scope = readScope(req);
  if (!scope) {
    res.status(400).json({ error: { message: 'x-company-id and x-financial-year-id headers are required.' } });
    return;
  }
  try {
    const options = await reportService.getOptions(scope.companyId, scope.financialYearId);
    res.status(200).json({ data: options });
  } catch (err) {
    fail(res, err, 'Failed to load report options.');
  }
};

export const runReport = async (req: Request, res: Response): Promise<void> => {
  const scope = readScope(req);
  if (!scope) {
    res.status(400).json({ error: { message: 'x-company-id and x-financial-year-id headers are required.' } });
    return;
  }
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const result = await reportService.execute(scope.companyId, scope.financialYearId, toRunRequest(body));
    res.status(200).json({ data: result });
  } catch (err) {
    fail(res, err, 'Failed to generate the report.');
  }
};

export const exportReportXlsx = async (req: Request, res: Response): Promise<void> => {
  const scope = readScope(req);
  if (!scope) {
    res.status(400).json({ error: { message: 'x-company-id and x-financial-year-id headers are required.' } });
    return;
  }
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const result = await reportService.execute(scope.companyId, scope.financialYearId, toRunRequest(body), true);
    const { buffer, filename } = reportService.exportXlsx(result);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Content-Length', String(buffer.length));
    res.status(200).end(buffer);
  } catch (err) {
    fail(res, err, 'Failed to export the report.');
  }
};

export const getReportItemDetails = async (req: Request, res: Response): Promise<void> => {
  const scope = readScope(req);
  if (!scope) {
    res.status(400).json({ error: { message: 'x-company-id and x-financial-year-id headers are required.' } });
    return;
  }
  try {
    const sourceType = String(req.query.sourceType ?? '');
    const sourceId = String(req.query.sourceId ?? '');
    const details = await reportService.getItemDetails(scope.companyId, sourceType, sourceId);
    res.status(200).json({ data: details });
  } catch (err) {
    fail(res, err, 'Failed to load item details.');
  }
};
