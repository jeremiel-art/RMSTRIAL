import type { Page } from 'puppeteer';
import type { RateResult } from './googleHotels.js';
import { logger } from '../utils/logger.js';

/**
 * Parse rate cards from a Google Hotels page.
 * Google Hotels displays OTA prices in structured blocks, each containing
 * provider name, price, and optional metadata such as free cancellation
 * and tax inclusion status.
 */
export async function parseRateCards(page: Page): Promise<RateResult[]> {
  const rates = await page.evaluate(() => {
    const results: Array<{
      provider_name: string;
      rate_amount: number | null;
      currency: string;
      room_type: string | null;
      taxes_included: boolean;
      free_cancellation: boolean;
      is_available: boolean;
      raw_text: string;
    }> = [];

    // ── Strategy 1: Parse structured OTA pricing blocks ──────────────────
    // Google Hotels often renders each OTA offer as a row/card with:
    // - provider logo/name
    // - price text
    // - optional badges (free cancellation, tax-inclusive, etc.)

    const priceRows = document.querySelectorAll(
      '[data-ved] a[href*="hotel"], .K1smNd, .QCSUuc, .tEWKCe, [class*="deal-choice"]'
    );

    priceRows.forEach((row) => {
      const el = row as HTMLElement;
      const rawText = el.innerText?.trim() ?? '';

      if (!rawText || rawText.length < 3) return;

      // Extract provider name
      const providerEl =
        el.querySelector('.pSlXOe, .hYHJCe, [class*="provider"], [class*="Partner"]') ??
        el.querySelector('span:first-child');
      let providerName = providerEl?.textContent?.trim() ?? '';

      // Fallback: try the first line of text
      if (!providerName) {
        const lines = rawText.split('\n').filter((l: string) => l.trim());
        providerName = lines[0] ?? 'Unknown';
      }

      // Extract price
      const priceMatch = rawText.match(
        /(?:THB|฿|USD|\$|EUR|€|GBP|£|¥|JPY|KRW|₩|INR|₹|CNY|AUD|SGD|MYR|HKD)\s?[\d,]+(?:\.\d{1,2})?|[\d,]+(?:\.\d{1,2})?\s?(?:THB|฿|USD|\$|EUR|€|GBP|£)/i
      );

      let rateAmount: number | null = null;
      let currency = 'THB';

      if (priceMatch) {
        const priceStr = priceMatch[0];

        // Determine currency
        if (/THB|฿/i.test(priceStr)) currency = 'THB';
        else if (/USD|\$/i.test(priceStr)) currency = 'USD';
        else if (/EUR|€/i.test(priceStr)) currency = 'EUR';
        else if (/GBP|£/i.test(priceStr)) currency = 'GBP';
        else if (/JPY|¥/i.test(priceStr)) currency = 'JPY';
        else if (/KRW|₩/i.test(priceStr)) currency = 'KRW';
        else if (/INR|₹/i.test(priceStr)) currency = 'INR';
        else if (/AUD/i.test(priceStr)) currency = 'AUD';
        else if (/SGD/i.test(priceStr)) currency = 'SGD';
        else if (/MYR/i.test(priceStr)) currency = 'MYR';
        else if (/HKD/i.test(priceStr)) currency = 'HKD';
        else if (/CNY/i.test(priceStr)) currency = 'CNY';

        // Extract numeric amount
        const numMatch = priceStr.match(/[\d,]+(?:\.\d{1,2})?/);
        if (numMatch) {
          rateAmount = parseFloat(numMatch[0].replace(/,/g, ''));
        }
      }

      // Detect room type
      const roomTypeEl = el.querySelector(
        '[class*="room"], [class*="Room"], [class*="category"]'
      );
      const roomType = roomTypeEl?.textContent?.trim() ?? null;

      // Detect flags
      const textLower = rawText.toLowerCase();
      const taxesIncluded =
        textLower.includes('taxes') ||
        textLower.includes('incl.') ||
        textLower.includes('including') ||
        textLower.includes('total');
      const freeCancellation =
        textLower.includes('free cancellation') ||
        textLower.includes('cancel free') ||
        textLower.includes('refundable');

      // Only include if we found either a provider or a price
      if (providerName || rateAmount !== null) {
        results.push({
          provider_name: providerName || 'Unknown',
          rate_amount: rateAmount,
          currency,
          room_type: roomType,
          taxes_included: taxesIncluded,
          free_cancellation: freeCancellation,
          is_available: rateAmount !== null,
          raw_text: rawText.substring(0, 500),
        });
      }
    });

    // ── Strategy 2: Fallback generic price extraction ────────────────────
    // If no structured results, try to scrape any price-like patterns
    if (results.length === 0) {
      const allElements = document.querySelectorAll('span, div, a');
      const seenPrices = new Set<string>();

      allElements.forEach((el) => {
        const text = (el as HTMLElement).innerText?.trim() ?? '';
        if (text.length < 3 || text.length > 200) return;

        const priceMatch = text.match(
          /(?:THB|฿|USD|\$|EUR|€|GBP|£)\s?[\d,]+(?:\.\d{1,2})?/i
        );

        if (priceMatch) {
          const priceStr = priceMatch[0];
          if (seenPrices.has(priceStr)) return;
          seenPrices.add(priceStr);

          let curr = 'THB';
          if (/USD|\$/i.test(priceStr)) curr = 'USD';
          else if (/EUR|€/i.test(priceStr)) curr = 'EUR';
          else if (/GBP|£/i.test(priceStr)) curr = 'GBP';

          const numMatch = priceStr.match(/[\d,]+(?:\.\d{1,2})?/);
          const amount = numMatch ? parseFloat(numMatch[0].replace(/,/g, '')) : null;

          if (amount !== null && amount > 0) {
            // Try to find a parent or sibling with provider info
            const parent = el.closest('[data-ved], li, tr, [class*="row"]');
            const parentText = (parent as HTMLElement)?.innerText?.trim() ?? '';
            const lines = parentText.split('\n').filter((l: string) => l.trim());
            const possibleProvider = lines.find(
              (l: string) => !l.match(/[\d,]+/) && l.length > 2 && l.length < 50
            );

            results.push({
              provider_name: possibleProvider ?? 'Unknown',
              rate_amount: amount,
              currency: curr,
              room_type: null,
              taxes_included: parentText.toLowerCase().includes('tax'),
              free_cancellation: parentText.toLowerCase().includes('free cancellation'),
              is_available: true,
              raw_text: text.substring(0, 500),
            });
          }
        }
      });
    }

    return results;
  });

  // Deduplicate by provider name, keeping the first (most prominent) result
  const seen = new Set<string>();
  const deduped: RateResult[] = [];

  for (const rate of rates) {
    const key = `${rate.provider_name}:${rate.rate_amount}:${rate.room_type ?? 'default'}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(rate);
    }
  }

  logger.debug('Parsed rate cards', {
    rawCount: rates.length,
    dedupedCount: deduped.length,
  });

  return deduped;
}
