import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { getCalendarData, getCheapestSummary } from '../db/queries.js';

const router = Router();

// ── Validation Schemas ──────────────────────────────────────────────────────

const calendarSchema = z.object({
  property_id: z.string().uuid('property_id must be a valid UUID'),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM format')
    .transform((val) => {
      const [year, month] = val.split('-').map(Number);
      return { year, month };
    }),
});

const cheapestSummarySchema = z.object({
  property_id: z.string().uuid('property_id must be a valid UUID'),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM format')
    .transform((val) => {
      const [year, month] = val.split('-').map(Number);
      return { year, month };
    }),
});

// ── GET / ───────────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = calendarSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { property_id, month } = parsed.data;
    const data = await getCalendarData(property_id, month.year, month.month);

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// ── GET /cheapest-summary ───────────────────────────────────────────────────

router.get('/cheapest-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = cheapestSummarySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { property_id, month } = parsed.data;
    const data = await getCheapestSummary(property_id, month.year, month.month);

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
