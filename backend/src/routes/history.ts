import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { getRateChanges } from '../db/queries.js';

const router = Router();

// ── Validation Schemas ──────────────────────────────────────────────────────

const rateChangesSchema = z.object({
  property_id: z.string().uuid('property_id must be a valid UUID'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'from must be a valid date string'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'to must be a valid date string'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// ── GET /rate-changes ───────────────────────────────────────────────────────

router.get('/rate-changes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = rateChangesSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { property_id, from, to, limit, offset } = parsed.data;
    const result = await getRateChanges(property_id, from, to, { limit, offset });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
