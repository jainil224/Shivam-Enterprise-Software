// Phase 19.3 - WhatsApp integration HTTP layer.
//
// Company (and, where required, financial year) come from the request headers.
// Nothing about the tenant, the PDF path or the party is ever read from the body.

import type { Request, Response } from 'express';
import { whatsappSessionService } from '../services/whatsapp/whatsappSessionService.js';
import { whatsappMessageService } from '../services/whatsapp/whatsappMessageService.js';
import {
  readCompanyScope,
  readScope,
  sendError,
  sendScopeRequired,
} from '../utils/httpScope.js';

function requireCompany(req: Request, res: Response): string | null {
  const companyId = readCompanyScope(req);
  if (!companyId) {
    sendScopeRequired(res);
    return null;
  }
  return companyId;
}

export const whatsappController = {
  status(req: Request, res: Response): void {
    const companyId = requireCompany(req, res);
    if (!companyId) return;
    res.json({ status: whatsappSessionService.getStatus(companyId) });
  },

  async connect(req: Request, res: Response): Promise<void> {
    const companyId = requireCompany(req, res);
    if (!companyId) return;
    try {
      const status = await whatsappSessionService.connect(companyId);
      res.status(202).json({ status });
    } catch (error) {
      sendError(res, error, 'Unable to start the WhatsApp connection.');
    }
  },

  async qr(req: Request, res: Response): Promise<void> {
    const companyId = requireCompany(req, res);
    if (!companyId) return;
    try {
      const payload = await whatsappSessionService.getQr(companyId);
      // Never cached: a QR code is a short-lived credential.
      res.setHeader('Cache-Control', 'no-store');
      res.json(payload);
    } catch (error) {
      sendError(res, error, 'No QR code is available.');
    }
  },

  async disconnect(req: Request, res: Response): Promise<void> {
    const companyId = requireCompany(req, res);
    if (!companyId) return;
    try {
      const status = await whatsappSessionService.disconnect(companyId);
      res.json({ status });
    } catch (error) {
      sendError(res, error, 'Unable to disconnect WhatsApp.');
    }
  },

  async sendDocument(req: Request, res: Response): Promise<void> {
    const scope = readScope(req);
    if (!scope) {
      sendScopeRequired(res);
      return;
    }
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await whatsappMessageService.sendDocument(scope, {
        documentType: String(body.documentType ?? ''),
        documentId: String(body.documentId ?? ''),
        recipientNumber: String(body.recipientNumber ?? ''),
        message: body.message === undefined || body.message === null ? undefined : String(body.message),
        reportRequest:
          body.reportRequest && typeof body.reportRequest === 'object'
            ? (body.reportRequest as Record<string, unknown>)
            : undefined,
      });
      res.status(201).json({ result });
    } catch (error) {
      sendError(res, error, 'Unable to send the document on WhatsApp.');
    }
  },

  async history(req: Request, res: Response): Promise<void> {
    const scope = readScope(req);
    if (!scope) {
      sendScopeRequired(res);
      return;
    }
    try {
      const result = await whatsappMessageService.getHistory(scope, {
        limit: req.query.limit === undefined ? undefined : Number(req.query.limit),
        offset: req.query.offset === undefined ? undefined : Number(req.query.offset),
        status: req.query.status === undefined ? undefined : String(req.query.status),
      });
      res.json(result);
    } catch (error) {
      sendError(res, error, 'Unable to load the WhatsApp send history.');
    }
  },

  async historyById(req: Request, res: Response): Promise<void> {
    const scope = readScope(req);
    if (!scope) {
      sendScopeRequired(res);
      return;
    }
    try {
      const entry = await whatsappMessageService.getHistoryById(scope, String(req.params.id));
      res.json({ entry });
    } catch (error) {
      sendError(res, error, 'Unable to load the WhatsApp history entry.');
    }
  },
};