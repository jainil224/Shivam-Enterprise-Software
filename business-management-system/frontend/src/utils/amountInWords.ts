const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** Renders 0-999 in English words (Indian system building block). */
function belowThousand(value: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;

  if (hundreds > 0) {
    parts.push(`${ONES[hundreds]} Hundred`);
  }

  if (remainder > 0) {
    if (remainder < 20) {
      parts.push(ONES[remainder]);
    } else {
      const tens = Math.floor(remainder / 10);
      const ones = remainder % 10;
      parts.push(ones > 0 ? `${TENS[tens]} ${ONES[ones]}` : TENS[tens]);
    }
  }

  return parts.join(' ');
}

/** Whole number (0 to 99,99,99,999) to Indian-system words: Crore / Lakh / Thousand. */
function wholeNumberToWords(value: number): string {
  if (value === 0) return 'Zero';

  const units: Array<{ divisor: number; label: string }> = [
    { divisor: 10000000, label: 'Crore' },
    { divisor: 100000, label: 'Lakh' },
    { divisor: 1000, label: 'Thousand' },
  ];

  const parts: string[] = [];
  let remaining = value;

  for (const unit of units) {
    const count = Math.floor(remaining / unit.divisor);
    if (count > 0) {
      parts.push(`${belowThousand(count)} ${unit.label}`);
      remaining %= unit.divisor;
    }
  }

  if (remaining > 0) {
    parts.push(belowThousand(remaining));
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Converts a rupee amount string into Indian-system words, e.g.
 * `125000.50` -> "Rupees One Lakh Twenty Five Thousand And Paise Fifty Only".
 * Financial values are parsed as decimal strings, never as floating point sums.
 */
export function amountInWords(amount: string | number | null | undefined): string {
  const raw = String(amount ?? '').trim();
  if (raw === '') return '';

  const negative = raw.startsWith('-');
  const normalized = negative ? raw.slice(1) : raw;

  if (!/^\d+(\.\d+)?$/.test(normalized)) return '';

  const [rupeesPart, paisePartRaw] = normalized.split('.');
  const paiseText = (paisePartRaw ?? '').padEnd(3, '0').slice(0, 3);
  const paise = Number(paiseText.slice(0, 2));

  const rupees = Number(rupeesPart);
  if (!Number.isFinite(rupees) || rupees > 999999999) return '';

  const segments: string[] = [];
  if (rupees > 0) {
    segments.push(`Rupees ${wholeNumberToWords(rupees)}`);
  }
  if (paise > 0) {
    segments.push(`Paise ${wholeNumberToWords(paise)}`);
  }
  if (segments.length === 0) {
    segments.push('Rupees Zero');
  }

  const words = `${segments.join(' And ')} Only`;
  return negative ? `Minus ${words}` : words;
}