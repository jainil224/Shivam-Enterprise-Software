// Phase 19.3 - WhatsApp share modal used by document print previews.
// Every value shown here comes from the actual document being previewed; the
// backend re-validates the document, company and financial year before sending.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, MessageCircle, Send, X, XCircle } from 'lucide-react';
import { getParty } from '../services/api';
import {
  getWhatsAppStatus,
  sendWhatsAppDocument,
  whatsAppErrorMessage,
} from '../services/whatsappApi';
import {
  WHATSAPP_DOCUMENT_LABELS,
  type SendWhatsAppDocumentResult,
  type WhatsAppDocumentType,
  type WhatsAppStatus,
} from '../types/whatsapp';

export interface WhatsAppShareModalProps {
  open: boolean;
  onClose: () => void;
  documentType: WhatsAppDocumentType;
  documentId: string;
  documentNumber: string;
  partyId?: string | null;
  partyName?: string | null;
  reportRequest?: Record<string, unknown>;
  onSent?: (result: SendWhatsAppDocumentResult) => void;
}

const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5';
const inputCls =
  'w-full h-8 px-2 text-[12px] bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#2c5f57] focus:ring-1 focus:ring-[#2c5f57]/40 disabled:bg-slate-100 disabled:text-slate-500';

function normaliseForPreview(raw: string): string {
  let digits = raw.replace(/[^0-9]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

function pdfFileName(documentType: WhatsAppDocumentType, documentNumber: string): string {
  const label = (WHATSAPP_DOCUMENT_LABELS[documentType] ?? 'Document').replace(/\s+/g, '_');
  const number = documentNumber.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return label + '_' + (number.length > 0 ? number : 'document') + '.pdf';
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  open,
  onClose,
  documentType,
  documentId,
  documentNumber,
  partyId,
  partyName,
  reportRequest,
  onSent,
}) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [mobile, setMobile] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState<SendWhatsAppDocumentResult | null>(null);
  const [touched, setTouched] = useState(false);

  const label = WHATSAPP_DOCUMENT_LABELS[documentType] ?? documentType;
  const defaultFileName = useMemo(
    () => pdfFileName(documentType, documentNumber),
    [documentType, documentNumber]
  );

  useEffect(() => {
    if (!open) return;
    let active = true;
    setSendError(null);
    setSent(null);
    setTouched(false);
    setStatus(null);
    setStatusError(null);
    setMessage(
      (partyName ? 'Dear ' + partyName + ',' : 'Dear Sir/Madam,') +
        '\n\nPlease find attached ' +
        label +
        ' ' +
        documentNumber +
        '.\n\nRegards'
    );
    void getWhatsAppStatus()
      .then((next) => {
        if (active) setStatus(next);
      })
      .catch((error) => {
        if (active) setStatusError(whatsAppErrorMessage(error, 'Unable to read the WhatsApp status.'));
      });
    setMobile('');
    if (partyId) {
      void getParty(partyId)
        .then((party) => {
          if (active && party?.phone) setMobile(party.phone);
        })
        .catch(() => {
          // Prefill is best-effort; the user can always type the number.
        });
    }
    return () => {
      active = false;
    };
  }, [open, documentType, documentId, documentNumber, partyId, partyName, label]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !sending) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, sending, onClose]);

  if (!open) return null;

  const digits = normaliseForPreview(mobile);
  const mobileValid = /^[6-9][0-9]{9}$/.test(digits);
  const mobileError =
    touched && !mobileValid ? 'Enter a 10-digit Indian mobile number (optionally with +91).' : null;
  const connected = status?.connected === true;

  const handleSend = async () => {
    setTouched(true);
    setSendError(null);
    if (!mobileValid) return;
    if (!connected) {
      setSendError('WhatsApp is not connected. Open Settings > Integrations > WhatsApp and scan the QR code.');
      return;
    }
    setSending(true);
    try {
      const result = await sendWhatsAppDocument({
        documentType,
        documentId,
        recipientNumber: mobile,
        message,
        reportRequest,
      });
      setSent(result);
      onSent?.(result);
    } catch (error) {
      setSendError(whatsAppErrorMessage(error, 'The document could not be sent on WhatsApp.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Send document on WhatsApp"
        className="w-full max-w-lg bg-white rounded-lg shadow-xl border border-slate-300 max-h-[92vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-[#2c5f57] text-white flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[13px] font-bold text-slate-900 leading-tight">Send PDF on WhatsApp</h2>
              <p className="text-[10.5px] text-slate-500">The real ERP PDF is generated and attached on the server.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 space-y-2.5">
          {statusError && (
            <div className="flex items-start gap-1.5 bg-red-50 border border-red-300 rounded p-2 text-[11px] text-red-800">
              <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <p>{statusError}</p>
            </div>
          )}

          {!statusError && status && !connected && (
            <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-300 rounded p-2 text-[11px] text-amber-900">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-bold">WhatsApp is not connected.</p>
                <p>Connect your account to send this document.</p>
              </div>
              <button
                type="button"
                className="text-[10.5px] font-bold underline whitespace-nowrap"
                onClick={() => navigate('/settings/integrations/whatsapp')}
              >
                Open settings
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className={labelCls}>Party</span>
              <p className="h-8 flex items-center px-2 text-[12px] bg-slate-50 border border-slate-200 rounded text-slate-700 truncate">
                {partyName ?? '-'}
              </p>
            </div>
            <div>
              <span className={labelCls}>Document type</span>
              <p className="h-8 flex items-center px-2 text-[12px] bg-slate-50 border border-slate-200 rounded text-slate-700">
                {label}
              </p>
            </div>
            <div>
              <span className={labelCls}>Document number</span>
              <p className="h-8 flex items-center px-2 text-[12px] bg-slate-50 border border-slate-200 rounded font-mono text-slate-700">
                {documentNumber}
              </p>
            </div>
            <div>
              <span className={labelCls}>PDF file</span>
              <p className="h-8 flex items-center px-2 text-[11px] bg-slate-50 border border-slate-200 rounded font-mono text-slate-600 truncate" title={defaultFileName}>
                {sent?.fileName ?? defaultFileName}
              </p>
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="wa-mobile">
              WhatsApp mobile number <span className="text-red-600">*</span>
            </label>
            <input
              id="wa-mobile"
              type="tel"
              inputMode="tel"
              className={inputCls + (mobileError ? ' border-red-400' : '')}
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="+91 98765 43210"
              disabled={sending || Boolean(sent)}
              autoComplete="off"
            />
            <p className="mt-0.5 text-[10.5px] text-slate-500">
              {mobileError ?? 'Indian numbers only. Country code is added automatically.'}
            </p>
          </div>

          <div>
            <label className={labelCls} htmlFor="wa-message">
              Message
            </label>
            <textarea
              id="wa-message"
              rows={3}
              className="w-full px-2 py-1.5 text-[12px] bg-white border border-slate-300 rounded text-slate-800 focus:outline-none focus:border-[#2c5f57] focus:ring-1 focus:ring-[#2c5f57]/40 disabled:bg-slate-100"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={sending || Boolean(sent)}
              maxLength={1000}
            />
          </div>

          {sendError && (
            <div className="flex items-start gap-1.5 bg-red-50 border border-red-300 rounded p-2 text-[11px] text-red-800">
              <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <p>{sendError}</p>
            </div>
          )}

          {sent && (
            <div className="flex items-start gap-1.5 bg-emerald-50 border border-emerald-300 rounded p-2 text-[11px] text-emerald-900">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">Document accepted by WhatsApp.</p>
                <p>
                  {sent.fileName} · {Math.max(1, Math.round(sent.sizeBytes / 1024))} KB · {sent.recipientNumber}
                </p>
              </div>
            </div>
          )}

          <p className="text-[10px] text-slate-500 flex items-start gap-1">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            Unofficial WhatsApp Web integration. WhatsApp may restrict accounts that use automation; never send bulk
            messages.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-3 py-2 border-t border-slate-200 bg-slate-50 rounded-b-lg">
          <button
            type="button"
            className="px-3 py-1.5 text-[12px] font-bold rounded border border-slate-300 text-slate-700 hover:bg-white disabled:opacity-50"
            onClick={onClose}
            disabled={sending}
          >
            {sent ? 'Close' : 'Cancel'}
          </button>
          {!sent && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold rounded bg-[#2c5f57] text-white hover:bg-[#24504a] disabled:opacity-60"
              onClick={handleSend}
              disabled={sending || !connected}
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {sending ? 'Sending…' : 'SEND PDF'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export interface WhatsAppShareButtonProps {
  documentType: WhatsAppDocumentType;
  documentId: string;
  documentNumber: string;
  partyId?: string | null;
  partyName?: string | null;
  reportRequest?: Record<string, unknown>;
  label?: string;
  className?: string;
  disabled?: boolean;
}

/** Toolbar button + modal in one component so print pages stay unchanged. */
export const WhatsAppShareButton: React.FC<WhatsAppShareButtonProps> = ({
  documentType,
  documentId,
  documentNumber,
  partyId,
  partyName,
  reportRequest,
  label = 'WhatsApp',
  className,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled || !documentId}
        className={
          className ??
          'px-2.5 py-1.5 text-[11px] font-bold rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 flex items-center gap-1.5 disabled:opacity-50'
        }
        title="Send this document as a PDF on WhatsApp"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        {label}
      </button>
      <WhatsAppShareModal
        open={open}
        onClose={() => setOpen(false)}
        documentType={documentType}
        documentId={documentId}
        documentNumber={documentNumber}
        partyId={partyId}
        partyName={partyName}
        reportRequest={reportRequest}
      />
    </>
  );
};

export default WhatsAppShareModal;