import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';

// ── Types ───────────────────────────────────────────────────────────────────

export interface RateResult {
  provider_name: string;
  rate_amount: number | null;
  currency: string;
  room_type: string | null;
  taxes_included: boolean;
  free_cancellation: boolean;
  is_available: boolean;
  raw_text: string;
}

export interface ScrapeResult {
  success: boolean;
  rates: RateResult[];
  url: string;
  check_in: string;
  check_out: string;
  scraped_at: Date;
  error?: string;
}

export interface HotelSearchResult {
  property_token: string;
  name: string;
  address: string;
  overall_rating: number | null;
  stars: number | null;
  thumbnail: string | null;
  rate_per_night: number | null;
  currency: string;
  reviews: number | null;
  amenities: string[];
  gps_coordinates: { latitude: number; longitude: number } | null;
}

// ── SerpAPI Response Types ──────────────────────────────────────────────────

interface SerpApiPriceEntry {
  source: string;
  logo?: string;
  num_guests?: number;
  rate_per_night?: {
    lowest?: string;
    extracted_lowest?: number;
    before_taxes_fees?: string;
    extracted_before_taxes_fees?: number;
  };
  total_rate?: {
    lowest?: string;
    extracted_lowest?: number;
    before_taxes_fees?: string;
    extracted_before_taxes_fees?: number;
  };
  official?: boolean;
}

interface SerpApiPropertyEntry {
  type?: string;
  name?: string;
  description?: string;
  link?: string;
  property_token?: string;
  gps_coordinates?: { latitude: number; longitude: number };
  check_in_time?: string;
  check_out_time?: string;
  rate_per_night?: { lowest?: string; extracted_lowest?: number };
  total_rate?: { lowest?: string; extracted_lowest?: number };
  hotel_class?: string;
  extracted_hotel_class?: number;
  images?: Array<{ thumbnail?: string; original_image?: string }>;
  overall_rating?: number;
  reviews?: number;
  location_rating?: number;
  amenities?: string[];
  address?: string;
  neighborhood?: string;
}

interface SerpApiHotelPricesResponse {
  prices?: SerpApiPriceEntry[];
  error?: string;
  search_metadata?: { status?: string };
}

interface SerpApiHotelSearchResponse {
  properties?: SerpApiPropertyEntry[];
  error?: string;
  search_metadata?: { status?: string };
}

// ── Rate Limiting ───────────────────────────────────────────────────────────

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1000; // 1 second between requests

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    const waitTime = MIN_REQUEST_INTERVAL_MS - elapsed;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
  lastRequestTime = Date.now();
}

// ── Retry Helper ────────────────────────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  maxAttempts: number = 3
): Promise<Response> {
  let lastError: Error | null = null;
  const backoffBase = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await waitForRateLimit();

      logger.debug('SerpAPI request', { url: url.replace(/api_key=[^&]+/, 'api_key=***'), attempt });

      const response = await fetch(url);

      if (response.status === 429) {
        logger.warn('SerpAPI rate limit hit, backing off', { attempt });
        if (attempt < maxAttempts) {
          const delay = backoffBase * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new Error('SerpAPI rate limit exceeded after all retries');
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`SerpAPI HTTP ${response.status}: ${body}`);
      }

      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.error('SerpAPI request failed', {
        attempt,
        error: lastError.message,
      });

      if (attempt < maxAttempts) {
        const delay = backoffBase * Math.pow(2, attempt - 1);
        logger.info('Retrying SerpAPI request after backoff', { delay, nextAttempt: attempt + 1 });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error('All SerpAPI request attempts failed');
}

// ── Parse Currency from Rate String ─────────────────────────────────────────

function parseCurrencyFromString(rateStr: string | undefined, fallback: string): string {
  if (!rateStr) return fallback;
  if (rateStr.startsWith('$')) return 'USD';
  if (rateStr.startsWith('€')) return 'EUR';
  if (rateStr.startsWith('£')) return 'GBP';
  if (rateStr.startsWith('¥')) return 'JPY';
  if (rateStr.includes('THB') || rateStr.includes('฿')) return 'THB';
  return fallback;
}

// ── Search Hotels ───────────────────────────────────────────────────────────

export async function searchHotels(
  query: string,
  checkIn: string,
  checkOut: string
): Promise<HotelSearchResult[]> {
  const apiKey = config.SERPAPI_API_KEY;
  if (!apiKey) {
    throw new Error('SERPAPI_API_KEY is not configured');
  }

  const params = new URLSearchParams({
    engine: 'google_hotels',
    q: query,
    check_in_date: checkIn,
    check_out_date: checkOut,
    adults: '2',
    currency: config.BASE_CURRENCY,
    api_key: apiKey,
  });

  const url = `https://serpapi.com/search?${params.toString()}`;
  const response = await fetchWithRetry(url);
  const data = (await response.json()) as SerpApiHotelSearchResponse;

  if (data.error) {
    throw new Error(`SerpAPI error: ${data.error}`);
  }

  const properties = data.properties ?? [];

  return properties
    .filter((p) => p.property_token && p.name)
    .map((p) => ({
      property_token: p.property_token!,
      name: p.name!,
      address: p.address ?? p.neighborhood ?? '',
      overall_rating: p.overall_rating ?? null,
      stars: p.extracted_hotel_class ?? null,
      thumbnail: p.images?.[0]?.thumbnail ?? null,
      rate_per_night: p.rate_per_night?.extracted_lowest ?? null,
      currency: parseCurrencyFromString(p.rate_per_night?.lowest, config.BASE_CURRENCY),
      reviews: p.reviews ?? null,
      amenities: p.amenities ?? [],
      gps_coordinates: p.gps_coordinates ?? null,
    }));
}

// ── Scrape Hotel Rates (OTA Prices for a Specific Hotel) ────────────────────

export async function scrapeHotelRates(
  hotelPropertyToken: string,
  checkIn: string,
  checkOut: string,
  currency: string = config.BASE_CURRENCY
): Promise<RateResult[]> {
  const apiKey = config.SERPAPI_API_KEY;
  if (!apiKey) {
    throw new Error('SERPAPI_API_KEY is not configured');
  }

  const params = new URLSearchParams({
    engine: 'google_hotels',
    hotel_id: hotelPropertyToken,
    check_in_date: checkIn,
    check_out_date: checkOut,
    adults: '2',
    currency: currency,
    api_key: apiKey,
  });

  const url = `https://serpapi.com/search?${params.toString()}`;
  const response = await fetchWithRetry(url);
  const data = (await response.json()) as SerpApiHotelPricesResponse;

  if (data.error) {
    throw new Error(`SerpAPI error: ${data.error}`);
  }

  const prices = data.prices ?? [];

  return prices.map((price) => {
    const rateAmount = price.rate_per_night?.extracted_lowest ?? null;
    const beforeTaxes = price.rate_per_night?.extracted_before_taxes_fees ?? null;
    const taxesIncluded = beforeTaxes !== null && rateAmount !== null && beforeTaxes < rateAmount;
    const detectedCurrency = parseCurrencyFromString(
      price.rate_per_night?.lowest,
      currency
    );

    const rawParts: string[] = [
      `source: ${price.source}`,
      `rate: ${price.rate_per_night?.lowest ?? 'N/A'}`,
      `total: ${price.total_rate?.lowest ?? 'N/A'}`,
    ];
    if (price.official) rawParts.push('official: true');
    if (price.num_guests) rawParts.push(`guests: ${price.num_guests}`);

    return {
      provider_name: price.source,
      rate_amount: rateAmount,
      currency: detectedCurrency,
      room_type: null,
      taxes_included: taxesIncluded,
      free_cancellation: false,
      is_available: rateAmount !== null && rateAmount > 0,
      raw_text: rawParts.join(' | '),
    };
  });
}

// ── Main Scrape Function (Backward Compatible) ─────────────────────────────

export async function scrapeGoogleHotels(
  propertyToken: string,
  checkIn: string,
  checkOut: string,
  _guests: number = 2
): Promise<ScrapeResult> {
  const maxAttempts = 3;
  const backoffBase = 1000;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.info('Starting SerpAPI scrape attempt', {
        attempt,
        propertyToken,
        checkIn,
        checkOut,
      });

      const rates = await scrapeHotelRates(
        propertyToken,
        checkIn,
        checkOut,
        config.BASE_CURRENCY
      );

      logger.info('SerpAPI scrape completed successfully', {
        propertyToken,
        ratesFound: rates.length,
        checkIn,
        checkOut,
      });

      return {
        success: true,
        rates,
        url: `serpapi:hotel_id:${propertyToken}`,
        check_in: checkIn,
        check_out: checkOut,
        scraped_at: new Date(),
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.error('SerpAPI scrape attempt failed', {
        attempt,
        propertyToken,
        error: lastError.message,
      });

      if (attempt < maxAttempts) {
        const delay = backoffBase * Math.pow(2, attempt - 1);
        logger.info('Retrying after backoff', { delay, nextAttempt: attempt + 1 });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return {
    success: false,
    rates: [],
    url: `serpapi:hotel_id:${propertyToken}`,
    check_in: checkIn,
    check_out: checkOut,
    scraped_at: new Date(),
    error: lastError?.message ?? 'All SerpAPI scrape attempts failed',
  };
}
