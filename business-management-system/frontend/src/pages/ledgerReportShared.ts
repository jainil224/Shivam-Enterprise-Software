// Phase 17 - shared helpers for the Bank Book and Account Ledger screens.
// Formatting, page-state storage and download plumbing live here so the six
// report screens stay small and behave identically.

import type { LedgerBalanceNature } from '../types/ledgerReports';

/** Accounting money format: grouped, always two decimals, never a currency symbol. */
export const formatMoney = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '0.00';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return Math.abs(numeric).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/** Signed display for values that may be negative (net movement). */
export const formatSignedMoney = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '0.00';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  const text = Math.abs(numeric).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return numeric < 0 ? '(' + text + ')' : text;
};

/** ISO (YYYY-MM-DD) to the accounting display format DD-MM-YYYY. */
export const displayDate = (iso: string | null | undefined): string => {
  const text = String(iso ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parts = text.split('-');
  return parts[2] + '-' + parts[1] + '-' + parts[0];
};

export const balanceText = (
  amount: string | number | null | undefined,
  nature: LedgerBalanceNature | null | undefined
): string => formatMoney(amount) + (nature ? ' ' + nature : '');

/** Never let a report shortcut fire while the user is typing somewhere else. */
export const isTypingTarget = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    element.isContentEditable === true
  );
};

/**
 * PageDown / PageUp never change text, so report preview shortcuts stay usable
 * while the cursor sits in a filter box. They are still blocked where the key
 * carries its own meaning (select lists, textareas, contentEditable regions).
 */
export const blocksPageKey = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable === true;
};

/**
 * Ledger groups are stored as enums (`SUNDRY_CREDITORS`) but displayed as
 * labels (`Sundry Creditors`). Normalising separators lets a user search with
 * the text they can actually see on screen.
 */
export const normalizeSearchTerm = (value: string): string =>
  value.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

export const readPageState = <T,>(key: string): T | null => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const writePageState = (key: string, value: unknown): void => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or blocked; the screen still works from its own state.
  }
};

/** Saves a real downloaded file (PDF / XLSX) produced by the backend. */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const readError = (err: unknown, fallback: string): string => {
  const response = (err as { response?: { data?: { error?: { message?: string } } } })?.response;
  return response?.data?.error?.message ?? (err instanceof Error ? err.message : fallback);
};

/** Fixed rows per on-screen preview sheet; the real print flow repeats headers. */
export const chunkRows = <T,>(rows: T[], size: number): T[][] => {
  if (rows.length === 0) return [[]];
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
};