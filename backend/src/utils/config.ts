import dotenv from 'dotenv';

dotenv.config();

function envString(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function envInt(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (raw === undefined) return defaultValue;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function envFloat(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (raw === undefined) return defaultValue;
  const parsed = parseFloat(raw);
  return isNaN(parsed) ? defaultValue : parsed;
}

function envArray(key: string, defaultValue: number[]): number[] {
  const raw = process.env[key];
  if (raw === undefined) return defaultValue;
  return raw.split(',').map((s) => {
    const n = parseInt(s.trim(), 10);
    return isNaN(n) ? 0 : n;
  });
}

export const config = {
  DATABASE_URL: envString('DATABASE_URL', 'postgresql://localhost:5432/rate_shopper'),
  PORT: envInt('PORT', 3001),
  NODE_ENV: envString('NODE_ENV', 'development'),
  FRONTEND_URL: envString('FRONTEND_URL', 'http://localhost:3000'),

  SCRAPER_CONCURRENCY: envInt('SCRAPER_CONCURRENCY', 3),
  SCRAPER_TIMEOUT_MS: envInt('SCRAPER_TIMEOUT_MS', 30000),
  SCRAPER_DELAY_MIN_MS: envInt('SCRAPER_DELAY_MIN_MS', 2000),
  SCRAPER_DELAY_MAX_MS: envInt('SCRAPER_DELAY_MAX_MS', 5000),

  REFRESH_SCHEDULE_1: envString('REFRESH_SCHEDULE_1', '0 6 * * *'),
  REFRESH_SCHEDULE_2: envString('REFRESH_SCHEDULE_2', '0 14 * * *'),
  REFRESH_SCHEDULE_3: envString('REFRESH_SCHEDULE_3', '0 22 * * *'),

  PARITY_THRESHOLD_PCT: envFloat('PARITY_THRESHOLD_PCT', 2),
  LOOK_AHEAD_DAYS: envArray('LOOK_AHEAD_DAYS', [1, 3, 7, 14, 30, 60, 90]),
  BASE_CURRENCY: envString('BASE_CURRENCY', 'THB'),

  CHROME_BIN: envString('CHROME_BIN', ''),
  CHROMEDRIVER_PATH: envString('CHROMEDRIVER_PATH', ''),
} as const;

export type Config = typeof config;
