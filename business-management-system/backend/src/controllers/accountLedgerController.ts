// Phase 17 - Account Ledger HTTP layer.

import type { Request, Response } from 'express';
import { accountLedgerService } from '../services/accountLedgerService.js';
import { readScope, sendError, sendScopeRequired } from '../utils/httpScope.js';

function body(req: Request): Record<string, unknown> {
  return (req.body ?? {}) as Record<string, unknown>;
}

export const getAccountLedgerOptions = async (req: Request, res: Response): Promise<void> => {
  const scope = readScope(req);
  if (!scope) return sendScopeRequired(res);
  try {
    const options = await accountLedgerService.getOptions(scope.companyId, scope.financialYearId);
    res.status(200).json({ data: options });
  } catch (err) {
    sendError(res, err, 'Failed to load Account Ledger options.');
  }
};

export const runAccountLedger = async (req: Request, res: Response): Promise<void> => {
  const scope = readScope(req);
  if (!scope) return sendScopeRequired(res);
  try {
    const result = await accountLedgerService.run(scope.companyId, scope.financialYearId, body(req));
    res.status(200).json({ data: result });
  } catch (err) {
    sendError(res, err, 'Failed to generate the Account Ledger.');
  }
};

export const exportAccountLedgerXlsx = async (req: Request, res: Response): Promise<void> => {
  const scope = readScope(req);
  if (!scope) return sendScopeRequired(res);
  try {
    const { buffer, filename } = await accountLedgerService.exportXlsx(
      scope.companyId,
      scope.financialYearId,
      body(req)
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Content-Length', String(buffer.length));
    res.status(200).end(buffer);
  } catch (err) {
    sendError(res, err, 'Failed to export the Account Ledger.');
  }
};

export const exportAccountLedgerPdf = async (req: Request, res: Response): Promise<void> => {
  const scope = readScope(req);
  if (!scope) return sendScopeRequired(res);
  try {
    const { buffer, filename } = await accountLedgerService.exportPdf(
      scope.companyId,
      scope.financialYearId,
      body(req)
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Content-Length', String(buffer.length));
    res.status(200).end(buffer);
  } catch (err) {
    sendError(res, err, 'Failed to export the Account Ledger as PDF.');
  }
};