import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { scrapeGoogleHotels } from '../scraper/googleHotels.js';
import { normalizeRate } from '../scraper/normalizer.js';
import {
  getProperties,
  getActiveCompetitors,
  createRefreshLog,
  updateRefreshLog,
  insertRateSnapshot,
  getPreviousRate,
  insertRateChange,
  createParityAlert,
  getLatestRates,
  type Competitor,
} from '../db/queries.js';

// ── Types ───────────────────────────────────────────────────────────────────

interface RefreshOptions {
  competitor_ids?: string[];
  date_range?: { from: string; to: string };
  look_ahead_days?: number[];
}

// ── Concurrency Control ─────────────────────────────────────────────────────

class Semaphore {
  private current = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.current++;
        resolve();
      });
    });
  }

  release(): void {
    this.current--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

const scrapeSemaphore = new Semaphore(config.SCRAPER_CONCURRENCY);

// ── Active Refresh Tracking ─────────────────────────────────────────────────

const activeRefreshes = new Set<string>();

// ── Date Helpers ────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ── Refresh Logic ───────────────────────────────────────────────────────────

export async function refreshProperty(
  propertyId: string,
  triggerType: 'manual' | 'scheduled',
  options?: RefreshOptions
): Promise<string> {
  if (activeRefreshes.has(propertyId)) {
    logger.warn('Refresh already in progress for property', { propertyId });
    throw new Error(`Refresh already in progress for property ${propertyId}`);
  }

  activeRefreshes.add(propertyId);
  const refreshId = uuidv4();

  try {
    // Fetch active competitors
    let competitors = await getActiveCompetitors(propertyId);

    // Filter by specific competitor IDs if provided
    if (options?.competitor_ids && options.competitor_ids.length > 0) {
      const idSet = new Set(options.competitor_ids);
      competitors = competitors.filter((c) => idSet.has(c.id));
    }

    // Create refresh log
    const refreshLog = await createRefreshLog({
      property_id: propertyId,
      trigger_type: triggerType,
      status: 'running',
      total_competitors: competitors.length,
    });

    const logId = refreshLog.id;
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    // Determine look-ahead days
    const lookAheadDays = options?.look_ahead_days ?? config.LOOK_AHEAD_DAYS;
    const today = new Date();

    // Build list of check-in dates
    let checkInDates: string[];

    if (options?.date_range) {
      // Use explicit date range
      checkInDates = [];
      const start = new Date(options.date_range.from);
      const end = new Date(options.date_range.to);
      const current = new Date(start);
      while (current <= end) {
        checkInDates.push(formatDate(current));
        current.setDate(current.getDate() + 1);
      }
    } else {
      // Use look-ahead days
      checkInDates = (lookAheadDays as readonly number[]).map((days) => addDays(today, days));
    }

    logger.info('Starting property refresh', {
      propertyId,
      refreshId: logId,
      triggerType,
      competitorCount: competitors.length,
      dateCount: checkInDates.length,
    });

    // Scrape all competitors for all dates
    const scrapeJobs: Array<{
      competitor: Competitor;
      checkIn: string;
      checkOut: string;
    }> = [];

    for (const competitor of competitors) {
      for (const checkIn of checkInDates) {
        const checkInDate = new Date(checkIn);
        const checkOut = addDays(checkInDate, 1); // 1-night stay
        scrapeJobs.push({ competitor, checkIn, checkOut });
      }
    }

    // Execute scrape jobs with concurrency control
    const jobPromises = scrapeJobs.map(async (job) => {
      await scrapeSemaphore.acquire();

      try {
        const result = await scrapeGoogleHotels(
          job.competitor.google_hotels_url,
          job.checkIn,
          job.checkOut
        );

        if (result.success && result.rates.length > 0) {
          for (const rawRate of result.rates) {
            const normalized = normalizeRate(rawRate);

            const snapshot = await insertRateSnapshot({
              competitor_id: job.competitor.id,
              property_id: propertyId,
              source: 'google_hotels',
              check_in_date: job.checkIn,
              check_out_date: job.checkOut,
              room_type: normalized.room_type,
              rate_amount: normalized.rate_amount,
              currency: normalized.currency,
              is_available: normalized.is_available,
              refresh_id: logId,
            });

            // Detect rate changes
            if (normalized.rate_amount !== null) {
              const previous = await getPreviousRate(
                job.competitor.id,
                job.checkIn,
                normalized.room_type,
                snapshot.id
              );

              if (previous && previous.rate_amount !== null) {
                const oldRate = parseFloat(String(previous.rate_amount));
                const newRate = normalized.rate_amount;

                if (oldRate !== newRate) {
                  const changeAmount = newRate - oldRate;
                  const changePct =
                    oldRate !== 0
                      ? Math.round(((newRate - oldRate) / oldRate) * 10000) / 100
                      : 0;

                  await insertRateChange({
                    competitor_id: job.competitor.id,
                    property_id: propertyId,
                    check_in_date: job.checkIn,
                    room_type: normalized.room_type,
                    old_rate: oldRate,
                    new_rate: newRate,
                    change_amount: changeAmount,
                    change_pct: changePct,
                  });
                }
              }
            }
          }
          successCount++;
        } else if (!result.success) {
          failCount++;
          errors.push(
            `Failed: ${job.competitor.name} for ${job.checkIn}: ${result.error ?? 'Unknown error'}`
          );
        } else {
          // Success but no rates found
          await insertRateSnapshot({
            competitor_id: job.competitor.id,
            property_id: propertyId,
            source: 'google_hotels',
            check_in_date: job.checkIn,
            check_out_date: job.checkOut,
            room_type: null,
            rate_amount: null,
            currency: config.BASE_CURRENCY,
            is_available: false,
            refresh_id: logId,
          });
          successCount++;
        }
      } catch (err) {
        failCount++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Error: ${job.competitor.name} for ${job.checkIn}: ${msg}`);
        logger.error('Scrape job error', {
          competitor: job.competitor.name,
          checkIn: job.checkIn,
          error: msg,
        });
      } finally {
        scrapeSemaphore.release();
      }
    });

    await Promise.all(jobPromises);

    // Run parity check after all scrapes complete
    await runParityCheck(propertyId, logId);

    // Update refresh log
    const finalStatus = failCount === scrapeJobs.length ? 'failed' : 'completed';
    await updateRefreshLog(logId, {
      status: finalStatus,
      completed_at: new Date(),
      successful_scrapes: successCount,
      failed_scrapes: failCount,
      error_log: errors.length > 0 ? errors.join('\n') : undefined,
    });

    logger.info('Property refresh completed', {
      propertyId,
      refreshId: logId,
      status: finalStatus,
      successCount,
      failCount,
    });

    return logId;
  } finally {
    activeRefreshes.delete(propertyId);
  }
}

// ── Parity Check ────────────────────────────────────────────────────────────

async function runParityCheck(propertyId: string, refreshId: string): Promise<void> {
  try {
    const latestRates = await getLatestRates(propertyId);

    // Group rates by check_in_date and room_type
    const grouped = new Map<
      string,
      Array<{
        competitor_id: string;
        rate_amount: number;
        snapshot_id: string;
        room_type: string | null;
        check_in_date: string;
      }>
    >();

    for (const rate of latestRates) {
      if (rate.rate_amount === null || !rate.is_available) continue;
      if (rate.refresh_id !== refreshId) continue;

      const key = `${rate.check_in_date}:${rate.room_type ?? 'default'}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push({
        competitor_id: rate.competitor_id,
        rate_amount: parseFloat(String(rate.rate_amount)),
        snapshot_id: rate.id,
        room_type: rate.room_type,
        check_in_date: String(rate.check_in_date),
      });
    }

    // For each group, compare rates and detect parity issues
    for (const [, rates] of grouped) {
      if (rates.length < 2) continue;

      // Sort by rate
      rates.sort((a, b) => a.rate_amount - b.rate_amount);
      const cheapest = rates[0];

      for (let i = 1; i < rates.length; i++) {
        const current = rates[i];
        const diffAmount = current.rate_amount - cheapest.rate_amount;
        const diffPct =
          cheapest.rate_amount !== 0
            ? Math.round((diffAmount / cheapest.rate_amount) * 10000) / 100
            : 0;

        if (Math.abs(diffPct) > config.PARITY_THRESHOLD_PCT) {
          await createParityAlert({
            property_id: propertyId,
            competitor_id: current.competitor_id,
            rate_snapshot_id: current.snapshot_id,
            our_rate: cheapest.rate_amount,
            competitor_rate: current.rate_amount,
            difference_amount: diffAmount,
            difference_pct: diffPct,
            check_in_date: current.check_in_date,
            room_type: current.room_type,
          });
        }
      }
    }

    logger.debug('Parity check completed', { propertyId, refreshId });
  } catch (err) {
    logger.error('Parity check failed', {
      propertyId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Cron Scheduler ──────────────────────────────────────────────────────────

const scheduledTasks: cron.ScheduledTask[] = [];

export function startScheduler(): void {
  const schedules = [
    config.REFRESH_SCHEDULE_1,
    config.REFRESH_SCHEDULE_2,
    config.REFRESH_SCHEDULE_3,
  ];

  for (const schedule of schedules) {
    if (!cron.validate(schedule)) {
      logger.error('Invalid cron schedule', { schedule });
      continue;
    }

    const task = cron.schedule(schedule, async () => {
      logger.info('Scheduled refresh triggered', { schedule });

      try {
        const properties = await getProperties();

        for (const property of properties) {
          try {
            await refreshProperty(property.id, 'scheduled');
          } catch (err) {
            logger.error('Scheduled refresh failed for property', {
              propertyId: property.id,
              propertyName: property.name,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      } catch (err) {
        logger.error('Scheduled refresh cycle failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    scheduledTasks.push(task);
    logger.info('Scheduled cron job', { schedule });
  }
}

export function stopScheduler(): void {
  for (const task of scheduledTasks) {
    task.stop();
  }
  scheduledTasks.length = 0;
  logger.info('All scheduled tasks stopped');
}
