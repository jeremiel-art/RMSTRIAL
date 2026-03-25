import { config } from '../utils/config.js';

// ── Currency Conversion ─────────────────────────────────────────────────────

// Approximate exchange rates to THB (base). In production, these would be
// fetched from a live API and cached periodically.
const RATES_TO_THB: Record<string, number> = {
  THB: 1,
  USD: 35.5,
  EUR: 38.0,
  GBP: 44.5,
  JPY: 0.24,
  CNY: 4.9,
  KRW: 0.027,
  INR: 0.43,
  AUD: 23.0,
  SGD: 26.0,
  MYR: 7.6,
  HKD: 4.55,
};

export function normalizeCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): number {
  if (fromCurrency === toCurrency) return amount;

  const fromRate = RATES_TO_THB[fromCurrency.toUpperCase()];
  const toRate = RATES_TO_THB[toCurrency.toUpperCase()];

  if (!fromRate || !toRate) {
    // If we don't know the rate, return as-is
    return amount;
  }

  // Convert to THB first, then to target
  const inThb = amount * fromRate;
  const result = inThb / toRate;

  return Math.round(result * 100) / 100;
}

// ── Room Type Normalization ─────────────────────────────────────────────────

const ROOM_TYPE_MAP: Record<string, string> = {
  // Standard / basic
  standard: 'Standard Room',
  'standard room': 'Standard Room',
  'standard king': 'Standard Room',
  'standard queen': 'Standard Room',
  'standard double': 'Standard Room',
  'standard twin': 'Standard Twin',
  'standard single': 'Standard Single',
  classic: 'Standard Room',
  'classic room': 'Standard Room',

  // Superior
  superior: 'Superior Room',
  'superior room': 'Superior Room',
  'superior king': 'Superior Room',
  'superior double': 'Superior Room',
  'superior twin': 'Superior Twin',

  // Deluxe
  deluxe: 'Deluxe Room',
  'deluxe room': 'Deluxe Room',
  'deluxe king': 'Deluxe Room',
  'deluxe double': 'Deluxe Room',
  'deluxe twin': 'Deluxe Twin',

  // Suite
  suite: 'Suite',
  'junior suite': 'Junior Suite',
  'executive suite': 'Executive Suite',
  'presidential suite': 'Presidential Suite',
  'family suite': 'Family Suite',

  // Executive / club
  executive: 'Executive Room',
  'executive room': 'Executive Room',
  club: 'Club Room',
  'club room': 'Club Room',

  // Family
  family: 'Family Room',
  'family room': 'Family Room',

  // Twin
  twin: 'Standard Twin',
  'twin room': 'Standard Twin',

  // Single
  single: 'Standard Single',
  'single room': 'Standard Single',
};

export function normalizeRoomType(rawRoomType: string | null): string | null {
  if (!rawRoomType) return null;

  const lower = rawRoomType.toLowerCase().trim();

  // Direct match
  if (ROOM_TYPE_MAP[lower]) {
    return ROOM_TYPE_MAP[lower];
  }

  // Partial match: check if any key is a substring
  for (const [key, normalized] of Object.entries(ROOM_TYPE_MAP)) {
    if (lower.includes(key)) {
      return normalized;
    }
  }

  // If no match, title-case the original
  return rawRoomType
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// ── Tax Inclusive Detection ─────────────────────────────────────────────────

export function flagTaxInclusive(rate: {
  taxes_included?: boolean;
  raw_text?: string;
}): boolean {
  if (rate.taxes_included === true) return true;

  if (rate.raw_text) {
    const lower = rate.raw_text.toLowerCase();
    const inclusivePatterns = [
      'incl. taxes',
      'includes taxes',
      'including taxes',
      'tax included',
      'taxes included',
      'taxes & fees included',
      'total price',
      'all-in',
      'net rate',
    ];

    for (const pattern of inclusivePatterns) {
      if (lower.includes(pattern)) return true;
    }
  }

  return false;
}

// ── Full Normalization Pipeline ─────────────────────────────────────────────

export interface RawRate {
  provider_name: string;
  rate_amount: number | null;
  currency: string;
  room_type: string | null;
  taxes_included?: boolean;
  free_cancellation?: boolean;
  is_available: boolean;
  raw_text?: string;
}

export interface NormalizedRate {
  provider_name: string;
  rate_amount: number | null;
  original_amount: number | null;
  currency: string;
  original_currency: string;
  room_type: string | null;
  taxes_included: boolean;
  free_cancellation: boolean;
  is_available: boolean;
}

export function normalizeRate(rawRate: RawRate): NormalizedRate {
  const baseCurrency = config.BASE_CURRENCY;

  const normalizedAmount =
    rawRate.rate_amount !== null
      ? normalizeCurrency(rawRate.rate_amount, rawRate.currency, baseCurrency)
      : null;

  const normalizedRoomType = normalizeRoomType(rawRate.room_type);

  const taxesIncluded = flagTaxInclusive({
    taxes_included: rawRate.taxes_included,
    raw_text: rawRate.raw_text,
  });

  return {
    provider_name: rawRate.provider_name.trim(),
    rate_amount: normalizedAmount,
    original_amount: rawRate.rate_amount,
    currency: baseCurrency,
    original_currency: rawRate.currency,
    room_type: normalizedRoomType,
    taxes_included: taxesIncluded,
    free_cancellation: rawRate.free_cancellation ?? false,
    is_available: rawRate.is_available,
  };
}
