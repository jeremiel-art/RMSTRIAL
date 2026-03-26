import type { RateResult } from './googleHotels.js';
import { logger } from '../utils/logger.js';

/**
 * Parse rate-like text extracted from a Google Hotels page.
 * Used as a utility for processing raw text content from Selenium scraping.
 */

const KNOWN_PROVIDERS = [
  'Booking.com', 'Expedia', 'Agoda', 'Hotels.com', 'Trip.com',
  'Trivago', 'Kayak', 'Priceline', 'MakeMyTrip', 'Traveloka',
  'Official Site', 'Direct', 'Snaptravel', 'Prestigia',
  'Hotwire', 'Orbitz', 'Travelocity', 'CheapTickets',
];

/**
 * Parse a block of text containing rate information into structured RateResult objects.
 */
export function parseRateText(rawText: string): RateResult[] {
  const results: RateResult[] = [];
  const lines = rawText.split('\n').filter((l) => l.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 3) continue;

    // Look for price patterns
    const priceMatch = line.match(
      /(?:THB|฿|USD|\$|EUR|€|GBP|£|¥|JPY|KRW|₩|INR|₹|CNY|AUD|SGD|MYR|HKD)\s?[\d,]+(?:\.\d{1,2})?|[\d,]+(?:\.\d{1,2})?\s?(?:THB|฿|USD|\$|EUR|€|GBP|£)/i
    );

    if (!priceMatch) continue;

    const priceStr = priceMatch[0];

    // Determine currency
    let currency = 'THB';
    if (/THB|฿/i.test(priceStr)) currency = 'THB';
    else if (/USD|\$/i.test(priceStr)) currency = 'USD';
    else if (/EUR|€/i.test(priceStr)) currency = 'EUR';
    else if (/GBP|£/i.test(priceStr)) currency = 'GBP';
    else if (/JPY|¥/i.test(priceStr)) currency = 'JPY';

    // Extract numeric amount
    const numMatch = priceStr.match(/[\d,]+(?:\.\d{1,2})?/);
    const rateAmount = numMatch ? parseFloat(numMatch[0].replace(/,/g, '')) : null;

    if (rateAmount === null || rateAmount <= 0) continue;

    // Try to find provider name from surrounding lines
    let providerName = 'Unknown';
    // Check previous line
    if (i > 0) {
      const prevLine = lines[i - 1].trim();
      const match = KNOWN_PROVIDERS.find(
        (p) => prevLine.toLowerCase().includes(p.toLowerCase())
      );
      if (match) providerName = match;
      else if (prevLine.length >= 3 && prevLine.length <= 40 && !prevLine.match(/[\$€£¥₹₩฿]/)) {
        providerName = prevLine;
      }
    }

    // Detect flags
    const textLower = line.toLowerCase();
    const taxesIncluded =
      textLower.includes('taxes') ||
      textLower.includes('incl.') ||
      textLower.includes('including') ||
      textLower.includes('total');
    const freeCancellation =
      textLower.includes('free cancellation') ||
      textLower.includes('cancel free') ||
      textLower.includes('refundable');

    results.push({
      provider_name: providerName,
      rate_amount: rateAmount,
      currency,
      room_type: null,
      taxes_included: taxesIncluded,
      free_cancellation: freeCancellation,
      is_available: true,
      raw_text: line.substring(0, 500),
    });
  }

  // Deduplicate
  const seen = new Set<string>();
  const deduped: RateResult[] = [];
  for (const rate of results) {
    const key = `${rate.provider_name}:${rate.rate_amount}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(rate);
    }
  }

  logger.debug('Parsed rate text', {
    rawCount: results.length,
    dedupedCount: deduped.length,
  });

  return deduped;
}
