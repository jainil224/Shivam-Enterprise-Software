export interface CartonRowState {
  id: string; // client-side row key
  cartonNumber: string;
  cartonWeight: string; // string for controlled input
  cops: string;
  grossWeight: string;
  copsWeight: string;
  tareWeight: number; // derived
  netWeight: number; // derived
  averageWeight: number; // derived
  twist: string;
  lotNumber: string;
  grade: string;
  hasError?: boolean;
  errorMessage?: string;
}

export interface GridTotalsState {
  totalCartons: number;
  totalCartonWeight: number;
  totalCops: number;
  totalGrossWeight: number;
  totalCopsWeight: number;
  totalTareWeight: number;
  totalNetWeight: number;
  totalAverageWeight: number;
}

export function formatAverageWeight(netWeight: number, cops: string): string {
  if (!Number.isFinite(netWeight) || netWeight <= 0 || !/^\d+$/.test(cops.trim())) {
    return '0.00';
  }

  const copCount = BigInt(cops.trim());
  if (copCount === 0n) return '0.00';

  const match = netWeight.toString().match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!match) return '0.00';

  const fraction = match[3] || '';
  let scale = fraction.length - Number(match[4] || 0);
  let magnitude = BigInt(`${match[2]}${fraction}`);

  if (scale < 0) {
    magnitude *= 10n ** BigInt(-scale);
    scale = 0;
  }

  const denominator = copCount * 10n ** BigInt(scale);
  const scaledNumerator = magnitude * 100n;
  const quotient = scaledNumerator / denominator;
  const remainder = scaledNumerator % denominator;
  const roundedHundredths = quotient + (remainder * 2n >= denominator ? 1n : 0n);

  return `${roundedHundredths / 100n}.${(roundedHundredths % 100n).toString().padStart(2, '0')}`;
}

/**
 * Calculates tare, net and average weight for a carton row.
 * Formulas:
 *   Tare Weight = Carton Weight + (Cops * Cops Weight)
 *   Net Weight  = Gross Weight - Tare Weight
 *   Average     = Net Weight / Cops
 */
export function calculateRowDerived(
  cartonWeightStr: string,
  copsStr: string,
  grossWeightStr: string,
  copsWeightStr: string
): { tareWeight: number; netWeight: number; averageWeight: number; error?: string } {
  const cartonWgt = parseFloat(cartonWeightStr) || 0;
  const cops = parseInt(copsStr, 10) || 0;
  const grossWgt = parseFloat(grossWeightStr) || 0;
  const copsWgt = parseFloat(copsWeightStr) || 0;

  if (cartonWgt < 0) {
    return { tareWeight: 0, netWeight: 0, averageWeight: 0, error: 'Carton weight cannot be negative.' };
  }
  if (grossWgt < 0) {
    return { tareWeight: 0, netWeight: 0, averageWeight: 0, error: 'Gross weight cannot be negative.' };
  }
  if (copsWgt < 0) {
    return { tareWeight: 0, netWeight: 0, averageWeight: 0, error: 'Cops weight cannot be negative.' };
  }

  // Tare = Carton Weight + (Cops * Cops Weight)
  const tare = Math.round((cartonWgt + cops * copsWgt) * 1000) / 1000;

  // Net = Gross - Tare
  const net = Math.round((grossWgt - tare) * 1000) / 1000;

  let error: string | undefined = undefined;
  if (grossWgt > 0 && net < 0) {
    error = `Net weight negative (${grossWgt.toFixed(3)} < ${tare.toFixed(3)})`;
  }

  // Average = Net / Cops
  const avg = cops > 0 ? Math.round((net / cops) * 1000) / 1000 : 0;

  return {
    tareWeight: Math.max(0, tare),
    netWeight: net,
    averageWeight: Math.max(0, avg),
    error,
  };
}

/**
 * Calculates totals summary across all valid completed carton rows.
 */
export function calculateGridTotals(rows: CartonRowState[]): GridTotalsState {
  let totalCartonWeight = 0;
  let totalCops = 0;
  let totalGrossWeight = 0;
  let totalCopsWeight = 0;
  let totalTareWeight = 0;
  let totalNetWeight = 0;
  let validCount = 0;

  for (const r of rows) {
    const cWgt = parseFloat(r.cartonWeight) || 0;
    const cops = parseInt(r.cops, 10) || 0;
    const gWgt = parseFloat(r.grossWeight) || 0;
    const cpWgt = parseFloat(r.copsWeight) || 0;

    // Only completed and valid carton rows with positive gross weight contribute to totals
    if (r.cartonNumber.trim() && gWgt > 0) {
      validCount++;
      totalCartonWeight += cWgt;
      totalCops += cops;
      totalGrossWeight += gWgt;
      totalCopsWeight += cops * cpWgt;
      totalTareWeight += r.tareWeight;
      totalNetWeight += r.netWeight;
    }
  }

  const totalAverageWeight =
    totalCops > 0 ? Math.round((totalNetWeight / totalCops) * 1000) / 1000 : 0;

  return {
    totalCartons: validCount,
    totalCartonWeight: Math.round(totalCartonWeight * 1000) / 1000,
    totalCops,
    totalGrossWeight: Math.round(totalGrossWeight * 1000) / 1000,
    totalCopsWeight: Math.round(totalCopsWeight * 1000) / 1000,
    totalTareWeight: Math.round(totalTareWeight * 1000) / 1000,
    totalNetWeight: Math.round(totalNetWeight * 1000) / 1000,
    totalAverageWeight,
  };
}
