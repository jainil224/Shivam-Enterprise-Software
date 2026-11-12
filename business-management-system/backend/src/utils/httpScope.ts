// Shared HTTP helpers for the Phase 17 report controllers.
// The company and financial year always come from the request headers, never
// from the body, so a caller cannot report on another company's data.

import type { Request, Response } from 'express';

export interface RequestScope {
  companyId: string;
  financialYearId: string;
}

export function readScope(req: Request): RequestScope | null {
  const companyId = req.headers['x-company-id'] as string | undefined;
  const financialYearId = req.headers['x-financial-year-id'] as string | undefined;
  if (!companyId || !financialYearId) return null;
  return { companyId, financialYearId };
}

export function readCompanyScope(req: Request): string | null {
  const companyId = req.headers['x-company-id'] as string | undefined;
  return companyId ?? null;
}

export function sendError(res: Response, err: unknown, fallback: string): void {
  const error = err as { statusCode?: number; message?: string };
  const statusCode = error.statusCode ?? 500;
  res.status(statusCode).json({ error: { message: error.message ?? fallback } });
}

export function sendScopeRequired(res: Response): void {
  res.status(400).json({
    error: { message: 'x-company-id and x-financial-year-id headers are required.' },
  });
}