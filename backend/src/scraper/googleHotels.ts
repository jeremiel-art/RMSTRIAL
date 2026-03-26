import { Builder, Browser, By, until, type WebDriver, type WebElement } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

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

// ── User Agent Pool ─────────────────────────────────────────────────────────

const USER_AGENTS: string[] = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getRandomDelay(): number {
  const min = config.SCRAPER_DELAY_MIN_MS;
  const max = config.SCRAPER_DELAY_MAX_MS;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Failure Screenshot Directory ────────────────────────────────────────────

const FAILURE_DIR = '/tmp/scraper-failures';

function ensureFailureDir(): void {
  if (!fs.existsSync(FAILURE_DIR)) {
    fs.mkdirSync(FAILURE_DIR, { recursive: true });
  }
}

async function saveFailureScreenshot(driver: WebDriver, context: string): Promise<string | null> {
  try {
    ensureFailureDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `failure-${context}-${timestamp}.png`;
    const filepath = path.join(FAILURE_DIR, filename);
    const screenshot = await driver.takeScreenshot();
    fs.writeFileSync(filepath, screenshot, 'base64');
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

async function detectCaptcha(driver: WebDriver): Promise<boolean> {
  try {
    const bodyText = await driver.findElement(By.tagName('body')).getText();
    const lower = bodyText.toLowerCase();
    if (
      lower.includes('unusual traffic') ||
      lower.includes('captcha') ||
      lower.includes('robot') ||
      lower.includes('verify you') ||
      lower.includes('are you a human')
    ) {
      return true;
    }
    // Check for reCAPTCHA iframes
    const iframes = await driver.findElements(By.css('iframe[src*="recaptcha"], iframe[src*="captcha"]'));
    return iframes.length > 0;
  } catch {
    return false;
  }
}

// ── Build WebDriver ─────────────────────────────────────────────────────────

async function createDriver(): Promise<WebDriver> {
  const userAgent = getRandomUserAgent();

  const options = new chrome.Options();
  options.addArguments(
    '--headless=new',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=1920,1080',
    '--disable-blink-features=AutomationControlled',
    `--user-agent=${userAgent}`,
    '--disable-extensions',
    '--disable-infobars',
    '--lang=en-US,en',
  );

  // Use CHROME_BIN or CHROMIUM_BIN env var if set
  const chromeBin = process.env.CHROME_BIN || process.env.CHROMIUM_BIN;
  if (chromeBin) {
    options.setChromeBinaryPath(chromeBin);
  }

  const driver = await new Builder()
    .forBrowser(Browser.CHROME)
    .setChromeOptions(options)
    .build();

  // Set page load timeout
  await driver.manage().setTimeouts({
    pageLoad: config.SCRAPER_TIMEOUT_MS,
    implicit: 5000,
  });

  return driver;
}

// ── Parse Currency from Text ────────────────────────────────────────────────

function parseCurrencyFromText(text: string): { amount: number | null; currency: string } {
  const priceMatch = text.match(
    /(?:THB|฿|USD|\$|EUR|€|GBP|£|¥|JPY|KRW|₩|INR|₹|CNY|AUD|SGD|MYR|HKD)\s?[\d,]+(?:\.\d{1,2})?|[\d,]+(?:\.\d{1,2})?\s?(?:THB|฿|USD|\$|EUR|€|GBP|£)/i
  );

  if (!priceMatch) return { amount: null, currency: config.BASE_CURRENCY };

  const priceStr = priceMatch[0];
  let currency = config.BASE_CURRENCY;

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

  const numMatch = priceStr.match(/[\d,]+(?:\.\d{1,2})?/);
  const amount = numMatch ? parseFloat(numMatch[0].replace(/,/g, '')) : null;

  return { amount, currency };
}

// ── Search Hotels via Google Hotels ─────────────────────────────────────────

export async function searchHotels(
  query: string,
  checkIn: string,
  checkOut: string
): Promise<HotelSearchResult[]> {
  let driver: WebDriver | null = null;

  try {
    driver = await createDriver();

    // Build Google Hotels search URL
    const searchUrl = `https://www.google.com/travel/hotels?q=${encodeURIComponent(query)}&g2lb=2502548,2503771,2503781,4258168,4284970,4306835&hl=en&gl=us&un=1&ap=MABoAQ&dates=${checkIn},${checkOut}&guests=2`;

    logger.info('Searching hotels via Selenium', { query, checkIn, checkOut, url: searchUrl });

    await driver.get(searchUrl);
    await new Promise((r) => setTimeout(r, getRandomDelay()));

    // Check for captcha
    if (await detectCaptcha(driver)) {
      logger.warn('Captcha detected during hotel search');
      await saveFailureScreenshot(driver, 'search-captcha');
      return [];
    }

    // Wait for hotel cards to appear
    try {
      await driver.wait(
        until.elementsLocated(By.css('[data-hveid], [class*="property"], .kCsInf, [jsname]')),
        15000
      );
    } catch {
      logger.warn('Hotel cards not found, trying alternate selectors');
    }

    // Additional wait for dynamic content
    await new Promise((r) => setTimeout(r, 3000));

    // Extract hotel results
    const results: HotelSearchResult[] = [];

    // Try to find hotel property cards
    const cardSelectors = [
      'div[data-hveid]',
      '.kCsInf',
      'a[href*="/travel/hotels/"]',
      '[class*="property-card"]',
      'div[jsname] > div > a[href*="hotel"]',
    ];

    let cards: WebElement[] = [];
    for (const selector of cardSelectors) {
      try {
        cards = await driver.findElements(By.css(selector));
        if (cards.length > 0) break;
      } catch {
        continue;
      }
    }

    // If no cards found with specific selectors, try broader approach
    if (cards.length === 0) {
      try {
        // Look for elements that contain hotel-like content
        cards = await driver.findElements(By.css('[data-ved] > div'));
      } catch {
        // last resort
      }
    }

    logger.debug('Found hotel cards', { count: cards.length });

    for (let i = 0; i < Math.min(cards.length, 20); i++) {
      try {
        const card = cards[i];
        const text = await card.getText();
        if (!text || text.length < 10) continue;

        const lines = text.split('\n').filter((l) => l.trim());
        if (lines.length < 2) continue;

        // Extract name (usually first line)
        const name = lines[0].trim();
        if (!name || name.length < 3 || name.length > 200) continue;

        // Extract price
        const { amount: rate, currency } = parseCurrencyFromText(text);

        // Extract rating
        let rating: number | null = null;
        const ratingMatch = text.match(/(\d+\.?\d*)\s*(?:\/\s*(?:5|10)|\s*out of|★|\*)/i);
        if (ratingMatch) {
          rating = parseFloat(ratingMatch[1]);
        }

        // Extract star class
        let stars: number | null = null;
        const starMatch = text.match(/(\d)-star/i);
        if (starMatch) {
          stars = parseInt(starMatch[1], 10);
        }

        // Extract review count
        let reviews: number | null = null;
        const reviewMatch = text.match(/([\d,]+)\s*(?:review|rating)/i);
        if (reviewMatch) {
          reviews = parseInt(reviewMatch[1].replace(/,/g, ''), 10);
        }

        // Try to extract address (usually second or third line)
        let address = '';
        for (let j = 1; j < Math.min(lines.length, 4); j++) {
          const line = lines[j].trim();
          // Address lines typically don't start with $ or contain just numbers
          if (line && !line.match(/^[\$€£¥₹₩฿]/) && !line.match(/^\d+\.?\d*$/) && line.length > 5) {
            address = line;
            break;
          }
        }

        // Try to get thumbnail
        let thumbnail: string | null = null;
        try {
          const imgEl = await card.findElement(By.css('img'));
          thumbnail = await imgEl.getAttribute('src');
        } catch {
          // No image found
        }

        // Try to get link/property token from href
        let propertyToken = `search_result_${i}_${name.replace(/\s+/g, '_').substring(0, 30)}`;
        try {
          const linkEl = await card.findElement(By.css('a[href*="hotel"], a[href*="/travel/"]'));
          const href = await linkEl.getAttribute('href');
          if (href) {
            // Extract property identifier from URL
            const tokenMatch = href.match(/hotel[_\-/]([^&?/]+)/i) ?? href.match(/[?&]id=([^&]+)/);
            if (tokenMatch) {
              propertyToken = tokenMatch[1];
            } else {
              // Use the full href as a token
              propertyToken = href;
            }
          }
        } catch {
          // Use generated token
        }

        results.push({
          property_token: propertyToken,
          name,
          address,
          overall_rating: rating,
          stars,
          thumbnail,
          rate_per_night: rate,
          currency,
          reviews,
          amenities: [],
          gps_coordinates: null,
        });
      } catch (err) {
        logger.debug('Failed to parse hotel card', {
          index: i,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('Hotel search completed', { query, resultsCount: results.length });
    return results;
  } catch (err) {
    logger.error('Hotel search failed', {
      query,
      error: err instanceof Error ? err.message : String(err),
    });
    if (driver) {
      await saveFailureScreenshot(driver, 'search-error');
    }
    return [];
  } finally {
    if (driver) {
      try {
        await driver.quit();
      } catch {
        // Ignore quit errors
      }
    }
  }
}

// ── Scrape OTA Rates for a Specific Hotel ───────────────────────────────────

export async function scrapeHotelRates(
  hotelIdentifier: string,
  checkIn: string,
  checkOut: string,
  currency: string = config.BASE_CURRENCY
): Promise<RateResult[]> {
  let driver: WebDriver | null = null;

  try {
    driver = await createDriver();

    // Build URL - hotelIdentifier can be a full URL or a search query/name
    let targetUrl: string;
    if (hotelIdentifier.startsWith('http')) {
      // It's a URL - add dates
      const url = new URL(hotelIdentifier);
      url.searchParams.set('dates', `${checkIn},${checkOut}`);
      url.searchParams.set('guests', '2');
      targetUrl = url.toString();
    } else {
      // Build a Google Hotels search URL for the specific hotel
      targetUrl = `https://www.google.com/travel/hotels?q=${encodeURIComponent(hotelIdentifier)}&dates=${checkIn},${checkOut}&guests=2&hl=en&gl=us&currency=${currency}`;
    }

    logger.info('Scraping hotel rates via Selenium', { hotelIdentifier, checkIn, checkOut });

    await driver.get(targetUrl);
    await new Promise((r) => setTimeout(r, getRandomDelay()));

    // Check for captcha
    if (await detectCaptcha(driver)) {
      logger.warn('Captcha detected during rate scrape');
      await saveFailureScreenshot(driver, 'rates-captcha');
      return [];
    }

    // If this is a search result, try to click the first hotel to go to its detail page
    try {
      const hotelLink = await driver.findElement(
        By.css('a[href*="/travel/hotels/entity"], div[data-hveid] a, .kCsInf a')
      );
      await hotelLink.click();
      await new Promise((r) => setTimeout(r, 3000));
    } catch {
      // Already on detail page or couldn't find link
    }

    // Wait for price listings to load
    try {
      await driver.wait(
        until.elementsLocated(By.css('[class*="price"], [class*="rate"], [data-ved]')),
        15000
      );
    } catch {
      logger.warn('Price elements not found, attempting to parse anyway');
    }

    await new Promise((r) => setTimeout(r, 2000));

    // Extract rates from the page
    const rates = await extractRatesFromPage(driver);

    logger.info('Rate scraping completed', {
      hotelIdentifier,
      ratesFound: rates.length,
    });

    return rates;
  } catch (err) {
    logger.error('Rate scraping failed', {
      hotelIdentifier,
      error: err instanceof Error ? err.message : String(err),
    });
    if (driver) {
      await saveFailureScreenshot(driver, 'rates-error');
    }
    return [];
  } finally {
    if (driver) {
      try {
        await driver.quit();
      } catch {
        // Ignore quit errors
      }
    }
  }
}

// ── Extract Rates from a Hotel Detail Page ──────────────────────────────────

async function extractRatesFromPage(driver: WebDriver): Promise<RateResult[]> {
  const results: RateResult[] = [];

  // Strategy 1: Look for structured OTA pricing rows
  const rowSelectors = [
    'div[data-ved] a[data-tracking-label]',
    '[class*="deal-choice"]',
    '.K1smNd',
    '.QCSUuc',
    '.tEWKCe',
    'div[data-ved] a[href*="booking.com"], div[data-ved] a[href*="expedia"], div[data-ved] a[href*="agoda"], div[data-ved] a[href*="hotels.com"]',
  ];

  let priceElements: WebElement[] = [];
  for (const selector of rowSelectors) {
    try {
      priceElements = await driver.findElements(By.css(selector));
      if (priceElements.length > 0) break;
    } catch {
      continue;
    }
  }

  // Strategy 2: Try broader approach - any element with price-like text
  if (priceElements.length === 0) {
    try {
      priceElements = await driver.findElements(By.css('[data-ved] > div, [data-ved] > a'));
    } catch {
      // last resort
    }
  }

  const seenProviders = new Set<string>();

  for (const el of priceElements) {
    try {
      const text = await el.getText();
      if (!text || text.length < 5) continue;

      const { amount: rateAmount, currency } = parseCurrencyFromText(text);
      if (rateAmount === null || rateAmount <= 0) continue;

      // Extract provider name
      let providerName = 'Unknown';

      // Check href for known providers
      try {
        const href = await el.getAttribute('href');
        if (href) {
          if (href.includes('booking.com')) providerName = 'Booking.com';
          else if (href.includes('expedia')) providerName = 'Expedia';
          else if (href.includes('agoda')) providerName = 'Agoda';
          else if (href.includes('hotels.com')) providerName = 'Hotels.com';
          else if (href.includes('trip.com')) providerName = 'Trip.com';
          else if (href.includes('trivago')) providerName = 'Trivago';
          else if (href.includes('kayak')) providerName = 'Kayak';
          else if (href.includes('priceline')) providerName = 'Priceline';
          else if (href.includes('makemytrip')) providerName = 'MakeMyTrip';
          else if (href.includes('traveloka')) providerName = 'Traveloka';
        }
      } catch {
        // No href
      }

      // Fallback: try to get provider from text
      if (providerName === 'Unknown') {
        const lines = text.split('\n').filter((l) => l.trim());
        const knownProviders = [
          'Booking.com', 'Expedia', 'Agoda', 'Hotels.com', 'Trip.com',
          'Trivago', 'Kayak', 'Priceline', 'MakeMyTrip', 'Traveloka',
          'Official Site', 'Direct', 'Snaptravel', 'Prestigia',
        ];

        for (const line of lines) {
          const trimmed = line.trim();
          const match = knownProviders.find(
            (p) => trimmed.toLowerCase().includes(p.toLowerCase())
          );
          if (match) {
            providerName = match;
            break;
          }
        }

        // If still unknown, use first non-price line
        if (providerName === 'Unknown') {
          for (const line of lines) {
            const trimmed = line.trim();
            if (
              trimmed.length >= 3 &&
              trimmed.length <= 50 &&
              !trimmed.match(/^[\$€£¥₹₩฿]/) &&
              !trimmed.match(/^\d/) &&
              !trimmed.toLowerCase().includes('per night') &&
              !trimmed.toLowerCase().includes('total')
            ) {
              providerName = trimmed;
              break;
            }
          }
        }
      }

      // Deduplicate by provider
      const providerKey = `${providerName}:${rateAmount}`;
      if (seenProviders.has(providerKey)) continue;
      seenProviders.add(providerKey);

      // Detect flags
      const textLower = text.toLowerCase();
      const taxesIncluded =
        textLower.includes('taxes') ||
        textLower.includes('incl.') ||
        textLower.includes('including') ||
        textLower.includes('total');
      const freeCancellation =
        textLower.includes('free cancellation') ||
        textLower.includes('cancel free') ||
        textLower.includes('refundable');

      // Detect room type
      let roomType: string | null = null;
      const roomMatch = text.match(
        /(standard|superior|deluxe|suite|executive|family|twin|single|double|king|queen)\s*(room|suite|bed)?/i
      );
      if (roomMatch) {
        roomType = roomMatch[0].trim();
      }

      results.push({
        provider_name: providerName,
        rate_amount: rateAmount,
        currency,
        room_type: roomType,
        taxes_included: taxesIncluded,
        free_cancellation: freeCancellation,
        is_available: true,
        raw_text: text.substring(0, 500),
      });
    } catch (err) {
      logger.debug('Failed to parse rate element', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Strategy 3: If still no results, do a full page scan for any prices
  if (results.length === 0) {
    try {
      const pageSource = await driver.getPageSource();
      // Extract all price-like patterns from the page HTML
      const priceRegex = /(?:THB|฿|USD|\$|EUR|€|GBP|£)\s?[\d,]+(?:\.\d{1,2})?/gi;
      const matches = pageSource.match(priceRegex) ?? [];
      const uniquePrices = [...new Set(matches)];

      for (const priceStr of uniquePrices.slice(0, 10)) {
        const { amount, currency: curr } = parseCurrencyFromText(priceStr);
        if (amount && amount > 10) {
          results.push({
            provider_name: 'Unknown',
            rate_amount: amount,
            currency: curr,
            room_type: null,
            taxes_included: false,
            free_cancellation: false,
            is_available: true,
            raw_text: priceStr,
          });
        }
      }
    } catch {
      // Ignore page source errors
    }
  }

  return results;
}

// ── Main Scrape Function (Backward Compatible) ─────────────────────────────

export async function scrapeGoogleHotels(
  hotelIdentifier: string,
  checkIn: string,
  checkOut: string,
  guests: number = 2
): Promise<ScrapeResult> {
  const maxAttempts = 3;
  const backoffBase = 2000;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.info('Starting Selenium scrape attempt', {
        attempt,
        hotelIdentifier,
        checkIn,
        checkOut,
        guests,
      });

      const rates = await scrapeHotelRates(
        hotelIdentifier,
        checkIn,
        checkOut,
        config.BASE_CURRENCY
      );

      logger.info('Selenium scrape completed', {
        hotelIdentifier,
        ratesFound: rates.length,
        checkIn,
        checkOut,
      });

      return {
        success: true,
        rates,
        url: hotelIdentifier.startsWith('http')
          ? hotelIdentifier
          : `google_hotels:${hotelIdentifier}`,
        check_in: checkIn,
        check_out: checkOut,
        scraped_at: new Date(),
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.error('Selenium scrape attempt failed', {
        attempt,
        hotelIdentifier,
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
    url: hotelIdentifier.startsWith('http')
      ? hotelIdentifier
      : `google_hotels:${hotelIdentifier}`,
    check_in: checkIn,
    check_out: checkOut,
    scraped_at: new Date(),
    error: lastError?.message ?? 'All Selenium scrape attempts failed',
  };
}
