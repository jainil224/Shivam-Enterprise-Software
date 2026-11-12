// Phase 17 - Bank Book HTTP layer.

import type { Request, Response } from 'express';
import { bankBookService } from '../services/bankBookService.js';
import { readCompanyScope, readScope, sendError, sendScopeRequired } from '../utils/httpScope.js';

function body(req: Request): Record<string, unknown> {
  return (req.body ?? {}) as Record<string, unknown>;
}

export const getBankBookOptions = async (req: Request, res: Response): Promise<void> => {
  const scope = readScope(req);
  if (!scope) return sendScopeRequired(res);
  try {
    const options = await bankBookService.getOptions(scope.companyId, scope.financialYearId);
    res.status(200).json({ data: options });
  } catch (err) {
    sendError(res, err, 'Failed to load Bank Book options.');
  }
};

export const runBankBook = async (req: Request, res: Response): Promise<void> => {
  const scope = readScope(req);
  if (!scope) return sendScopeRequired(res);
  try {
    const result = await bankBookService.run(scope.companyId, scope.financialYearId, body(req));
    res.status(200).json({ data: result });
  } catch (err) {
    sendError(res, err, 'Failed to generate the Bank Book.');
  }
};

export const exportBankBookXlsx = async (req: Request, res: Response): Promise<void> => {
  const scope = readScope(req);
  if (!scope) return sendScopeRequired(res);
  try {
    const { buffer, filename } = await bankBookService.exportXlsx(
      scope.companyId,
      scope.financialYearId,
      body(req)
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Content-Length', String(buffer.length));
    res.status(200).end(buffer);
  } catch (err) {
    sendError(res, err, 'Failed to export the Bank Book.');
  }
};

export const exportBankBookPdf = async (req: Request, res: Response): Promise<void> => {
  const scope = readScope(req);
  if (!scope) return sendScopeRequired(res);
  try {
    const { buffer, filename } = await bankBookService.exportPdf(
      scope.companyId,
      scope.financialYearId,
      body(req)
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Content-Length', String(buffer.length));
    res.status(200).end(buffer);
  } catch (err) {
    sendError(res, err, 'Failed to export the Bank Book as PDF.');
  }
};

export const listBankBookSavedReports = async (req: Request, res: Response): Promise<void> => {
  const scope = readScope(req);
  if (!scope) return sendScopeRequired(res);
  try {
    const reports = await bankBookService.listSavedReports(scope.companyId, scope.financialYearId);
    res.status(200).json({ data: reports });
  } catch (err) {
    sendError(res, err, 'Failed to load saved Bank Book reports.');
  }
};

export const createBankBookSavedReport = async (req: Request, res: Response): Promise<void> => {
  const scope = readScope(req);
  if (!scope) return sendScopeRequired(res);
  try {
    const report = await bankBookService.saveReport(
      scope.companyId,
      scope.financialYearId,
      body(req),
      null
    );
    res.status(201).json({ data: report });
  } catch (err) {
    sendError(res, err, 'Failed to save the Bank Book report.');
  }
};

export const updateBankBookSavedReport = async (req: Request, res: Response): Promise<void> => {
  const scope = readScope(req);
  if (!scope) return sendScopeRequired(res);
  try {
    const report = await bankBookService.saveReport(
      scope.companyId,
      scope.financialYearId,
      body(req),
      String(req.params.id ?? '')
    );
    res.status(200).json({ data: report });
  } catch (err) {
    sendError(res, err, 'Failed to update the saved Bank Book report.');
  }
};

export const deleteBankBookSavedReport = async (req: Request, res: Response): Promise<void> => {
  const companyId = readCompanyScope(req);
  if (!companyId) {
    res.status(400).json({ error: { message: 'x-company-id header is required.' } });
    return;
  }
  try {
    await bankBookService.deleteSavedReport(companyId, String(req.params.id ?? ''));
    res.status(200).json({ data: { deleted: true } });
  } catch (err) {
    sendError(res, err, 'Failed to delete the saved Bank Book report.');
  }
};