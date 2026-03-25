import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { getDashboardSummary } from '../db/queries.js';

const router = Router();

// ── Validation Schemas ──────────────────────────────────────────────────────

const dashboardSchema = z.object({
  property_id: z.string().uuid('property_id must be a valid UUID'),
});

// ── GET /summary ────────────────────────────────────────────────────────────

router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = dashboardSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const summary = await getDashboardSummary(parsed.data.property_id);
    res.json({ data: summary });
  } catch (err) {
    next(err);
  }
});

export default router;
