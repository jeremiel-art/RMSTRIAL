import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Page, Browser } from 'puppeteer';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { parseRateCards } from './parser.js';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

// ── User Agent Pool ─────────────────────────────────────────────────────────

const USER_AGENTS: string[] = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 OPR/110.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getRandomDelay(): number {
  const min = config.SCRAPER_DELAY_MIN_MS;
  const max = config.SCRAPER_DELAY_MAX_MS;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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

// ── Failure Screenshot Directory ────────────────────────────────────────────

const FAILURE_DIR = '/tmp/scraper-failures';

function ensureFailureDir(): void {
  if (!fs.existsSync(FAILURE_DIR)) {
    fs.mkdirSync(FAILURE_DIR, { recursive: true });
  }
}

async function saveFailureScreenshot(page: Page, context: string): Promise<string | null> {
  try {
    ensureFailureDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `failure-${context}-${timestamp}.png`;
    const filepath = path.join(FAILURE_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    logger.info('Failure screenshot saved', { filepath });
    return filepath;
  } catch (err) {
    logger.warn('Failed to save screenshot', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ── Captcha Detection ───────────────────────────────────────────────────────

async function detectCaptcha(page: Page): Promise<boolean> {
  const captchaIndicators = await page.evaluate(() => {
    const body = document.body?.innerText?.toLowerCase() ?? '';
    const hasCaptchaText =
      body.includes('unusual traffic') ||
      body.includes('captcha') ||
      body.includes('robot') ||
      body.includes('verify you') ||
      body.includes('are you a human');

    const hasCaptchaFrame = !!document.querySelector(
      'iframe[src*="recaptcha"], iframe[src*="captcha"], iframe[title*="captcha"]'
    );

    return hasCaptchaText || hasCaptchaFrame;
  });

  return captchaIndicators;
}

// ── Build URL with Parameters ───────────────────────────────────────────────

function buildGoogleHotelsUrl(
  baseUrl: string,
  checkIn: string,
  checkOut: string,
  guests: number
): string {
  const url = new URL(baseUrl);
  url.searchParams.set('q', url.searchParams.get('q') ?? '');
  url.searchParams.set('g2lb', url.searchParams.get('g2lb') ?? '');
  url.searchParams.set('checkin', checkIn);
  url.searchParams.set('checkout', checkOut);
  url.searchParams.set('guests', guests.toString());
  return url.toString();
}

// ── Main Scrape Function ────────────────────────────────────────────────────

export async function scrapeGoogleHotels(
  url: string,
  checkIn: string,
  checkOut: string,
  guests: number = 2
): Promise<ScrapeResult> {
  const maxAttempts = 3;
  const backoffBase = 1000;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let browser: Browser | null = null;

    try {
      logger.info('Starting scrape attempt', { attempt, url, checkIn, checkOut });

      const userAgent = getRandomUserAgent();

      browser = await (puppeteer as unknown as typeof import('puppeteer')).launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--disable-blink-features=AutomationControlled',
        ],
      });

      const page = await browser.newPage();

      await page.setUserAgent(userAgent);
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      });

      const targetUrl = buildGoogleHotelsUrl(url, checkIn, checkOut, guests);

      await page.goto(targetUrl, {
        waitUntil: 'networkidle2',
        timeout: config.SCRAPER_TIMEOUT_MS,
      });

      // Random delay to mimic human behaviour
      await new Promise((resolve) => setTimeout(resolve, getRandomDelay()));

      // Check for captcha
      const hasCaptcha = await detectCaptcha(page);
      if (hasCaptcha) {
        logger.warn('Captcha detected, skipping this attempt', { url, attempt });
        await saveFailureScreenshot(page, `captcha-attempt${attempt}`);
        await browser.close();
        browser = null;

        if (attempt < maxAttempts) {
          const delay = backoffBase * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        return {
          success: false,
          rates: [],
          url: targetUrl,
          check_in: checkIn,
          check_out: checkOut,
          scraped_at: new Date(),
          error: 'Captcha detected on all attempts',
        };
      }

      // Wait for rate content to load
      try {
        await page.waitForSelector(
          '[class*="price"], [data-hotel-prices], [class*="rate"], [class*="Price"]',
          { timeout: 15000 }
        );
      } catch {
        logger.warn('Price selectors not found, attempting to parse anyway', { url });
      }

      // Additional delay for dynamic content
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Extract rates from the page
      const rates = await parseRateCards(page);

      await browser.close();
      browser = null;

      logger.info('Scrape completed successfully', {
        url,
        ratesFound: rates.length,
        checkIn,
        checkOut,
      });

      return {
        success: true,
        rates,
        url: targetUrl,
        check_in: checkIn,
        check_out: checkOut,
        scraped_at: new Date(),
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.error('Scrape attempt failed', {
        attempt,
        url,
        error: lastError.message,
      });

      if (browser) {
        try {
          const pages = await browser.pages();
          if (pages.length > 0) {
            await saveFailureScreenshot(pages[0], `error-attempt${attempt}`);
          }
        } catch {
          // Ignore screenshot errors during cleanup
        }

        try {
          await browser.close();
        } catch {
          // Ignore close errors
        }
        browser = null;
      }

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
    url,
    check_in: checkIn,
    check_out: checkOut,
    scraped_at: new Date(),
    error: lastError?.message ?? 'All scrape attempts failed',
  };
}
