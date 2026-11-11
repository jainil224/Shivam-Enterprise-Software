// Phase 15 - Sales & Purchase Report (Bill Base) HTTP layer.

import { Request, Response } from 'express';
import { reportService } from '../services/reportService.js';
import { reportLayoutService } from '../services/reportLayoutService.js';
import type {
  ReportColumnFilter,
  ReportColumnLayoutInput,
  ReportRunRequest,
} from '../types/reportTypes.js';

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

function toColumnFilters(value: unknown): ReportColumnFilter[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    return {
      key: String(item.key ?? ''),
      operator: String(item.operator ?? '') as ReportColumnFilter['operator'],
      value: item.value === undefined || item.value === null ? null : String(item.value),
      valueTo: item.valueTo === undefined || item.valueTo === null ? null : String(item.valueTo),
    };
  });
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
    // Phase 15.2 - master filters must survive the HTTP boundary, otherwise the
    // UI would show a selected broker / transporter / area that never narrows.
    partyGroupId: body.partyGroupId ? String(body.partyGroupId) : null,
    areaId: body.areaId ? String(body.areaId) : null,
    deliveryPartyId: body.deliveryPartyId ? String(body.deliveryPartyId) : null,
    brokerId: body.brokerId ? String(body.brokerId) : null,
    transporterId: body.transporterId ? String(body.transporterId) : null,
    salespersonId: body.salespersonId ? String(body.salespersonId) : null,
    vehicle: body.vehicle ? String(body.vehicle) : null,
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
    columnFilters: toColumnFilters(body.columnFilters),
    pdfOrientation:
      body.pdfOrientation === 'landscape'
        ? 'landscape'
        : body.pdfOrientation === 'portrait'
          ? 'portrait'
          : undefined,
  };
}

function readCompanyScope(req: Request): string | null {
  const companyId = req.headers['x-company-id'] as string;
  return companyId ? companyId : null;
}

function readReportType(value: unknown): string {
  const reportType = String(value ?? '').trim();
  return reportType.length > 0 ? reportType : 'BILL_BASE';
}

function toLayoutInput(body: Record<string, unknown>): Partial<ReportColumnLayoutInput> {
  const input: Partial<ReportColumnLayoutInput> = {};
  if (body.name !== undefined) input.name = String(body.name);
  if (body.reportType !== undefined) input.reportType = String(body.reportType);
  if (body.columns !== undefined) {
    input.columns = Array.isArray(body.columns) ? body.columns.map((entry) => String(entry)) : [];
  }
  if (body.isDefault !== undefined) input.isDefault = body.isDefault === true;
  return input;
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

export const exportReportPdf = async (req: Request, res: Response): Promise<void> => {
  const scope = readScope(req);
  if (!scope) {
    res.status(400).json({ error: { message: 'x-company-id and x-financial-year-id headers are required.' } });
    return;
  }
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { buffer, filename } = await reportService.exportPdf(
      scope.companyId,
      scope.financialYearId,
      toRunRequest(body)
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Content-Length', String(buffer.length));
    res.status(200).end(buffer);
  } catch (err) {
    fail(res, err, 'Failed to export the report as PDF.');
  }
};

export const listReportColumnLayouts = async (req: Request, res: Response): Promise<void> => {
  const companyId = readCompanyScope(req);
  if (!companyId) {
    res.status(400).json({ error: { message: 'x-company-id header is required.' } });
    return;
  }
  try {
    const layouts = await reportLayoutService.list(companyId, req.query.reportType);
    res.status(200).json({ data: layouts });
  } catch (err) {
    fail(res, err, 'Failed to load saved column layouts.');
  }
};

export const getReportColumnLayout = async (req: Request, res: Response): Promise<void> => {
  const companyId = readCompanyScope(req);
  if (!companyId) {
    res.status(400).json({ error: { message: 'x-company-id header is required.' } });
    return;
  }
  try {
    const layout = await reportLayoutService.getById(companyId, req.params.id, req.query.reportType);
    res.status(200).json({ data: layout });
  } catch (err) {
    fail(res, err, 'Failed to load the saved column layout.');
  }
};

export const createReportColumnLayout = async (req: Request, res: Response): Promise<void> => {
  const companyId = readCompanyScope(req);
  if (!companyId) {
    res.status(400).json({ error: { message: 'x-company-id header is required.' } });
    return;
  }
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const layout = await reportLayoutService.create(companyId, {
      name: String(body.name ?? ''),
      reportType: body.reportType === undefined ? undefined : readReportType(body.reportType),
      columns: Array.isArray(body.columns) ? body.columns.map((entry) => String(entry)) : [],
      isDefault: body.isDefault === true,
    });
    res.status(201).json({ data: layout });
  } catch (err) {
    fail(res, err, 'Failed to save the column layout.');
  }
};

export const updateReportColumnLayout = async (req: Request, res: Response): Promise<void> => {
  const companyId = readCompanyScope(req);
  if (!companyId) {
    res.status(400).json({ error: { message: 'x-company-id header is required.' } });
    return;
  }
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const layout = await reportLayoutService.update(companyId, req.params.id, toLayoutInput(body));
    res.status(200).json({ data: layout });
  } catch (err) {
    fail(res, err, 'Failed to update the column layout.');
  }
};

export const deleteReportColumnLayout = async (req: Request, res: Response): Promise<void> => {
  const companyId = readCompanyScope(req);
  if (!companyId) {
    res.status(400).json({ error: { message: 'x-company-id header is required.' } });
    return;
  }
  try {
    await reportLayoutService.remove(companyId, req.params.id, req.query.reportType);
    res.status(200).json({ data: { deleted: true } });
  } catch (err) {
    fail(res, err, 'Failed to delete the column layout.');
  }
};

export const setDefaultReportColumnLayout = async (req: Request, res: Response): Promise<void> => {
  const companyId = readCompanyScope(req);
  if (!companyId) {
    res.status(400).json({ error: { message: 'x-company-id header is required.' } });
    return;
  }
  try {
    const layout = await reportLayoutService.setDefault(companyId, req.params.id, req.query.reportType);
    res.status(200).json({ data: layout });
  } catch (err) {
    fail(res, err, 'Failed to set the default column layout.');
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
