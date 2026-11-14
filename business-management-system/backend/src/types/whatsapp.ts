// Phase 19.3 - WhatsApp QR integration shared contracts.
// These types are shared by the session service, the PDF service, the message
// service, the controller and (mirrored) by the React settings page.

/** Connection lifecycle of the unofficial WhatsApp Web client. */
export type WhatsAppConnectionState =
  | 'DISCONNECTED'
  | 'INITIALIZING'
  | 'QR_REQUIRED'
  | 'AUTHENTICATED'
  | 'CONNECTED'
  | 'AUTH_FAILURE';

/** Public status payload. It never contains session credentials or the QR secret. */
export interface WhatsAppStatus {
  state: WhatsAppConnectionState;
  connected: boolean;
  /** WhatsApp account number when the client reports a reliable id, otherwise null. */
  phoneNumber: string | null;
  /** ISO timestamp of the successful ready event. */
  connectedAt: string | null;
  /** True when a scannable QR is currently available. */
  qrAvailable: boolean;
  /** ISO timestamp after which the displayed QR must be refreshed. */
  qrExpiresAt: string | null;
  /** Human-readable reason for the latest failure, if any. */
  lastError: string | null;
  /** Static warning about the unofficial integration. */
  warning: string;
  /** Server time the status was produced. */
  updatedAt: string;
}

export interface WhatsAppQrPayload {
  /** PNG data URL produced by the `qrcode` package from the real auth event. */
  qrDataUrl: string;
  expiresAt: string;
}

/** Document families the ERP can turn into a genuine server-side PDF. */
export type WhatsAppDocumentType =
  | 'BANK_RECEIPT'
  | 'BANK_PAYMENT'
  | 'PURCHASE_BILL'
  | 'DEBIT_NOTE'
  | 'PRODUCTION_CHALLAN'
  | 'REPORT_BILL_BASE'
  | 'REPORT_BANK_BOOK'
  | 'REPORT_ACCOUNT_LEDGER'
  | 'REPORT_ACCOUNT_WISE_BALANCE'
  | 'REPORT_ACCOUNT_MONTH_WISE_BALANCE'
  | 'REPORT_BANK_RECONCILIATION';

/** A validated, in-memory PDF ready to be attached to one WhatsApp message. */
export interface PreparedWhatsAppDocument {
  documentType: WhatsAppDocumentType;
  documentId: string;
  documentNumber: string;
  partyId: string | null;
  partyName: string | null;
  fileName: string;
  mimeType: 'application/pdf';
  sizeBytes: number;
  buffer: Buffer;
}

export interface SendWhatsAppDocumentInput {
  documentType: string;
  documentId: string;
  recipientNumber: string;
  message?: string;
  /**
   * Reports are generated from a request payload instead of a stored row.
   * Company and financial year are still taken from the request headers.
   */
  reportRequest?: Record<string, unknown>;
}

export type WhatsAppMessageStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface WhatsAppHistoryEntry {
  id: string;
  documentType: string;
  documentId: string;
  partyId: string | null;
  /** Resolved from Party Master for the history table; never trusted from input. */
  partyName: string | null;
  recipientNumber: string;
  documentNumber: string;
  fileName: string;
  message: string | null;
  status: WhatsAppMessageStatus;
  errorMessage: string | null;
  createdAt: string;
}

export interface SendWhatsAppDocumentResult {
  id: string;
  status: WhatsAppMessageStatus;
  recipientNumber: string;
  documentType: string;
  documentNumber: string;
  fileName: string;
  sizeBytes: number;
  errorMessage: string | null;
  createdAt: string;
}

export const WHATSAPP_UNOFFICIAL_WARNING =
  'This is an unofficial WhatsApp Web integration. WhatsApp may restrict or ban accounts that use automation. Use a dedicated business number and never send bulk messages.';

/** Accepted document type labels used by the UI and the history table. */
export const WHATSAPP_DOCUMENT_LABELS: Record<WhatsAppDocumentType, string> = {
  BANK_RECEIPT: 'Bank Receipt',
  BANK_PAYMENT: 'Bank Payment',
  PURCHASE_BILL: 'Purchase Bill',
  DEBIT_NOTE: 'Debit Note',
  PRODUCTION_CHALLAN: 'Production Challan',
  REPORT_BILL_BASE: 'Bill Base Report',
  REPORT_BANK_BOOK: 'Bank Book',
  REPORT_ACCOUNT_LEDGER: 'Account Ledger',
  REPORT_ACCOUNT_WISE_BALANCE: 'Account Wise Balance',
  REPORT_ACCOUNT_MONTH_WISE_BALANCE: 'Account Month Wise Balance',
  REPORT_BANK_RECONCILIATION: 'Bank Reconciliation',
};

export function isWhatsAppDocumentType(value: string): value is WhatsAppDocumentType {
  return Object.prototype.hasOwnProperty.call(WHATSAPP_DOCUMENT_LABELS, value);
}