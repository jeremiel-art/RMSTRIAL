import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './utils/config.js';
import { logger } from './utils/logger.js';
import { startScheduler, stopScheduler } from './scheduler/cronJobs.js';
import { closePool } from './db/queries.js';

import ratesRouter from './routes/rates.js';
import refreshRouter from './routes/refresh.js';
import parityRouter from './routes/parity.js';
import historyRouter from './routes/history.js';
import competitorsRouter from './routes/competitors.js';
import calendarRouter from './routes/calendar.js';
import dashboardRouter from './routes/dashboard.js';

// ── App Setup ───────────────────────────────────────────────────────────────

const app = express();

// Security & parsing middleware
app.use(helmet());
app.use(
  cors({
    origin: config.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path,
    query: req.query,
  });
  next();
});

// ── Health Check ────────────────────────────────────────────────────────────

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// ── Mount Routes ────────────────────────────────────────────────────────────

app.use('/api/rates', ratesRouter);
app.use('/api/refresh', refreshRouter);
app.use('/api/parity', parityRouter);
app.use('/api/history', historyRouter);
app.use('/api/competitors', competitorsRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/dashboard', dashboardRouter);

// ── 404 Handler ─────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Global Error Handler ────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
  });

  const statusCode = 'statusCode' in err ? (err as { statusCode: number }).statusCode : 500;
  const message = config.NODE_ENV === 'production' ? 'Internal server error' : err.message;

  res.status(statusCode).json({ error: message });
});

// ── Start Server ────────────────────────────────────────────────────────────

const server = app.listen(config.PORT, () => {
  logger.info(`Server started on port ${config.PORT}`, {
    env: config.NODE_ENV,
    port: config.PORT,
  });

  // Start cron scheduler
  startScheduler();
});

// ── Graceful Shutdown ───────────────────────────────────────────────────────

function shutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  stopScheduler();

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      await closePool();
      logger.info('Database pool closed');
    } catch (err) {
      logger.error('Error closing database pool', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
