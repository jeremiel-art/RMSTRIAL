import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { getLatestRates, getRateHistory, getRateGrid } from '../db/queries.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ── Validation Schemas ──────────────────────────────────────────────────────

const currentRatesSchema = z.object({
  property_id: z.string().uuid('property_id must be a valid UUID'),
});

const rateHistorySchema = z.object({
  competitor_id: z.string().uuid('competitor_id must be a valid UUID'),
  check_in: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'check_in must be YYYY-MM-DD'),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

const rateGridSchema = z.object({
  property_id: z.string().uuid('property_id must be a valid UUID'),
});

// ── GET /current ────────────────────────────────────────────────────────────

router.get('/current', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = currentRatesSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const rates = await getLatestRates(parsed.data.property_id);
    res.json({ data: rates });
  } catch (err) {
    next(err);
  }
});

// ── GET /history ────────────────────────────────────────────────────────────

router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = rateHistorySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { competitor_id, check_in, days } = parsed.data;
    const history = await getRateHistory(competitor_id, check_in, days);
    res.json({ data: history });
  } catch (err) {
    next(err);
  }
});

// ── GET /grid ───────────────────────────────────────────────────────────────

router.get('/grid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = rateGridSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const grid = await getRateGrid(parsed.data.property_id);
    res.json({ data: grid });
  } catch (err) {
    next(err);
  }
});

export default router;
