// Phase 19 - shared helpers for the Account Wise Balance screens.
// One place owns the default request, draft storage, sanitising and validation
// so the selection, configuration and preview screens cannot drift apart.

import React from 'react';
import { Ban } from 'lucide-react';
import type {
  AccountWiseBalanceOptions,
  AccountWiseBalanceQueryRequest,
  AccountWiseBalancePageState,
  AccountWiseLedgerGroup,
  AccountWiseReportType,
} from '../types/accountWiseBalance';
import {
  ACCOUNT_WISE_BALANCE_DRAFT_KEY,
  ACCOUNT_WISE_BALANCE_STATE_KEY,
} from '../types/accountWiseBalance';
import { readPageState, writePageState } from './ledgerReportShared';

export const labelClass =
  'block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-0.5';

export const fieldClass =
  'w-full h-7 px-1.5 bg-white border border-[#789d93] rounded text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2c5f57] disabled:bg-slate-100 disabled:text-slate-400';

export const checkClass =
  'h-3.5 w-3.5 rounded border-[#789d93] text-[#2c5f57] focus:ring-[#2c5f57]';

export const checkLabelClass =
  'flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer';

/** Left report list used by the selection and configuration screens. */
export const ReportList: React.FC<{
  active: AccountWiseReportType;
  onSelect?: (type: AccountWiseReportType) => void;
}> = ({ active, onSelect }) => {
  const entries: Array<{ value: AccountWiseReportType; label: string }> = [
    { value: 'ACCOUNT_WISE_BALANCE', label: '1. Account Wise Balance' },
    { value: 'ACCOUNT_MONTH_WISE_BALANCE', label: '2. Account + Month Wise Balance' },
  ];
  return (
    <aside className="flex w-full shrink-0 flex-col rounded border border-[#789d93] bg-white lg:w-[190px]">
      <div className="border-b border-[#789d93] bg-[#eef5f2] px-2 py-1">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Report Name</h2>
      </div>
      <div className="flex flex-col gap-1 p-1.5">
        {entries.map((entry) => {
          const selected = entry.value === active;
          return (
            <button
              key={entry.value}
              type="button"
              aria-current={selected ? 'true' : undefined}
              onClick={() => onSelect?.(entry.value)}
              className={
                selected
                  ? 'w-full rounded border border-[#2c5f57] bg-[#dceee8] px-2 py-1.5 text-left text-[11px] font-bold text-[#1f4842]'
                  : 'w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-left text-[11px] font-semibold text-slate-600 hover:bg-slate-50'
              }
            >
              {entry.label}
            </button>
          );
        })}
        <p className="mt-1 flex items-start gap-1 px-0.5 text-[9px] leading-tight text-slate-500">
          <Ban className="mt-[1px] h-2.5 w-2.5 shrink-0" />
          Both reports read the same Phase 1 filters and the same posted journal lines.
        </p>
      </div>
    </aside>
  );
};

export const buildDefaultRequest = (
  options: AccountWiseBalanceOptions
): AccountWiseBalanceQueryRequest => ({
  reportType: 'ACCOUNT_WISE_BALANCE',
  accountType: options.defaultAccountType,
  partyId: null,
  partyGroupId: null,
  scheduleMode: 'ALL',
  scheduleIds: [],
  balanceColumns: 'BOTH',
  includePartyAddress: false,
  includePartyMobile: false,
  includePan: false,
  pageBreakEveryParty: false,
  doNotPrintDescription: false,
  skipZeroBalances: false,
  fromDate: options.defaultFromDate,
  toDate: options.defaultToDate,
});

const isIsoDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const isInsideYear = (value: string, options: AccountWiseBalanceOptions): boolean =>
  value >= options.financialYearStart && value <= options.financialYearEnd;

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

/** Keeps a stored draft usable after parties, groups or schedules change. */
export const sanitizeRequest = (
  candidate: unknown,
  options: AccountWiseBalanceOptions
): AccountWiseBalanceQueryRequest => {
  const fallback = buildDefaultRequest(options);
  if (!candidate || typeof candidate !== 'object') return fallback;
  const raw = candidate as Partial<AccountWiseBalanceQueryRequest>;

  const accountType =
    options.accountTypes.find((entry) => entry.value === raw.accountType && entry.supported)?.value ??
    fallback.accountType;
  const accountTypeDef = options.accountTypes.find((entry) => entry.value === accountType);
  const allowedGroups = accountTypeDef?.accountGroups ?? [];

  const balanceColumns =
    options.balanceColumns.find((entry) => entry.value === raw.balanceColumns)?.value ??
    fallback.balanceColumns;
  const scheduleMode = raw.scheduleMode === 'SELECT' ? 'SELECT' : 'ALL';
  const scheduleIds = Array.isArray(raw.scheduleIds)
    ? Array.from(
        new Set(
          raw.scheduleIds.filter(
            (id): id is AccountWiseLedgerGroup =>
              typeof id === 'string' &&
              allowedGroups.includes(id as AccountWiseLedgerGroup) &&
              options.schedules.some((schedule) => schedule.id === id)
          )
        )
      )
    : [];

  const partyId =
    typeof raw.partyId === 'string' && options.parties.some((party) => party.id === raw.partyId)
      ? raw.partyId
      : null;
  const partyGroupId =
    typeof raw.partyGroupId === 'string' &&
    options.partyGroups.some((group) => group.id === raw.partyGroupId)
      ? raw.partyGroupId
      : null;

  const fromDate =
    isIsoDate(raw.fromDate) && isInsideYear(raw.fromDate, options)
      ? raw.fromDate
      : fallback.fromDate;
  const toDate =
    isIsoDate(raw.toDate) && isInsideYear(raw.toDate, options) ? raw.toDate : fallback.toDate;

  const reportType: AccountWiseReportType =
    raw.reportType === 'ACCOUNT_MONTH_WISE_BALANCE' ? 'ACCOUNT_MONTH_WISE_BALANCE' : 'ACCOUNT_WISE_BALANCE';

  return {
    reportType,
    accountType,
    partyId,
    partyGroupId,
    scheduleMode: scheduleIds.length > 0 ? scheduleMode : 'ALL',
    scheduleIds: scheduleMode === 'SELECT' && scheduleIds.length > 0 ? scheduleIds : [],
    balanceColumns,
    includePartyAddress: asBoolean(raw.includePartyAddress, false),
    includePartyMobile: asBoolean(raw.includePartyMobile, false),
    includePan: asBoolean(raw.includePan, false),
    pageBreakEveryParty: asBoolean(raw.pageBreakEveryParty, false),
    doNotPrintDescription: asBoolean(raw.doNotPrintDescription, false),
    skipZeroBalances: asBoolean(raw.skipZeroBalances, false),
    fromDate: fromDate > toDate ? fallback.fromDate : fromDate,
    toDate: fromDate > toDate ? fallback.toDate : toDate,
  };
};

/** Client-side validation mirrors the backend rules for instant feedback. */
export const validateRequest = (
  request: AccountWiseBalanceQueryRequest,
  options: AccountWiseBalanceOptions
): string | null => {
  const accountType = options.accountTypes.find((entry) => entry.value === request.accountType);
  if (!accountType) return 'Select a valid Account Type.';
  if (!accountType.supported) {
    return accountType.note ?? 'This Account Type is not supported by the current data model.';
  }
  if (!isIsoDate(request.fromDate) || !isIsoDate(request.toDate)) {
    return 'Select both a valid From and To date.';
  }
  if (request.fromDate > request.toDate) return 'From date cannot be after the To date.';
  if (
    request.fromDate < options.financialYearStart ||
    request.toDate > options.financialYearEnd
  ) {
    return (
      'The report period must stay inside the financial year (' +
      options.financialYearStart +
      ' to ' +
      options.financialYearEnd +
      ').'
    );
  }
  if (
    request.partyId !== null &&
    !options.parties.some((party) => party.id === request.partyId)
  ) {
    return 'The selected party is not available for this company.';
  }
  if (
    request.partyGroupId !== null &&
    !options.partyGroups.some((group) => group.id === request.partyGroupId)
  ) {
    return 'The selected party group is not available for this company.';
  }
  if (request.scheduleMode === 'SELECT') {
    if (request.scheduleIds.length === 0) {
      return 'Select at least one schedule, or set Schedule to All.';
    }
    const outside = request.scheduleIds.filter(
      (id) => !accountType.accountGroups.includes(id)
    );
    if (outside.length > 0) {
      return 'A selected schedule is not part of the ' + accountType.label.replace(/^\d+\.\s*/, '') + ' classification.';
    }
  }
  return null;
};

export const readDraft = (options: AccountWiseBalanceOptions): AccountWiseBalanceQueryRequest | null => {
  const stored = readPageState<Partial<AccountWiseBalanceQueryRequest>>(ACCOUNT_WISE_BALANCE_DRAFT_KEY);
  if (!stored) return null;
  return sanitizeRequest(stored, options);
};

export const writeDraft = (request: AccountWiseBalanceQueryRequest): void => {
  writePageState(ACCOUNT_WISE_BALANCE_DRAFT_KEY, request);
};

export const readPreviewState = (): AccountWiseBalancePageState | null => {
  const stored = readPageState<AccountWiseBalancePageState>(ACCOUNT_WISE_BALANCE_STATE_KEY);
  if (!stored || !stored.request || typeof stored.request !== 'object') return null;
  return stored;
};

export const writePreviewState = (request: AccountWiseBalanceQueryRequest): void => {
  writePageState(ACCOUNT_WISE_BALANCE_STATE_KEY, { request } satisfies AccountWiseBalancePageState);
};

/** One-line description of the applied schedule filter. */
export const scheduleSummary = (
  request: AccountWiseBalanceQueryRequest,
  options: AccountWiseBalanceOptions
): string => {
  if (request.scheduleMode === 'ALL') return 'All';
  const labels = request.scheduleIds
    .map((id) => options.schedules.find((schedule) => schedule.id === id)?.label ?? id)
    .filter((label) => label.length > 0);
  return labels.length === 0 ? 'None selected' : labels.join(', ');
};

/** Party options compatible with the selected Account Type. */
export const partiesForAccountType = (
  options: AccountWiseBalanceOptions,
  accountType: string
): AccountWiseBalanceOptions['parties'] => {
  const definition = options.accountTypes.find((entry) => entry.value === accountType);
  if (!definition) return options.parties;
  return options.parties.filter((party) =>
    party.accountGroups.some((group) => definition.accountGroups.includes(group))
  );
};

/** Schedules compatible with the selected Account Type. */
export const schedulesForAccountType = (
  options: AccountWiseBalanceOptions,
  accountType: string
): AccountWiseBalanceOptions['schedules'] => {
  const definition = options.accountTypes.find((entry) => entry.value === accountType);
  if (!definition) return options.schedules;
  return options.schedules.filter((schedule) =>
    definition.accountGroups.includes(schedule.id)
  );
};