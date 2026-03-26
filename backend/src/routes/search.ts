import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { searchHotels } from '../scraper/googleHotels.js';

const router = Router();

// ── Date Helpers ────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDate(d);
}

function getDayAfterTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return formatDate(d);
}

// ── Validation Schema ───────────────────────────────────────────────────────

const searchHotelsSchema = z.object({
  q: z.string().min(1, 'q (search query) is required').max(500),
  check_in: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'check_in must be YYYY-MM-DD format')
    .optional(),
  check_out: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'check_out must be YYYY-MM-DD format')
    .optional(),
});

// ── GET /hotels ─────────────────────────────────────────────────────────────

router.get('/hotels', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = searchHotelsSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { q } = parsed.data;
    const checkIn = parsed.data.check_in ?? getTomorrow();
    const checkOut = parsed.data.check_out ?? getDayAfterTomorrow();

    // Validate date ordering
    if (checkOut <= checkIn) {
      res.status(400).json({
        error: 'Validation failed',
        details: { check_out: ['check_out must be after check_in'] },
      });
      return;
    }

    const results = await searchHotels(q, checkIn, checkOut);

    const hotels = results.map((h) => ({
      property_token: h.property_token,
      name: h.name,
      address: h.address,
      overall_rating: h.overall_rating,
      stars: h.stars,
      thumbnail: h.thumbnail,
      rate_per_night: h.rate_per_night,
      currency: h.currency,
      reviews: h.reviews,
      amenities: h.amenities,
    }));

    res.json({
      data: hotels,
      meta: {
        query: q,
        check_in: checkIn,
        check_out: checkOut,
        count: hotels.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
