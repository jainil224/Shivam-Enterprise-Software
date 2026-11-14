// Phase 19.3 - document preparation and PDF integrity validation.
//
// Only genuine server-rendered PDFs are ever attached. Nothing is read from an
// arbitrary filesystem path supplied by the browser, and no temporary PDF file
// is written to disk: the buffer is streamed straight into the WhatsApp media
// object, so there is nothing left behind to clean up.

import { AppError } from '../../utils/appError.js';
import { buildWhatsAppDocumentPdf, type DocumentPdfScope } from './whatsappDocumentPdf.js';
import {
  isWhatsAppDocumentType,
  type PreparedWhatsAppDocument,
  type SendWhatsAppDocumentInput,
} from '../../types/whatsapp.js';

const PDF_SIGNATURE = '%PDF-';
const MAX_PDF_BYTES = 25 * 1024 * 1024;

/** Validates that the buffer really is a PDF of a sane size. */
export function assertValidPdf(buffer: Buffer, fileName: string): void {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new AppError(500, 'The generated document is empty.', undefined, 'PDF_INVALID');
  }
  if (buffer.length > MAX_PDF_BYTES) {
    throw new AppError(
      413,
      'The generated PDF is larger than the 25 MB WhatsApp limit.',
      undefined,
      'PDF_TOO_LARGE'
    );
  }
  const signature = buffer.subarray(0, PDF_SIGNATURE.length).toString('latin1');
  if (signature !== PDF_SIGNATURE) {
    throw new AppError(
      500,
      'The generated document is not a valid PDF (' + fileName + ').',
      undefined,
      'PDF_INVALID'
    );
  }
}

/**
 * Builds the real ERP PDF for a document and validates it before delivery.
 * Company and financial year always come from the request headers.
 */
export async function prepareDocument(
  scope: DocumentPdfScope,
  input: SendWhatsAppDocumentInput
): Promise<PreparedWhatsAppDocument> {
  const documentType = String(input.documentType || '').trim().toUpperCase();
  if (!isWhatsAppDocumentType(documentType)) {
    throw new AppError(400, 'Unsupported document type.', undefined, 'UNSUPPORTED_DOCUMENT');
  }
  const documentId = String(input.documentId || '').trim();
  if (documentId.length === 0) {
    throw new AppError(400, 'A document id is required.', undefined, 'VALIDATION_ERROR');
  }

  const built = await buildWhatsAppDocumentPdf(
    documentType,
    documentId,
    scope,
    input.reportRequest
  );
  assertValidPdf(built.buffer, built.fileName);

  return {
    documentType,
    documentId: built.documentId,
    documentNumber: built.documentNumber,
    partyId: built.partyId,
    partyName: built.partyName,
    fileName: built.fileName,
    mimeType: 'application/pdf',
    sizeBytes: built.buffer.length,
    buffer: built.buffer,
  };
}