// Phase 19.3 - Settings > Integrations > WhatsApp.
// The QR code shown here comes straight from the backend auth event; nothing is
// fabricated, and the raw QR secret is never stored or logged by the browser.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  PlugZap,
  QrCode,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  Unplug,
  XCircle,
} from 'lucide-react';
import {
  connectWhatsApp,
  disconnectWhatsApp,
  getWhatsAppHistory,
  getWhatsAppQr,
  getWhatsAppStatus,
  whatsAppErrorMessage,
} from '../services/whatsappApi';
import {
  WHATSAPP_DOCUMENT_LABELS,
  WHATSAPP_STATE_LABELS,
  type WhatsAppDocumentType,
  type WhatsAppHistoryEntry,
  type WhatsAppQrPayload,
  type WhatsAppStatus,
} from '../types/whatsapp';

const POLL_MS = 3000;

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPhone(value: string | null): string {
  if (!value) return '-';
  const digits = value.replace(/[^0-9]/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return '+91 ' + digits.slice(2, 7) + ' ' + digits.slice(7);
  }
  return value;
}

function documentLabel(type: string): string {
  return WHATSAPP_DOCUMENT_LABELS[type as WhatsAppDocumentType] ?? type;
}

const cardCls = 'bg-white border border-slate-300 rounded-lg shadow-sm';
const primaryBtn =
  'inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold rounded bg-[#2c5f57] text-white hover:bg-[#24504a] disabled:opacity-60 disabled:cursor-not-allowed';
const secondaryBtn =
  'inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold rounded border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60';

export const WhatsAppIntegrationPage: React.FC = () => {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [qr, setQr] = useState<WhatsAppQrPayload | null>(null);
  const [history, setHistory] = useState<WhatsAppHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const mounted = useRef(true);

  const refreshStatus = useCallback(async () => {
    try {
      const next = await getWhatsAppStatus();
      if (!mounted.current) return;
      setStatus(next);
      if (next.qrAvailable) {
        try {
          const payload = await getWhatsAppQr();
          if (mounted.current) setQr(payload);
        } catch {
          if (mounted.current) setQr(null);
        }
      } else {
        setQr(null);
      }
    } catch (err) {
      if (mounted.current) setError(whatsAppErrorMessage(err, 'Unable to read the WhatsApp status.'));
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const result = await getWhatsAppHistory({ limit: 50 });
      if (mounted.current) setHistory(result.items);
    } catch (err) {
      if (mounted.current) setError(whatsAppErrorMessage(err, 'Unable to load the send history.'));
    } finally {
      if (mounted.current) setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refreshStatus();
    void loadHistory();
    const timer = window.setInterval(() => {
      void refreshStatus();
    }, POLL_MS);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [refreshStatus, loadHistory]);

  useEffect(() => {
    if (!qr?.expiresAt) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(qr.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setQr(null);
        void refreshStatus();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [qr, refreshStatus]);

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await connectWhatsApp();
      setStatus(next);
      setNotice('Starting the WhatsApp client. A QR code appears as soon as WhatsApp issues one.');
      await refreshStatus();
    } catch (err) {
      setError(whatsAppErrorMessage(err, 'Unable to start the WhatsApp connection.'));
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect this WhatsApp account? The linked device will be logged out.')) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await disconnectWhatsApp();
      setStatus(next);
      setQr(null);
      setNotice('WhatsApp has been disconnected and the local session was removed.');
      await loadHistory();
    } catch (err) {
      setError(whatsAppErrorMessage(err, 'Unable to disconnect WhatsApp.'));
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshQr = async () => {
    setError(null);
    setNotice(null);
    try {
      const payload = await getWhatsAppQr();
      setQr(payload);
      setNotice('QR code refreshed.');
    } catch (err) {
      setQr(null);
      setError(
        whatsAppErrorMessage(
          err,
          'No fresh QR code is available yet. WhatsApp issues a new code every few seconds; keep this page open.'
        )
      );
    }
  };

  const state = status?.state ?? 'DISCONNECTED';
  const stateBadge = useMemo(() => {
    if (state === 'CONNECTED') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (state === 'AUTH_FAILURE') return 'bg-red-100 text-red-800 border-red-300';
    if (state === 'QR_REQUIRED') return 'bg-amber-100 text-amber-800 border-amber-300';
    if (state === 'INITIALIZING' || state === 'AUTHENTICATED') {
      return 'bg-sky-100 text-sky-800 border-sky-300';
    }
    return 'bg-slate-100 text-slate-700 border-slate-300';
  }, [state]);

  return (
    <div className="w-full max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#2c5f57] text-white flex items-center justify-center">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-[17px] font-extrabold text-slate-900 leading-tight">
              WhatsApp Integration
            </h1>
            <p className="text-[11.5px] text-slate-500">
              Connect your own WhatsApp account and send ERP documents as genuine PDF attachments.
            </p>
          </div>
        </div>
        <span className={'px-2.5 py-1 text-[11px] font-bold border rounded-full ' + stateBadge}>
          {WHATSAPP_STATE_LABELS[state]}
        </span>
      </div>

      <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-lg p-3 text-[11.5px] text-amber-900">
        <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
        <p>
          <span className="font-bold">Unofficial integration.</span>{' '}
          {status?.warning ??
            'WhatsApp may restrict or ban accounts that use automation. Use a dedicated business number and never send bulk messages.'}
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-300 rounded-lg p-3 text-[11.5px] text-red-800">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="flex-1">{error}</p>
          <button type="button" className="text-[11px] font-bold underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-2 bg-sky-50 border border-sky-300 rounded-lg p-3 text-[11.5px] text-sky-900">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="flex-1">{notice}</p>
          <button type="button" className="text-[11px] font-bold underline" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className={cardCls + ' p-4'}>
        {(state === 'DISCONNECTED' || state === 'AUTH_FAILURE') && (
          <div className="grid gap-4 md:grid-cols-[1fr_280px]">
            <div className="space-y-2">
              <h2 className="text-[13px] font-bold text-slate-900">
                {state === 'AUTH_FAILURE' ? 'Connection failed' : 'Not connected'}
              </h2>
              <p className="text-[12px] text-slate-600">
                {state === 'AUTH_FAILURE' && status?.lastError
                  ? status.lastError.includes('TimeoutError') || status.lastError.includes('30000ms')
                    ? 'The connection timed out while loading WhatsApp Web. This can happen on first launch while WhatsApp Web downloads required assets. Click Retry Connection to try again.'
                    : status.lastError
                  : 'Link your WhatsApp account by scanning a QR code, exactly like WhatsApp Web. The ERP never asks for your password.'}
              </p>
              <ul className="text-[11.5px] text-slate-600 list-disc pl-5 space-y-0.5">
                <li>Open WhatsApp on your phone and go to Linked devices.</li>
                <li>Choose Link a device and scan the QR code shown here.</li>
                <li>Keep the backend running: the session needs a real browser.</li>
              </ul>
              <div className="pt-1">
                <button type="button" className={primaryBtn} onClick={handleConnect} disabled={busy}>
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlugZap className="w-3.5 h-3.5" />}
                  {busy ? 'Starting…' : state === 'AUTH_FAILURE' ? 'Retry Connection' : 'Connect WhatsApp'}
                </button>
              </div>
            </div>
            <div className="hidden md:flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
              <div className="text-center text-slate-400 space-y-1">
                <QrCode className="w-10 h-10 mx-auto" />
                <p className="text-[11px] font-semibold">QR code appears here</p>
              </div>
            </div>
          </div>
        )}

        {(state === 'INITIALIZING' || state === 'AUTHENTICATED') && (
          <div className="flex flex-col items-center gap-3 py-6 justify-center text-slate-700">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-[#2c5f57]" />
              <div>
                <p className="text-[12.5px] font-bold">
                  {state === 'AUTHENTICATED'
                    ? 'Authenticated, finishing the handshake…'
                    : status?.lastError?.includes('expired') || status?.lastError?.includes('logged out')
                      ? 'Session expired, generating a new QR code…'
                      : 'Starting the WhatsApp client…'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Opening headless browser and generating QR code. First launch may take 15 to 45 seconds while WhatsApp Web assets are loaded…
                </p>
              </div>
            </div>
            {state === 'INITIALIZING' && (
              <button
                type="button"
                className={secondaryBtn + ' mt-1'}
                onClick={handleDisconnect}
                disabled={busy}
              >
                <Unplug className="w-3.5 h-3.5" />
                Cancel / Restart
              </button>
            )}
          </div>
        )}

        {state === 'QR_REQUIRED' && (
          <div className="grid gap-4 md:grid-cols-[280px_1fr]">
            <div className="flex flex-col items-center gap-2">
              {qr ? (
                <img
                  src={qr.qrDataUrl}
                  alt="WhatsApp QR code"
                  className="w-[240px] h-[240px] border border-slate-300 rounded bg-white p-1"
                />
              ) : (
                <div className="w-[240px] h-[240px] border border-dashed border-slate-300 rounded flex flex-col items-center justify-center text-slate-400 gap-1">
                  <QrCode className="w-9 h-9" />
                  <p className="text-[11px] font-semibold">Waiting for a new code…</p>
                </div>
              )}
              <div className="flex items-center gap-1 text-[11px] text-slate-600">
                <Clock className="w-3.5 h-3.5" />
                {qr && secondsLeft > 0 ? 'Valid for ' + secondsLeft + 's' : 'Code expired'}
              </div>
              <button type="button" className={secondaryBtn} onClick={handleRefreshQr}>
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh QR
              </button>
            </div>
            <div className="space-y-2">
              <h2 className="text-[13px] font-bold text-slate-900">Scan this QR code</h2>
              <ol className="text-[12px] text-slate-600 list-decimal pl-5 space-y-1">
                <li>Open WhatsApp on your phone.</li>
                <li>Tap Menu (Android) or Settings (iPhone), then Linked devices.</li>
                <li>Tap Link a device and point the camera at this code.</li>
                <li>The page switches to Connected automatically.</li>
              </ol>
              <p className="text-[11px] text-slate-500">
                Codes expire quickly for security. If the QR expires, a new one is issued by WhatsApp; press
                Refresh QR if the page stays empty.
              </p>
              <button type="button" className={secondaryBtn} onClick={handleDisconnect} disabled={busy}>
                <Unplug className="w-3.5 h-3.5" />
                Cancel connection
              </button>
            </div>
          </div>
        )}

        {state === 'CONNECTED' && (
          <div className="grid gap-4 md:grid-cols-[1fr_auto] items-start">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                <h2 className="text-[13px] font-bold">WhatsApp is connected</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 text-[12px]">
                <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Account</p>
                  <p className="font-mono text-slate-800 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                    {formatPhone(status?.phoneNumber ?? null)}
                  </p>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Connected since</p>
                  <p className="text-slate-800">{formatDateTime(status?.connectedAt ?? null)}</p>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Open a document print preview and use the WhatsApp button to send its real PDF.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:flex-col">
              <button type="button" className={secondaryBtn} onClick={() => void refreshStatus()}>
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh status
              </button>
              <button type="button" className={secondaryBtn} onClick={handleDisconnect} disabled={busy}>
                <Unplug className="w-3.5 h-3.5" />
                Disconnect
              </button>
              <button type="button" className={primaryBtn} onClick={handleConnect} disabled={busy}>
                <PlugZap className="w-3.5 h-3.5" />
                Reconnect
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={cardCls + ' overflow-hidden'}>
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200">
          <div>
            <h2 className="text-[13px] font-bold text-slate-900">Send history</h2>
            <p className="text-[11px] text-slate-500">
              Actual send results only. A row is SENT only after WhatsApp accepted the document.
            </p>
          </div>
          <button type="button" className={secondaryBtn} onClick={() => void loadHistory()} disabled={loadingHistory}>
            {loadingHistory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left font-bold px-2.5 py-1.5">Date / Time</th>
                <th className="text-left font-bold px-2.5 py-1.5">Party</th>
                <th className="text-left font-bold px-2.5 py-1.5">Mobile</th>
                <th className="text-left font-bold px-2.5 py-1.5">Document</th>
                <th className="text-left font-bold px-2.5 py-1.5">Doc No.</th>
                <th className="text-left font-bold px-2.5 py-1.5">PDF File</th>
                <th className="text-left font-bold px-2.5 py-1.5">Status</th>
                <th className="text-left font-bold px-2.5 py-1.5">Error</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-2.5 py-6 text-center text-slate-500">
                    {loadingHistory ? 'Loading…' : 'No documents have been sent yet.'}
                  </td>
                </tr>
              )}
              {history.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="px-2.5 py-1.5 whitespace-nowrap text-slate-700">{formatDateTime(row.createdAt)}</td>
                  <td className="px-2.5 py-1.5 text-slate-700">{row.partyName ?? '-'}</td>
                  <td className="px-2.5 py-1.5 font-mono text-slate-700">{formatPhone(row.recipientNumber)}</td>
                  <td className="px-2.5 py-1.5 text-slate-700">{documentLabel(row.documentType)}</td>
                  <td className="px-2.5 py-1.5 font-mono text-slate-700">{row.documentNumber}</td>
                  <td className="px-2.5 py-1.5 font-mono text-slate-600 break-all">{row.fileName}</td>
                  <td className="px-2.5 py-1.5">
                    <span
                      className={
                        'px-1.5 py-0.5 rounded text-[10px] font-bold border ' +
                        (row.status === 'SENT'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : row.status === 'FAILED'
                            ? 'bg-red-50 text-red-700 border-red-300'
                            : 'bg-amber-50 text-amber-700 border-amber-300')
                      }
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-2.5 py-1.5 text-red-700 max-w-[220px]">{row.errorMessage ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10.5px] text-slate-500 flex items-start gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        Session credentials are stored on the server only, outside the web root. QR codes are never logged and never
        saved in browser storage.
      </p>
    </div>
  );
};

export default WhatsAppIntegrationPage;