// Phase 19.3 - WhatsApp integration contracts (mirrors the backend payloads).

export type WhatsAppConnectionState =
  | 'DISCONNECTED'
  | 'INITIALIZING'
  | 'QR_REQUIRED'
  | 'AUTHENTICATED'
  | 'CONNECTED'
  | 'AUTH_FAILURE';

export interface WhatsAppStatus {
  state: WhatsAppConnectionState;
  connected: boolean;
  phoneNumber: string | null;
  connectedAt: string | null;
  qrAvailable: boolean;
  qrExpiresAt: string | null;
  lastError: string | null;
  warning: string;
  updatedAt: string;
}

export interface WhatsAppQrPayload {
  qrDataUrl: string;
  expiresAt: string;
}

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

export type WhatsAppMessageStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface WhatsAppHistoryEntry {
  id: string;
  documentType: string;
  documentId: string;
  partyId: string | null;
  partyName: string | null;
  recipientNumber: string;
  documentNumber: string;
  fileName: string;
  message: string | null;
  status: WhatsAppMessageStatus;
  errorMessage: string | null;
  createdAt: string;
}

export interface SendWhatsAppDocumentInput {
  documentType: WhatsAppDocumentType;
  documentId: string;
  recipientNumber: string;
  message?: string;
  reportRequest?: Record<string, unknown>;
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

export const WHATSAPP_STATE_LABELS: Record<WhatsAppConnectionState, string> = {
  DISCONNECTED: 'Disconnected',
  INITIALIZING: 'Starting…',
  QR_REQUIRED: 'Waiting for QR scan',
  AUTHENTICATED: 'Authenticated',
  CONNECTED: 'Connected',
  AUTH_FAILURE: 'Connection failed',
};