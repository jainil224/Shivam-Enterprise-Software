// Phase 19 - Account Wise Balance HTTP layer. Company and financial year always
// come from the request headers, never from the body.

import type { Request, Response } from 'express';
import { accountWiseBalanceService } from '../services/accountWiseBalanceService.js';
import { readScope, sendError, sendScopeRequired } from '../utils/httpScope.js';

function body(req: Request): Record<string, unknown> {
  return (req.body ?? {}) as Record<string, unknown>;
}

export const getAccountWiseBalanceOptions = async (
  req: Request,
  res: Response
): Promise<void> => {
  const scope = readScope(req);
  if (!scope) return sendScopeRequired(res);
  try {
    const options = await accountWiseBalanceService.getOptions(
      scope.companyId,
      scope.financialYearId
    );
    res.status(200).json({ data: options });
  } catch (err) {
    sendError(res, err, 'Failed to load Account Wise Balance options.');
  }
};

export const queryAccountWiseBalance = async (req: Request, res: Response): Promise<void> => {
  const scope = readScope(req);
  if (!scope) return sendScopeRequired(res);
  try {
    const result = await accountWiseBalanceService.run(
      scope.companyId,
      scope.financialYearId,
      body(req)
    );
    res.status(200).json({ data: result });
  } catch (err) {
    sendError(res, err, 'Failed to generate the Account Wise Balance report.');
  }
};
/** Account + Month Wise Balance - read-only JSON payload. */
export const queryAccountWiseBalanceMonthWise = async (
  req: Request,
  res: Response
): Promise<void> => {
  const scope = readScope(req);
  if (!scope) return sendScopeRequired(res);
  try {
    const result = await accountWiseBalanceService.runMonthWise(
      scope.companyId,
      scope.financialYearId,
      body(req)
    );
    res.status(200).json({ data: result });
  } catch (err) {
    sendError(res, err, 'Failed to generate the Account + Month Wise Balance report.');
  }
};

/** Genuine A4 PDF of the Account Wise Balance print document. */
export const exportAccountWiseBalancePdf = async (
  req: Request,
  res: Response
): Promise<void> => {
  const scope = readScope(req);
  if (!scope) return sendScopeRequired(res);
  try {
    const { buffer, filename } = await accountWiseBalanceService.exportPdf(
      scope.companyId,
      scope.financialYearId,
      body(req)
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Content-Length', String(buffer.length));
    res.status(200).end(buffer);
  } catch (err) {
    sendError(res, err, 'Failed to export the Account Wise Balance PDF.');
  }
};

/** Genuine A4 landscape PDF of the Account + Month Wise Balance document. */
export const exportAccountWiseBalanceMonthWisePdf = async (
  req: Request,
  res: Response
): Promise<void> => {
  const scope = readScope(req);
  if (!scope) return sendScopeRequired(res);
  try {
    const { buffer, filename } = await accountWiseBalanceService.exportMonthWisePdf(
      scope.companyId,
      scope.financialYearId,
      body(req)
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.setHeader('Content-Length', String(buffer.length));
    res.status(200).end(buffer);
  } catch (err) {
    sendError(res, err, 'Failed to export the Account + Month Wise Balance PDF.');
  }
};