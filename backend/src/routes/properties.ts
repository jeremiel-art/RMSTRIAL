import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { getProperties, getPropertyById, createProperty } from '../db/queries.js';

const router = Router();

// ── Validation Schemas ──────────────────────────────────────────────────────

const createPropertySchema = z.object({
  name: z.string().min(1, 'name is required').max(255),
  address: z.string().max(500).optional(),
  google_hotels_url: z.string().max(500).optional(),
});

// ── GET / ───────────────────────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const properties = await getProperties();
    res.json(properties);
  } catch (err) {
    next(err);
  }
});

// ── GET /:id ────────────────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const property = await getPropertyById(req.params.id as string);
    if (!property) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }
    res.json({ data: property });
  } catch (err) {
    next(err);
  }
});

// ── POST / ──────────────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createPropertySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const property = await createProperty(parsed.data);
    res.status(201).json({ data: property });
  } catch (err) {
    next(err);
  }
});

export default router;
