import { Prisma } from '@prisma/client';

export interface CartonWeightInput {
  cartonNumber: string;
  cartonWeight: number | string;
  cops: number;
  grossWeight: number | string;
  copsWeight: number | string;
  twist?: string | null;
  lotNumber?: string | null;
  grade?: string | null;
}

export interface CalculatedCartonWeight {
  cartonNumber: string;
  cartonWeight: Prisma.Decimal;
  cops: number;
  grossWeight: Prisma.Decimal;
  copsWeight: Prisma.Decimal;
  tareWeight: Prisma.Decimal;
  netWeight: Prisma.Decimal;
  averageWeight: Prisma.Decimal;
  twist?: string | null;
  lotNumber?: string | null;
  grade?: string | null;
}

export interface GridTotals {
  totalCartons: number;
  totalCartonWeight: Prisma.Decimal;
  totalCops: number;
  totalGrossWeight: Prisma.Decimal;
  totalCopsWeight: Prisma.Decimal;
  totalTareWeight: Prisma.Decimal;
  totalNetWeight: Prisma.Decimal;
  totalAverageWeight: Prisma.Decimal;
}

/**
 * Authoritative backend weight calculation with exact decimal arithmetic.
 * Formulas:
 *   Tare Weight = Carton Weight + (Cops * Cops Weight)
 *   Net Weight  = Gross Weight - Tare Weight
 *   Average     = Net Weight / Cops
 */
export function calculateCartonWeight(input: CartonWeightInput): CalculatedCartonWeight {
  const cartonNum = input.cartonNumber?.toString().trim();
  if (!cartonNum) {
    throw new Error('Carton number is required.');
  }

  const copsInt = Math.floor(Number(input.cops));
  if (isNaN(copsInt) || copsInt <= 0) {
    throw new Error(`Carton ${cartonNum}: Number of cops must be a positive integer.`);
  }

  const cartonWgt = new Prisma.Decimal(input.cartonWeight ?? 0);
  const grossWgt = new Prisma.Decimal(input.grossWeight ?? 0);
  const copsWgt = new Prisma.Decimal(input.copsWeight ?? 0);

  if (cartonWgt.isNegative()) {
    throw new Error(`Carton ${cartonNum}: Carton weight cannot be negative.`);
  }
  if (grossWgt.isNegative()) {
    throw new Error(`Carton ${cartonNum}: Gross weight cannot be negative.`);
  }
  if (copsWgt.isNegative()) {
    throw new Error(`Carton ${cartonNum}: Cops weight cannot be negative.`);
  }

  // Tare Weight = Carton Weight + (Cops * Cops Weight)
  const totalCopsWeight = copsWgt.mul(copsInt);
  const tareWgt = cartonWgt.add(totalCopsWeight).toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);

  // Net Weight = Gross Weight - Tare Weight
  const netWgt = grossWgt.sub(tareWgt).toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);

  if (netWgt.isNegative()) {
    throw new Error(
      `Carton ${cartonNum}: Net weight cannot be negative (Gross ${grossWgt.toFixed(3)} kg < Tare ${tareWgt.toFixed(3)} kg).`
    );
  }

  // Average Weight = Net Weight / Cops
  const avgWgt = netWgt.div(copsInt).toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);

  return {
    cartonNumber: cartonNum,
    cartonWeight: cartonWgt.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP),
    cops: copsInt,
    grossWeight: grossWgt.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP),
    copsWeight: copsWgt.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP),
    tareWeight: tareWgt,
    netWeight: netWgt,
    averageWeight: avgWgt,
    twist: input.twist?.trim() || null,
    lotNumber: input.lotNumber?.trim() || null,
    grade: input.grade?.trim() || null,
  };
}

/**
 * Calculates footer summary totals for a list of calculated cartons.
 */
export function calculateTotals(items: CalculatedCartonWeight[]): GridTotals {
  let totalCartons = items.length;
  let totalCartonWeight = new Prisma.Decimal(0);
  let totalCops = 0;
  let totalGrossWeight = new Prisma.Decimal(0);
  let totalCopsWeight = new Prisma.Decimal(0);
  let totalTareWeight = new Prisma.Decimal(0);
  let totalNetWeight = new Prisma.Decimal(0);

  for (const item of items) {
    totalCartonWeight = totalCartonWeight.add(item.cartonWeight);
    totalCops += item.cops;
    totalGrossWeight = totalGrossWeight.add(item.grossWeight);
    totalCopsWeight = totalCopsWeight.add(item.copsWeight.mul(item.cops));
    totalTareWeight = totalTareWeight.add(item.tareWeight);
    totalNetWeight = totalNetWeight.add(item.netWeight);
  }

  const totalAverageWeight =
    totalCops > 0
      ? totalNetWeight.div(totalCops).toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP)
      : new Prisma.Decimal(0);

  return {
    totalCartons,
    totalCartonWeight: totalCartonWeight.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP),
    totalCops,
    totalGrossWeight: totalGrossWeight.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP),
    totalCopsWeight: totalCopsWeight.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP),
    totalTareWeight: totalTareWeight.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP),
    totalNetWeight: totalNetWeight.toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP),
    totalAverageWeight,
  };
}

