import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { getCompetitors, createCompetitor, deleteCompetitor, toggleCompetitor } from '../db/queries.js';

const router = Router();

// ── Validation Schemas ──────────────────────────────────────────────────────

const listCompetitorsSchema = z.object({
  property_id: z.string().uuid('property_id must be a valid UUID'),
});

const createCompetitorSchema = z.object({
  property_id: z.string().uuid('property_id must be a valid UUID'),
  name: z.string().min(1, 'name is required').max(255),
  google_hotels_url: z.string().min(1, 'google_hotels_url (property token) is required').max(500),
});

const deleteCompetitorSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

// ── GET / ───────────────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = listCompetitorsSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const competitors = await getCompetitors(parsed.data.property_id);
    res.json({ data: competitors });
  } catch (err) {
    next(err);
  }
});

// ── POST / ──────────────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createCompetitorSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const competitor = await createCompetitor(parsed.data);
    res.status(201).json({ data: competitor });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /:id ─────────────────────────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = deleteCompetitorSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const competitor = await deleteCompetitor(parsed.data.id);

    if (!competitor) {
      res.status(404).json({ error: 'Competitor not found' });
      return;
    }

    res.json({ data: competitor, message: 'Competitor deactivated' });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /:id ────────────────────────────────────────────────────────────

const toggleCompetitorSchema = z.object({
  is_active: z.boolean(),
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idParsed = deleteCompetitorSchema.safeParse(req.params);
    if (!idParsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: idParsed.error.flatten().fieldErrors,
      });
      return;
    }

    const bodyParsed = toggleCompetitorSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: bodyParsed.error.flatten().fieldErrors,
      });
      return;
    }

    const competitor = await toggleCompetitor(idParsed.data.id, bodyParsed.data.is_active);

    if (!competitor) {
      res.status(404).json({ error: 'Competitor not found' });
      return;
    }

    res.json({ data: competitor });
  } catch (err) {
    next(err);
  }
});

export default router;
