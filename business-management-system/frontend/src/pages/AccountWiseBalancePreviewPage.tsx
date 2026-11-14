import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Download,
  Loader2,
  Printer,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  exportAccountWiseBalanceMonthWisePdf,
  exportAccountWiseBalancePdf,
  queryAccountWiseBalance,
  queryAccountWiseBalanceMonthWise,
} from '../services/api';
import type {
  AccountWiseBalanceQueryRequest,
  AccountWiseBalanceResult,
  AccountWiseMonthWiseResult,
} from '../types/accountWiseBalance';
import { readPreviewState } from './accountWiseBalanceShared';
import { displayDate, downloadBlob, formatMoney, readError } from './ledgerReportShared';

const BASE = '/reports/final-reports/account-wise-balance';

/** Optional stored details, printed under the account name when requested. */
const detailLines = (row: {
  description: string | null;
  partyAddress: string | null;
  mobile: string | null;
  panNumber: string | null;
}): string[] => {
  const lines: string[] = [];
  if (row.description) lines.push(row.description);
  if (row.partyAddress) lines.push(row.partyAddress);
  if (row.mobile) lines.push('Mobile No: ' + row.mobile);
  if (row.panNumber) lines.push('PAN No: ' + row.panNumber);
  return lines;
};

export const AccountWiseBalancePreviewPage: React.FC = () => {
  const navigate = useNavigate();
  const [state] = useState(() => readPreviewState());
  const [accountResult, setAccountResult] = useState<AccountWiseBalanceResult | null>(null);
  const [monthResult, setMonthResult] = useState<AccountWiseMonthWiseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const request: AccountWiseBalanceQueryRequest | null = state?.request ?? null;
  const monthWise = request?.reportType === 'ACCOUNT_MONTH_WISE_BALANCE';

  useEffect(() => {
    if (!state) navigate(BASE, { replace: true });
  }, [state, navigate]);

  const load = useCallback(async () => {
    if (!request) return;
    setLoading(true);
    setError(null);
    try {
      if (request.reportType === 'ACCOUNT_MONTH_WISE_BALANCE') {
        const data = await queryAccountWiseBalanceMonthWise(request);
        setMonthResult(data);
        setAccountResult(null);
      } else {
        const data = await queryAccountWiseBalance(request);
        setAccountResult(data);
        setMonthResult(null);
      }
    } catch (err) {
      setAccountResult(null);
      setMonthResult(null);
      setError(readError(err, 'Failed to generate the Account Wise Balance report.'));
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void load();
  }, [load]);

  const openPrint = useCallback(() => {
    if (!request) return;
    navigate(BASE + '/print');
  }, [request, navigate]);

  const downloadPdf = useCallback(async () => {
    if (!request || busy) return;
    setBusy(true);
    setError(null);
    try {
      const file =
        request.reportType === 'ACCOUNT_MONTH_WISE_BALANCE'
          ? await exportAccountWiseBalanceMonthWisePdf(request)
          : await exportAccountWiseBalancePdf(request);
      downloadBlob(file.blob, file.filename);
    } catch (err) {
      setError(readError(err, 'Failed to generate the Account Wise Balance PDF.'));
    } finally {
      setBusy(false);
    }
  }, [request, busy]);

  const closeResult = useCallback(() => {
    navigate(BASE + '/config');
  }, [navigate]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeResult();
        return;
      }
      if (event.key === 'PageDown') {
        event.preventDefault();
        openPrint();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [closeResult, openPrint]);

  const accountRows = accountResult?.rows ?? [];
  const monthRows = monthResult?.rows ?? [];
  const rowCount = monthWise ? monthRows.length : accountRows.length;

  const months = monthResult?.months ?? [];

  if (!state) return null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#c2dcd5] text-slate-800">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#1f4842] bg-[#2c5f57] px-3 py-1.5 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <Printer className="h-4 w-4 shrink-0 text-emerald-300" />
          <span className="truncate text-xs font-bold uppercase tracking-wide">
            {monthWise ? 'Account + Month Wise Balance' : 'Account Wise Balance'}
          </span>
          <span className="shrink-0 rounded bg-[#1f4842] px-2 py-0.5 font-mono text-[11px] text-emerald-200">
            {request?.fromDate ? displayDate(request.fromDate) + ' to ' + displayDate(request.toDate) : 'FY'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex h-6 items-center gap-1 rounded border border-emerald-300/60 px-1.5 text-[10px] font-bold text-emerald-100 hover:bg-[#356e65] disabled:opacity-40"
          >
            <RefreshCw className={'h-3 w-3 ' + (loading ? 'animate-spin' : '')} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={busy || loading || rowCount === 0}
            className="flex h-6 items-center gap-1 rounded border border-emerald-300/60 px-1.5 text-[10px] font-bold text-emerald-100 hover:bg-[#356e65] disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            Save as PDF
          </button>
          <button
            type="button"
            onClick={openPrint}
            disabled={loading || rowCount === 0}
            className="flex h-6 items-center gap-1 rounded bg-white px-1.5 text-[10px] font-bold text-[#2c5f57] hover:bg-emerald-50 disabled:opacity-40"
          >
            <Printer className="h-3 w-3" /> Print
          </button>
          <button
            type="button"
            onClick={closeResult}
            title="Close (Esc)"
            className="flex h-5 w-5 items-center justify-center rounded bg-[#eb5757] font-bold hover:bg-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {error && (
        <div className="flex shrink-0 items-start gap-2 border-b border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto bg-slate-300/60 p-3">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-xs font-semibold text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" /> Generating report...
          </div>
        ) : rowCount === 0 ? (
          <div className="mx-auto max-w-md rounded border border-slate-300 bg-white p-6 text-center text-xs font-semibold text-slate-600">
            No account matches the selected filters for this period.
          </div>
        ) : monthWise && monthResult ? (
          <div className="mx-auto w-fit min-w-full max-w-[1400px] rounded border border-slate-400 bg-white shadow">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[11px]" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
                <colgroup>
                  <col style={{ minWidth: '220px' }} />
                  <col style={{ width: '96px' }} />
                  {months.map((month) => (
                    <React.Fragment key={'col-' + month.key}>
                      <col style={{ width: '74px' }} />
                      <col style={{ width: '74px' }} />
                    </React.Fragment>
                  ))}
                  <col style={{ width: '110px' }} />
                </colgroup>
                <thead>
                  <tr className="bg-[#eef5f2] text-[9px] uppercase tracking-wide text-slate-600">
                    <th rowSpan={2} className="border border-slate-300 px-2 py-1 text-left">
                      Account Name
                    </th>
                    <th rowSpan={2} className="border border-slate-300 px-2 py-1 text-right">
                      Opening
                    </th>
                    {months.map((month) => (
                      <th
                        key={'head-' + month.key}
                        colSpan={2}
                        className="border border-slate-300 px-1 py-1 text-center"
                        title={month.startDate + ' to ' + month.endDate}
                      >
                        {month.shortLabel}
                      </th>
                    ))}
                    <th rowSpan={2} className="border border-slate-300 px-2 py-1 text-right">
                      Closing
                    </th>
                  </tr>
                  <tr className="bg-[#eef5f2] text-[8px] uppercase tracking-wide text-slate-500">
                    {months.map((month) => (
                      <React.Fragment key={'sub-' + month.key}>
                        <th className="border border-slate-300 px-1 py-[2px] text-right">Debit</th>
                        <th className="border border-slate-300 px-1 py-[2px] text-right">Credit</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthRows.map((row) => {
                    const details = detailLines(row);
                    return (
                      <tr key={row.ledgerAccountId} className="align-top odd:bg-white even:bg-slate-50/60">
                        <td className="border border-slate-300 px-2 py-1">
                          <p className="font-bold text-slate-800">{row.accountName}</p>
                          {details.map((line, index) => (
                            <p key={index} className="text-[9px] leading-tight text-slate-500">
                              {line}
                            </p>
                          ))}
                        </td>
                        <td className="whitespace-nowrap border border-slate-300 px-2 py-1 text-right">
                          {formatMoney(row.openingBalance)} {row.openingNature}
                        </td>
                        {months.map((month) => {
                          const cell = row.months.find((entry) => entry.key === month.key);
                          return (
                            <React.Fragment key={row.ledgerAccountId + '-' + month.key}>
                              <td className="whitespace-nowrap border border-slate-300 px-1 py-1 text-right">
                                {cell && cell.debit !== '0.00' ? formatMoney(cell.debit) : ''}
                              </td>
                              <td className="whitespace-nowrap border border-slate-300 px-1 py-1 text-right">
                                {cell && cell.credit !== '0.00' ? formatMoney(cell.credit) : ''}
                              </td>
                            </React.Fragment>
                          );
                        })}
                        <td className="whitespace-nowrap border border-slate-300 px-2 py-1 text-right font-bold">
                          {formatMoney(row.closingBalance)} {row.closingNature}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#dceee8] font-bold text-[#1f4842]">
                    <td className="border border-slate-400 px-2 py-1">
                      TOTAL ({monthResult.totals.accountCount} accounts)
                    </td>
                    <td className="whitespace-nowrap border border-slate-400 px-2 py-1 text-right">
                      <span className="block">{formatMoney(monthResult.totals.totalOpeningDebit)} Dr</span>
                      <span className="block">{formatMoney(monthResult.totals.totalOpeningCredit)} Cr</span>
                    </td>
                    {months.map((month) => {
                      const total = monthResult.totals.months.find((entry) => entry.key === month.key);
                      return (
                        <React.Fragment key={'tot-' + month.key}>
                          <td className="whitespace-nowrap border border-slate-400 px-1 py-1 text-right">
                            {total ? formatMoney(total.debit) : ''}
                          </td>
                          <td className="whitespace-nowrap border border-slate-400 px-1 py-1 text-right">
                            {total ? formatMoney(total.credit) : ''}
                          </td>
                        </React.Fragment>
                      );
                    })}
                    <td className="whitespace-nowrap border border-slate-400 px-2 py-1 text-right">
                      <span className="block">{formatMoney(monthResult.totals.totalClosingDebit)} Dr</span>
                      <span className="block">{formatMoney(monthResult.totals.totalClosingCredit)} Cr</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : accountResult ? (
          <div className="mx-auto w-full max-w-[1000px] rounded border border-slate-400 bg-white shadow">
            <table className="w-full border-collapse text-[12px]" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
              <colgroup>
                <col />
                <col style={{ width: '160px' }} />
                <col style={{ width: '160px' }} />
              </colgroup>
              <thead>
                <tr className="bg-[#eef5f2] text-[10px] uppercase tracking-wide text-slate-600">
                  <th className="border border-slate-300 px-2 py-1.5 text-left">Account Name</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">Debit</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {accountRows.map((row) => {
                  const details = detailLines(row);
                  return (
                    <tr key={row.ledgerAccountId} className="align-top odd:bg-white even:bg-slate-50/60">
                      <td className="border border-slate-300 px-2 py-1">
                        <p className="font-bold text-slate-800">{row.accountName}</p>
                        {details.map((line, index) => (
                          <p key={index} className="text-[9px] leading-tight text-slate-500">
                            {line}
                          </p>
                        ))}
                      </td>
                      <td className="whitespace-nowrap border border-slate-300 px-2 py-1 text-right">
                        {row.debitBalance === '0.00' ? '' : formatMoney(row.debitBalance)}
                      </td>
                      <td className="whitespace-nowrap border border-slate-300 px-2 py-1 text-right">
                        {row.creditBalance === '0.00' ? '' : formatMoney(row.creditBalance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#dceee8] font-bold text-[#1f4842]">
                  <td className="border border-slate-400 px-2 py-1">
                    TOTAL ({accountResult.totals.accountCount} accounts)
                  </td>
                  <td className="whitespace-nowrap border border-slate-400 px-2 py-1 text-right">
                    {formatMoney(accountResult.totals.totalClosingDebit)}
                  </td>
                  <td className="whitespace-nowrap border border-slate-400 px-2 py-1 text-right">
                    {formatMoney(accountResult.totals.totalClosingCredit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : null}

        {!loading && rowCount > 0 && (
          <div className="mx-auto mt-2 w-full max-w-[1000px] rounded border border-[#789d93] bg-white/90 p-2 text-[10px] leading-snug text-slate-600">
            <p className="font-bold uppercase tracking-wide text-slate-700">
              {monthWise ? 'Month-wise interpretation' : 'Totals'}
            </p>
            {monthWise ? (
              <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
                <li>Every month inside the selected period gets its own Debit/Credit pair.</li>
                <li>Monthly figures are the account's net movement inside that month of the range.</li>
                <li>Opening is the balance immediately before the From date; Closing is opening plus all period movements.</li>
              </ul>
            ) : (
              <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
                <li>Debit and Credit are independent balance totals over the whole filtered dataset.</li>
                <li>Totals are never forced to agree; a difference is real and is not hidden.</li>
                <li>Print opens the A4 document with page numbering and a genuine PDF download.</li>
              </ul>
            )}
          </div>
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#789d93] bg-[#eef5f2] px-2 py-1.5 text-[10px] text-slate-600">
        <span>
          PageDown = A4 print preview | Esc = configuration |{' '}
          {monthWise ? 'A4 landscape PDF' : 'A4 portrait PDF'}
        </span>
        <span className="font-mono">
          {rowCount} account{rowCount === 1 ? '' : 's'} | {months.length} month
          {months.length === 1 ? '' : 's'}
        </span>
      </footer>
    </div>
  );
};

export default AccountWiseBalancePreviewPage;