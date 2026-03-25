import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { refreshProperty } from '../scheduler/cronJobs.js';
import { getRefreshStatus } from '../db/queries.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ── Validation Schemas ──────────────────────────────────────────────────────

const triggerRefreshSchema = z.object({
  property_id: z.string().uuid('property_id must be a valid UUID'),
  competitor_ids: z.array(z.string().uuid()).optional(),
  date_range: z
    .object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
    })
    .optional(),
});

const refreshStatusSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

// ── POST / ──────────────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = triggerRefreshSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { property_id, competitor_ids, date_range } = parsed.data;

    logger.info('Manual refresh triggered', { property_id, competitor_ids, date_range });

    // Start refresh in background - don't await
    const refreshPromise = refreshProperty(property_id, 'manual', {
      competitor_ids,
      date_range,
    });

    // Return the refresh ID immediately via a race with a small timeout to
    // get the refresh log ID before the full scrape completes
    let refreshId: string | null = null;
    try {
      refreshId = await Promise.race([
        refreshPromise,
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 5000)
        ),
      ]);
    } catch {
      // Refresh is running in background, we'll get status from DB
    }

    // If we got the ID synchronously (fast path), return it;
    // otherwise query recent refresh logs
    if (refreshId) {
      res.status(202).json({
        message: 'Refresh completed',
        refresh_id: refreshId,
      });
    } else {
      // Refresh is still running; the caller can poll status
      // We don't have the ID yet, but the refresh was accepted
      res.status(202).json({
        message: 'Refresh started',
        property_id,
      });

      // Let the refresh complete in the background
      refreshPromise.catch((err) => {
        logger.error('Background refresh failed', {
          property_id,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('already in progress')) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
});

// ── GET /:id/status ─────────────────────────────────────────────────────────

router.get('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = refreshStatusSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const refreshLog = await getRefreshStatus(parsed.data.id);

    if (!refreshLog) {
      res.status(404).json({ error: 'Refresh log not found' });
      return;
    }

    res.json({ data: refreshLog });
  } catch (err) {
    next(err);
  }
});

export default router;
