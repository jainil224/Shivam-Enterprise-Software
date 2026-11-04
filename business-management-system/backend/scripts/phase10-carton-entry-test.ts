import { calculateCartonWeight, calculateTotals } from '../src/utils/weightCalculations';
import {
  calculateRowDerived,
  calculateGridTotals,
  CartonRowState,
} from '../../frontend/src/utils/weightCalculations';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

function assertClose(a: number, b: number, testName: string) {
  const diff = Math.abs(a - b);
  assert(diff < 0.0011, `${testName} (expected ${b}, got ${a})`);
}

console.log('===============================================================');
console.log('   PHASE 10: CHANDNI SOFTWARE CARTON ENTRY WORKFLOW TESTS      ');
console.log('===============================================================\n');

console.log('--- TEST GROUP 1: FIRST CARTON FOUR MANUAL INPUTS & CALCULATIONS ---');
{
  // First carton specification from phse 10.md Section 2 & 4:
  // Carton Number: 1460, Carton Weight: 1.000, Cops: 24, Gross Weight: 31.620, Empty Cops Weight: 0.040
  const c1 = calculateRowDerived('1.000', '24', '31.620', '0.040');
  assertClose(c1.tareWeight, 1.960, '1.1 Tare Weight calculation: 1.000 + (24 * 0.040) = 1.960');
  assertClose(c1.netWeight, 29.660, '1.2 Net Weight calculation: 31.620 - 1.960 = 29.660');
  assertClose(c1.averageWeight, 1.236, '1.3 Average Weight calculation: 29.660 / 24 = 1.236');
  assert(!c1.error, '1.4 No calculation errors on valid first carton');

  // Backend authoritative check
  const b1 = calculateCartonWeight({
    cartonNumber: '1460',
    cartonWeight: '1.000',
    cops: 24,
    grossWeight: '31.620',
    copsWeight: '0.040',
  });
  assert(b1.tareWeight.toFixed(3) === '1.960', '1.5 Backend tare weight matches 1.960');
  assert(b1.netWeight.toFixed(3) === '29.660', '1.6 Backend net weight matches 29.660');
  assert(b1.averageWeight.toFixed(3) === '1.236', '1.7 Backend average weight matches 1.236');
}

console.log('\n--- TEST GROUP 2: SUBSEQUENT CARTONS INHERITANCE (ONLY GROSS ENTERED) ---');
{
  // Carton 2 inherits: Carton Weight (1.000), Cops (24), Cops Weight (0.040)
  // Only Gross Weight entered: 32.400
  const c2 = calculateRowDerived('1.000', '24', '32.400', '0.040');
  assertClose(c2.tareWeight, 1.960, '2.1 Carton 2 inherited tare weight is 1.960');
  assertClose(c2.netWeight, 30.440, '2.2 Carton 2 Net Weight: 32.400 - 1.960 = 30.440');
  assertClose(c2.averageWeight, 1.268, '2.3 Carton 2 Average Weight: 30.440 / 24 = 1.268');

  // Carton 3 inherits same parameters, Gross Weight: 33.100
  const c3 = calculateRowDerived('1.000', '24', '33.100', '0.040');
  assertClose(c3.tareWeight, 1.960, '2.4 Carton 3 inherited tare weight is 1.960');
  assertClose(c3.netWeight, 31.140, '2.5 Carton 3 Net Weight: 33.100 - 1.960 = 31.140');
  assertClose(c3.averageWeight, 1.298, '2.6 Carton 3 Average Weight: 31.140 / 24 = 1.298');
}

console.log('\n--- TEST GROUP 3: TOTALS FOOTER WITH THREE COMPLETED CARTONS ---');
{
  const rows: CartonRowState[] = [
    {
      id: '1',
      cartonNumber: '1460',
      cartonWeight: '1.000',
      cops: '24',
      grossWeight: '31.620',
      copsWeight: '0.040',
      tareWeight: 1.960,
      netWeight: 29.660,
      averageWeight: 1.236,
      twist: '800',
      lotNumber: 'LOT-101',
      grade: 'A',
    },
    {
      id: '2',
      cartonNumber: '1461',
      cartonWeight: '1.000',
      cops: '24',
      grossWeight: '32.400',
      copsWeight: '0.040',
      tareWeight: 1.960,
      netWeight: 30.440,
      averageWeight: 1.268,
      twist: '800',
      lotNumber: 'LOT-101',
      grade: 'A',
    },
    {
      id: '3',
      cartonNumber: '1462',
      cartonWeight: '1.000',
      cops: '24',
      grossWeight: '33.100',
      copsWeight: '0.040',
      tareWeight: 1.960,
      netWeight: 31.140,
      averageWeight: 1.298,
      twist: '800',
      lotNumber: 'LOT-101',
      grade: 'A',
    },
  ];

  const totals = calculateGridTotals(rows);
  assert(totals.totalCartons === 3, '3.1 Total Cartons count is exactly 3');
  assertClose(totals.totalCartonWeight, 3.000, '3.2 Total Carton Weight is 3.000 kg');
  assert(totals.totalCops === 72, '3.3 Total Cops is 72 (3 * 24)');
  assertClose(totals.totalGrossWeight, 97.120, '3.4 Total Gross Weight is 97.120 kg (31.620 + 32.400 + 33.100)');
  assertClose(totals.totalTareWeight, 5.880, '3.5 Total Tare Weight is 5.880 kg (3 * 1.960)');
  assertClose(totals.totalNetWeight, 91.240, '3.6 Total Net Weight is 91.240 kg (97.120 - 5.880)');
  assertClose(totals.totalAverageWeight, 1.267, '3.7 Total Average Weight is 1.267 kg (91.240 / 72)');
}

console.log('\n--- TEST GROUP 4: EXCLUSION OF PENDING/EMPTY CARTON FROM TOTALS ---');
{
  // phse 10.md Section 8: Empty automatically generated rows must not count as completed cartons.
  const rowsWithEmptyPending: CartonRowState[] = [
    {
      id: '1',
      cartonNumber: '1460',
      cartonWeight: '1.000',
      cops: '24',
      grossWeight: '31.620',
      copsWeight: '0.040',
      tareWeight: 1.960,
      netWeight: 29.660,
      averageWeight: 1.236,
      twist: '800',
      lotNumber: 'LOT-101',
      grade: 'A',
    },
    {
      id: '2',
      cartonNumber: '1461',
      cartonWeight: '1.000',
      cops: '24',
      grossWeight: '', // Generated next row, not yet entered!
      copsWeight: '0.040',
      tareWeight: 1.960,
      netWeight: 0,
      averageWeight: 0,
      twist: '800',
      lotNumber: 'LOT-101',
      grade: 'A',
    },
  ];

  const totals = calculateGridTotals(rowsWithEmptyPending);
  assert(totals.totalCartons === 1, '4.1 Total Cartons excludes empty generated row (remains 1, not 2)');
  assertClose(totals.totalGrossWeight, 31.620, '4.2 Total Gross Weight only includes filled carton');
  assertClose(totals.totalNetWeight, 29.660, '4.3 Total Net Weight only includes filled carton');
  assert(totals.totalCops === 24, '4.4 Total Cops excludes empty pending row');
}

console.log('\n--- TEST GROUP 5: MANUAL ROW OVERRIDES (CARTON WEIGHT / COPS) ---');
{
  // phse 10.md Section 6: If operator manually changes Carton Weight or Cops, recalculate row immediately
  const overrideRow = calculateRowDerived('1.200', '20', '30.000', '0.040');
  // Tare = 1.200 + (20 * 0.040) = 1.200 + 0.800 = 2.000
  assertClose(overrideRow.tareWeight, 2.000, '5.1 Overridden row tare weight: 1.200 + (20 * 0.040) = 2.000');
  // Net = 30.000 - 2.000 = 28.000
  assertClose(overrideRow.netWeight, 28.000, '5.2 Overridden row net weight: 30.000 - 2.000 = 28.000');
  // Avg = 28.000 / 20 = 1.400
  assertClose(overrideRow.averageWeight, 1.400, '5.3 Overridden row avg weight: 28.000 / 20 = 1.400');
}

console.log('\n--- TEST GROUP 6: VALIDATION & ERROR PREVENTION ---');
{
  // Negative gross weight
  const negGross = calculateRowDerived('1.000', '24', '-5.000', '0.040');
  assert(Boolean(negGross.error), '6.1 Negative gross weight correctly flags error');

  // Negative net weight (Gross < Tare)
  const smallGross = calculateRowDerived('1.000', '24', '1.500', '0.040'); // Tare is 1.960
  assert(Boolean(smallGross.error), '6.2 Gross weight smaller than tare correctly flags negative net weight error');

  // Backend rejection of negative gross
  try {
    calculateCartonWeight({
      cartonNumber: '1460',
      cartonWeight: '1.000',
      cops: 24,
      grossWeight: '-10.000',
      copsWeight: '0.040',
    });
    assert(false, '6.3 Backend should throw on negative gross weight');
  } catch (err: any) {
    assert(err.message.includes('cannot be negative'), '6.3 Backend throws on negative gross weight');
  }

  // Backend rejection of Gross < Tare
  try {
    calculateCartonWeight({
      cartonNumber: '1460',
      cartonWeight: '1.000',
      cops: 24,
      grossWeight: '1.200', // Tare is 1.960
      copsWeight: '0.040',
    });
    assert(false, '6.4 Backend should throw on negative net weight');
  } catch (err: any) {
    assert(err.message.includes('Net weight cannot be negative'), '6.4 Backend throws on negative net weight');
  }
}

console.log('\n===============================================================');
console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('===============================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

