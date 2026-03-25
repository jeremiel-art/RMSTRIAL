import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { getParityAlerts, acknowledgeAlert } from '../db/queries.js';

const router = Router();

// ── Validation Schemas ──────────────────────────────────────────────────────

const listParitySchema = z.object({
  property_id: z.string().uuid('property_id must be a valid UUID'),
  status: z.enum(['new', 'acknowledged']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const acknowledgeSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

// ── GET / ───────────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = listParitySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { property_id, status, limit, offset } = parsed.data;
    const result = await getParityAlerts(property_id, status ?? null, { limit, offset });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /:id/acknowledge ──────────────────────────────────────────────────

router.patch('/:id/acknowledge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = acknowledgeSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const alert = await acknowledgeAlert(parsed.data.id);

    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    res.json({ data: alert });
  } catch (err) {
    next(err);
  }
});

export default router;
