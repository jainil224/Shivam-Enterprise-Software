// Phase 19.3 - WhatsApp document delivery + audit history.
//
// Rules enforced here:
//  * the session must really be CONNECTED before anything is sent;
//  * the recipient number is normalised and validated server-side;
//  * one company can only run one send at a time (browser safety);
//  * the same document cannot be double-sent to the same number in a burst;
//  * a history row is written before the network call and updated with the
//    actual outcome, so a success row always means the send call succeeded.

import { prisma } from '../../utils/prisma.js';
import { AppError } from '../../utils/appError.js';
import { prepareDocument } from './whatsappPdfService.js';
import { whatsappSessionService } from './whatsappSessionService.js';
import {
  WHATSAPP_DOCUMENT_LABELS,
  isWhatsAppDocumentType,
  type PreparedWhatsAppDocument,
  type SendWhatsAppDocumentInput,
  type SendWhatsAppDocumentResult,
  type WhatsAppHistoryEntry,
  type WhatsAppMessageStatus,
} from '../../types/whatsapp.js';
import type { DocumentPdfScope } from './whatsappDocumentPdf.js';
import type { WhatsAppSessionService } from './whatsappSessionService.js';

const SEND_TIMEOUT_MS = 60_000;
const RECENT_DUPLICATE_WINDOW_MS = 60_000;
const MAX_MESSAGE_LENGTH = 1000;

/**
 * Normalises an Indian mobile number to the WhatsApp chat id format
 * (91XXXXXXXXXX). Accepts +91, 0091, 0-prefixed and bare 10-digit input.
 */
export function normaliseWhatsAppNumber(raw: unknown): string {
  const input = String(raw ?? '').trim();
  if (input.length === 0) {
    throw new AppError(400, 'Recipient mobile number is required.', undefined, 'VALIDATION_ERROR');
  }
  if (!/^[0-9+\-()\s]+$/.test(input)) {
    throw new AppError(
      400,
      'Recipient mobile number contains invalid characters.',
      undefined,
      'VALIDATION_ERROR'
    );
  }
  let digits = input.replace(/[^0-9]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length !== 10) {
    throw new AppError(
      400,
      'Enter a 10-digit Indian mobile number, optionally prefixed with +91.',
      undefined,
      'VALIDATION_ERROR'
    );
  }
  if (!/^[6-9][0-9]{9}$/.test(digits)) {
    throw new AppError(
      400,
      'Indian mobile numbers must start with 6, 7, 8 or 9.',
      undefined,
      'VALIDATION_ERROR'
    );
  }
  return '91' + digits;
}

function sanitizeCaption(value: unknown): string | null {
  const raw = String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ');
  const clean = raw.replace(/[ \t]+/g, ' ').trim();
  if (clean.length === 0) return null;
  return clean.slice(0, MAX_MESSAGE_LENGTH);
}

function defaultCaption(document: PreparedWhatsAppDocument): string {
  const label = WHATSAPP_DOCUMENT_LABELS[document.documentType] ?? 'document';
  const greeting = document.partyName ? 'Dear ' + document.partyName + ',' : 'Dear Sir/Madam,';
  return greeting + '\n\nPlease find attached ' + label + ' ' + document.documentNumber + '.\n\nRegards';
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AppError(504, message, undefined, 'SEND_TIMEOUT'));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export interface WhatsAppMessageServiceDeps {
  sessionService?: WhatsAppSessionService;
  prepare?: (scope: DocumentPdfScope, input: SendWhatsAppDocumentInput) => Promise<PreparedWhatsAppDocument>;
}

export class WhatsAppMessageService {
  private readonly session: WhatsAppSessionService;
  private readonly prepare: (
    scope: DocumentPdfScope,
    input: SendWhatsAppDocumentInput
  ) => Promise<PreparedWhatsAppDocument>;
  private readonly inflight = new Set<string>();
  private readonly recent = new Map<string, number>();
  private readonly queues = new Map<string, Promise<void>>();

  constructor(deps: WhatsAppMessageServiceDeps = {}) {
    this.session = deps.sessionService ?? whatsappSessionService;
    this.prepare = deps.prepare ?? prepareDocument;
  }

  /** Serialises sends per company so one browser never runs two uploads. */
  private async withCompanyLock<T>(companyId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(companyId) ?? Promise.resolve();
    const run = previous.then(task, task);
    const tail = run.then(
      () => undefined,
      () => undefined
    );
    this.queues.set(companyId, tail);
    try {
      return await run;
    } finally {
      if (this.queues.get(companyId) === tail) this.queues.delete(companyId);
    }
  }

  private duplicateKey(
    scope: DocumentPdfScope,
    documentType: string,
    documentId: string,
    recipient: string
  ): string {
    return [scope.companyId, documentType, documentId, recipient].join('|');
  }

  private assertNotDuplicate(key: string): void {
    if (this.inflight.has(key)) {
      throw new AppError(
        409,
        'This document is already being sent to that number. Please wait for it to finish.',
        undefined,
        'SEND_IN_PROGRESS'
      );
    }
    const sentAt = this.recent.get(key);
    if (sentAt && Date.now() - sentAt < RECENT_DUPLICATE_WINDOW_MS) {
      throw new AppError(
        409,
        'This document was just sent to that number. Wait a minute before sending it again.',
        undefined,
        'DUPLICATE_SEND'
      );
    }
  }

  async sendDocument(
    scope: DocumentPdfScope,
    input: SendWhatsAppDocumentInput
  ): Promise<SendWhatsAppDocumentResult> {
    const documentType = String(input.documentType || '').trim().toUpperCase();
    if (!isWhatsAppDocumentType(documentType)) {
      throw new AppError(400, 'Unsupported document type.', undefined, 'UNSUPPORTED_DOCUMENT');
    }
    if (!this.session.isConnected(scope.companyId)) {
      throw new AppError(
        409,
        'WhatsApp is not connected. Connect the account in Settings > Integrations > WhatsApp first.',
        undefined,
        'NOT_CONNECTED'
      );
    }
    const recipient = normaliseWhatsAppNumber(input.recipientNumber);
    const documentId = String(input.documentId || '').trim();
    if (documentId.length === 0) {
      throw new AppError(400, 'A document id is required.', undefined, 'VALIDATION_ERROR');
    }
    const key = this.duplicateKey(scope, documentType, documentId, recipient);
    this.assertNotDuplicate(key);
    this.inflight.add(key);

    try {
      return await this.withCompanyLock(scope.companyId, async () => {
        // Re-check: the connection may have dropped while this call was queued.
        if (!this.session.isConnected(scope.companyId)) {
          throw new AppError(
            409,
            'WhatsApp disconnected before the document could be sent. Reconnect and try again.',
            undefined,
            'NOT_CONNECTED'
          );
        }
        const document = await this.prepare(scope, { ...input, documentType });
        const caption = sanitizeCaption(input.message) ?? defaultCaption(document);
        const log = await prisma.whatsAppMessageLog.create({
          data: {
            companyId: scope.companyId,
            financialYearId: scope.financialYearId,
            documentType: document.documentType,
            documentId: document.documentId,
            partyId: document.partyId,
            recipientNumber: recipient,
            documentNumber: document.documentNumber,
            fileName: document.fileName,
            message: caption,
            status: 'PENDING',
          },
        });

        try {
          const handle = this.session.getHandle(scope.companyId);
          if (!handle) {
            throw new AppError(409, 'The WhatsApp client is no longer available.', undefined, 'NOT_CONNECTED');
          }
          const media = handle.createMedia(document.buffer, document.fileName, document.mimeType);
          await withTimeout(
            handle.client.sendMessage(recipient + '@c.us', media, { caption }),
            SEND_TIMEOUT_MS,
            'WhatsApp did not confirm the send within 60 seconds. Check the phone before retrying.'
          );
          const updated = await prisma.whatsAppMessageLog.update({
            where: { id: log.id },
            data: { status: 'SENT', errorMessage: null },
          });
          this.recent.set(key, Date.now());
          return {
            id: updated.id,
            status: 'SENT' as WhatsAppMessageStatus,
            recipientNumber: recipient,
            documentType: document.documentType,
            documentNumber: document.documentNumber,
            fileName: document.fileName,
            sizeBytes: document.sizeBytes,
            errorMessage: null,
            createdAt: updated.createdAt.toISOString(),
          };
        } catch (error) {
          const message =
            error instanceof Error && error.message.length > 0
              ? error.message
              : 'The WhatsApp send failed.';
          await prisma.whatsAppMessageLog.update({
            where: { id: log.id },
            data: { status: 'FAILED', errorMessage: message.slice(0, 500) },
          });
          // Normalise every transport failure into a typed 502 so the UI can
          // show the real reason instead of a generic 500.
          if (error instanceof AppError) throw error;
          throw new AppError(502, message, undefined, 'SEND_FAILED');
        }
      });
    } finally {
      this.inflight.delete(key);
    }
  }

  async getHistory(
    scope: DocumentPdfScope,
    options: { limit?: number; offset?: number; status?: string } = {}
  ): Promise<{ items: WhatsAppHistoryEntry[]; total: number }> {
    const limit = Math.min(Math.max(Number(options.limit ?? 50) || 50, 1), 200);
    const offset = Math.max(Number(options.offset ?? 0) || 0, 0);
    const status = String(options.status ?? '').trim().toUpperCase();
    const where = {
      companyId: scope.companyId,
      financialYearId: scope.financialYearId,
      ...(status === 'SENT' || status === 'FAILED' || status === 'PENDING' ? { status } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.whatsAppMessageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.whatsAppMessageLog.count({ where }),
    ]);
    const partyIds = Array.from(
      new Set(rows.map((row) => row.partyId).filter((id): id is string => Boolean(id)))
    );
    const parties =
      partyIds.length > 0
        ? await prisma.party.findMany({
            where: { companyId: scope.companyId, id: { in: partyIds } },
            select: { id: true, partyName: true },
          })
        : [];
    const partyNames = new Map(parties.map((party) => [party.id, party.partyName]));
    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        documentType: row.documentType,
        documentId: row.documentId,
        partyId: row.partyId,
        partyName: row.partyId ? partyNames.get(row.partyId) ?? null : null,
        recipientNumber: row.recipientNumber,
        documentNumber: row.documentNumber,
        fileName: row.fileName,
        message: row.message,
        status: row.status as WhatsAppMessageStatus,
        errorMessage: row.errorMessage,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async getHistoryById(scope: DocumentPdfScope, id: string): Promise<WhatsAppHistoryEntry> {
    const row = await prisma.whatsAppMessageLog.findFirst({
      where: { id, companyId: scope.companyId, financialYearId: scope.financialYearId },
    });
    if (!row) {
      throw new AppError(404, 'WhatsApp history entry not found.', undefined, 'NOT_FOUND');
    }
    const party = row.partyId
      ? await prisma.party.findFirst({
          where: { companyId: scope.companyId, id: row.partyId },
          select: { partyName: true },
        })
      : null;
    return {
      id: row.id,
      documentType: row.documentType,
      documentId: row.documentId,
      partyId: row.partyId,
      partyName: party?.partyName ?? null,
      recipientNumber: row.recipientNumber,
      documentNumber: row.documentNumber,
      fileName: row.fileName,
      message: row.message,
      status: row.status as WhatsAppMessageStatus,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

export const whatsappMessageService = new WhatsAppMessageService();