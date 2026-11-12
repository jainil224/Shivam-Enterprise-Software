/**
 * Phase 18.3 - Journal Voucher Auto settlement arithmetic.
 *
 * A DR adjustment credits the party, so it settles the bill; a CR adjustment
 * debits the party, so it increases what is still outstanding. This mirrors the
 * backend rule in bankReceiptService (net = DR amount - CR amount, settlement =
 * cash allocation + net) so the preview, the popup and the posted voucher all
 * agree. Pure helpers, unit tested without React.
 */

export interface SettlementAdjustment {
  drCr: 'DR' | 'CR';
  adjustmentAmount: string | number;
}

const toAmount = (value: string | number | null | undefined): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const roundMoney = (value: number): number => Math.round(value * 100) / 100;

/** Net settlement contributed by the adjustment lines (DR settles, CR inflates). */
export const netSettlement = (adjustments: SettlementAdjustment[]): number =>
  roundMoney(
    adjustments.reduce((sum, row) => {
      const amount = toAmount(row.adjustmentAmount);
      if (amount <= 0) return sum;
      return sum + (row.drCr === 'DR' ? amount : -amount);
    }, 0)
  );

/** Bill balance left after the cash allocation and the accepted adjustments. */
export const remainingBillBalance = (
  billBalance: string | number | null | undefined,
  net: number
): number => roundMoney(toAmount(billBalance) - net);

/** Total amount settled against the bill (cash plus the accepted adjustments). */
export const totalSettled = (
  curReceived: string | number | null | undefined,
  net: number
): number => roundMoney(toAmount(curReceived) + net);

/** True when the adjustment would settle more than the bill still owes. */
export const exceedsBillBalance = (
  billBalance: string | number | null | undefined,
  net: number
): boolean => net > 0 && roundMoney(net - toAmount(billBalance)) > 0.004;