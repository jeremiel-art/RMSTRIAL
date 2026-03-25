import pg from 'pg';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected database pool error', { error: err.message });
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ── Property Types ──────────────────────────────────────────────────────────

export interface PropertyInput {
  name: string;
  address?: string;
  google_hotels_url?: string;
}

export interface Property {
  id: string;
  name: string;
  address: string | null;
  google_hotels_url: string | null;
  created_at: Date;
}

// ── Competitor Types ────────────────────────────────────────────────────────

export interface CompetitorInput {
  property_id: string;
  name: string;
  google_hotels_url: string;
}

export interface Competitor {
  id: string;
  property_id: string;
  name: string;
  google_hotels_url: string;
  is_active: boolean;
  created_at: Date;
}

// ── Rate Snapshot Types ─────────────────────────────────────────────────────

export interface RateSnapshotInput {
  competitor_id: string;
  property_id: string;
  source?: string;
  check_in_date: string;
  check_out_date: string;
  room_type: string | null;
  rate_amount: number | null;
  currency: string;
  is_available: boolean;
  refresh_id: string | null;
}

export interface RateSnapshot {
  id: string;
  competitor_id: string;
  property_id: string;
  source: string;
  check_in_date: string;
  check_out_date: string;
  room_type: string | null;
  rate_amount: number | null;
  currency: string;
  is_available: boolean;
  scraped_at: Date;
  refresh_id: string | null;
}

// ── Refresh Log Types ───────────────────────────────────────────────────────

export interface RefreshLogInput {
  property_id: string;
  trigger_type: 'manual' | 'scheduled';
  status: 'running' | 'completed' | 'failed';
  total_competitors: number;
}

export interface RefreshLogUpdate {
  status?: 'running' | 'completed' | 'failed';
  completed_at?: Date;
  successful_scrapes?: number;
  failed_scrapes?: number;
  error_log?: string;
}

export interface RefreshLog {
  id: string;
  property_id: string;
  trigger_type: string;
  status: string;
  started_at: Date;
  completed_at: Date | null;
  total_competitors: number;
  successful_scrapes: number;
  failed_scrapes: number;
  error_log: string | null;
}

// ── Parity Alert Types ──────────────────────────────────────────────────────

export interface ParityAlertInput {
  property_id: string;
  competitor_id: string;
  rate_snapshot_id: string | null;
  our_rate: number;
  competitor_rate: number;
  difference_amount: number;
  difference_pct: number;
  check_in_date: string;
  room_type: string | null;
}

export interface ParityAlert {
  id: string;
  property_id: string;
  competitor_id: string;
  rate_snapshot_id: string | null;
  our_rate: number;
  competitor_rate: number;
  difference_amount: number;
  difference_pct: number;
  check_in_date: string;
  room_type: string | null;
  alert_status: string;
  detected_at: Date;
}

// ── Rate Change Types ───────────────────────────────────────────────────────

export interface RateChangeInput {
  competitor_id: string;
  property_id: string;
  check_in_date: string;
  room_type: string | null;
  old_rate: number;
  new_rate: number;
  change_amount: number;
  change_pct: number;
}

export interface RateChange {
  id: string;
  competitor_id: string;
  property_id: string;
  check_in_date: string;
  room_type: string | null;
  old_rate: number;
  new_rate: number;
  change_amount: number;
  change_pct: number;
  detected_at: Date;
}

// ── Pagination ──────────────────────────────────────────────────────────────

export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// PROPERTIES
// ══════════════════════════════════════════════════════════════════════════════

export async function getProperties(): Promise<Property[]> {
  const db = getPool();
  const result = await db.query<Property>(
    'SELECT id, name, address, google_hotels_url, created_at FROM properties ORDER BY created_at DESC'
  );
  return result.rows;
}

export async function getPropertyById(id: string): Promise<Property | null> {
  const db = getPool();
  const result = await db.query<Property>(
    'SELECT id, name, address, google_hotels_url, created_at FROM properties WHERE id = $1',
    [id]
  );
  return result.rows[0] ?? null;
}

export async function createProperty(data: PropertyInput): Promise<Property> {
  const db = getPool();
  const result = await db.query<Property>(
    `INSERT INTO properties (name, address, google_hotels_url)
     VALUES ($1, $2, $3)
     RETURNING id, name, address, google_hotels_url, created_at`,
    [data.name, data.address ?? null, data.google_hotels_url ?? null]
  );
  return result.rows[0];
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPETITORS
// ══════════════════════════════════════════════════════════════════════════════

export async function getCompetitors(propertyId: string): Promise<Competitor[]> {
  const db = getPool();
  const result = await db.query<Competitor>(
    `SELECT id, property_id, name, google_hotels_url, is_active, created_at
     FROM competitors
     WHERE property_id = $1
     ORDER BY created_at DESC`,
    [propertyId]
  );
  return result.rows;
}

export async function getActiveCompetitors(propertyId: string): Promise<Competitor[]> {
  const db = getPool();
  const result = await db.query<Competitor>(
    `SELECT id, property_id, name, google_hotels_url, is_active, created_at
     FROM competitors
     WHERE property_id = $1 AND is_active = true
     ORDER BY created_at DESC`,
    [propertyId]
  );
  return result.rows;
}

export async function createCompetitor(data: CompetitorInput): Promise<Competitor> {
  const db = getPool();
  const result = await db.query<Competitor>(
    `INSERT INTO competitors (property_id, name, google_hotels_url)
     VALUES ($1, $2, $3)
     RETURNING id, property_id, name, google_hotels_url, is_active, created_at`,
    [data.property_id, data.name, data.google_hotels_url]
  );
  return result.rows[0];
}

export async function deleteCompetitor(id: string): Promise<Competitor | null> {
  const db = getPool();
  const result = await db.query<Competitor>(
    `UPDATE competitors SET is_active = false
     WHERE id = $1
     RETURNING id, property_id, name, google_hotels_url, is_active, created_at`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function toggleCompetitor(id: string, active: boolean): Promise<Competitor | null> {
  const db = getPool();
  const result = await db.query<Competitor>(
    `UPDATE competitors SET is_active = $2
     WHERE id = $1
     RETURNING id, property_id, name, google_hotels_url, is_active, created_at`,
    [id, active]
  );
  return result.rows[0] ?? null;
}

// ══════════════════════════════════════════════════════════════════════════════
// RATE SNAPSHOTS
// ══════════════════════════════════════════════════════════════════════════════

export async function insertRateSnapshot(data: RateSnapshotInput): Promise<RateSnapshot> {
  const db = getPool();
  const result = await db.query<RateSnapshot>(
    `INSERT INTO rate_snapshots
       (competitor_id, property_id, source, check_in_date, check_out_date, room_type, rate_amount, currency, is_available, refresh_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.competitor_id,
      data.property_id,
      data.source ?? 'google_hotels',
      data.check_in_date,
      data.check_out_date,
      data.room_type,
      data.rate_amount,
      data.currency,
      data.is_available,
      data.refresh_id,
    ]
  );
  return result.rows[0];
}

export async function getLatestRates(propertyId: string): Promise<RateSnapshot[]> {
  const db = getPool();
  const result = await db.query<RateSnapshot>(
    `SELECT DISTINCT ON (rs.competitor_id, rs.check_in_date, rs.room_type)
       rs.*
     FROM rate_snapshots rs
     WHERE rs.property_id = $1
     ORDER BY rs.competitor_id, rs.check_in_date, rs.room_type, rs.scraped_at DESC`,
    [propertyId]
  );
  return result.rows;
}

export async function getRateHistory(
  competitorId: string,
  checkInDate: string,
  days: number
): Promise<RateSnapshot[]> {
  const db = getPool();
  const result = await db.query<RateSnapshot>(
    `SELECT *
     FROM rate_snapshots
     WHERE competitor_id = $1
       AND check_in_date = $2
       AND scraped_at >= NOW() - ($3 || ' days')::INTERVAL
     ORDER BY scraped_at DESC`,
    [competitorId, checkInDate, days.toString()]
  );
  return result.rows;
}

export async function getRateGrid(propertyId: string): Promise<Record<string, unknown>[]> {
  const db = getPool();
  const result = await db.query(
    `SELECT
       c.id AS competitor_id,
       c.name AS competitor_name,
       rs.check_in_date,
       rs.room_type,
       rs.rate_amount,
       rs.currency,
       rs.is_available,
       rs.scraped_at
     FROM rate_snapshots rs
     JOIN competitors c ON c.id = rs.competitor_id
     WHERE rs.property_id = $1
       AND rs.scraped_at = (
         SELECT MAX(rs2.scraped_at)
         FROM rate_snapshots rs2
         WHERE rs2.competitor_id = rs.competitor_id
           AND rs2.check_in_date = rs.check_in_date
           AND rs2.room_type = rs.room_type
       )
     ORDER BY rs.check_in_date, c.name`,
    [propertyId]
  );
  return result.rows;
}

export async function getPreviousRate(
  competitorId: string,
  checkInDate: string,
  roomType: string | null,
  beforeSnapshotId: string
): Promise<RateSnapshot | null> {
  const db = getPool();
  const result = await db.query<RateSnapshot>(
    `SELECT *
     FROM rate_snapshots
     WHERE competitor_id = $1
       AND check_in_date = $2
       AND ($3::VARCHAR IS NULL OR room_type = $3)
       AND id != $4
     ORDER BY scraped_at DESC
     LIMIT 1`,
    [competitorId, checkInDate, roomType, beforeSnapshotId]
  );
  return result.rows[0] ?? null;
}

// ══════════════════════════════════════════════════════════════════════════════
// REFRESH LOGS
// ══════════════════════════════════════════════════════════════════════════════

export async function createRefreshLog(data: RefreshLogInput): Promise<RefreshLog> {
  const db = getPool();
  const result = await db.query<RefreshLog>(
    `INSERT INTO refresh_logs (property_id, trigger_type, status, total_competitors)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.property_id, data.trigger_type, data.status, data.total_competitors]
  );
  return result.rows[0];
}

export async function updateRefreshLog(id: string, data: RefreshLogUpdate): Promise<RefreshLog | null> {
  const db = getPool();
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (data.status !== undefined) {
    setClauses.push(`status = $${paramIdx++}`);
    params.push(data.status);
  }
  if (data.completed_at !== undefined) {
    setClauses.push(`completed_at = $${paramIdx++}`);
    params.push(data.completed_at);
  }
  if (data.successful_scrapes !== undefined) {
    setClauses.push(`successful_scrapes = $${paramIdx++}`);
    params.push(data.successful_scrapes);
  }
  if (data.failed_scrapes !== undefined) {
    setClauses.push(`failed_scrapes = $${paramIdx++}`);
    params.push(data.failed_scrapes);
  }
  if (data.error_log !== undefined) {
    setClauses.push(`error_log = $${paramIdx++}`);
    params.push(data.error_log);
  }

  if (setClauses.length === 0) return null;

  params.push(id);
  const result = await db.query<RefreshLog>(
    `UPDATE refresh_logs SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    params
  );
  return result.rows[0] ?? null;
}

export async function getRefreshStatus(id: string): Promise<RefreshLog | null> {
  const db = getPool();
  const result = await db.query<RefreshLog>(
    'SELECT * FROM refresh_logs WHERE id = $1',
    [id]
  );
  return result.rows[0] ?? null;
}

// ══════════════════════════════════════════════════════════════════════════════
// PARITY ALERTS
// ══════════════════════════════════════════════════════════════════════════════

export async function getParityAlerts(
  propertyId: string,
  status: string | null,
  pagination: PaginationParams
): Promise<PaginatedResult<ParityAlert>> {
  const db = getPool();
  const conditions = ['pa.property_id = $1'];
  const params: unknown[] = [propertyId];
  let paramIdx = 2;

  if (status) {
    conditions.push(`pa.alert_status = $${paramIdx++}`);
    params.push(status);
  }

  const whereClause = conditions.join(' AND ');

  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM parity_alerts pa WHERE ${whereClause}`,
    params
  );

  const dataParams = [...params, pagination.limit, pagination.offset];
  const result = await db.query<ParityAlert>(
    `SELECT pa.*, c.name AS competitor_name
     FROM parity_alerts pa
     LEFT JOIN competitors c ON c.id = pa.competitor_id
     WHERE ${whereClause}
     ORDER BY pa.detected_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
    dataParams
  );

  return {
    data: result.rows,
    total: parseInt(countResult.rows[0].count, 10),
    limit: pagination.limit,
    offset: pagination.offset,
  };
}

export async function acknowledgeAlert(id: string): Promise<ParityAlert | null> {
  const db = getPool();
  const result = await db.query<ParityAlert>(
    `UPDATE parity_alerts SET alert_status = 'acknowledged'
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function createParityAlert(data: ParityAlertInput): Promise<ParityAlert> {
  const db = getPool();
  const result = await db.query<ParityAlert>(
    `INSERT INTO parity_alerts
       (property_id, competitor_id, rate_snapshot_id, our_rate, competitor_rate, difference_amount, difference_pct, check_in_date, room_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      data.property_id,
      data.competitor_id,
      data.rate_snapshot_id,
      data.our_rate,
      data.competitor_rate,
      data.difference_amount,
      data.difference_pct,
      data.check_in_date,
      data.room_type,
    ]
  );
  return result.rows[0];
}

// ══════════════════════════════════════════════════════════════════════════════
// RATE CHANGE LOG
// ══════════════════════════════════════════════════════════════════════════════

export async function insertRateChange(data: RateChangeInput): Promise<RateChange> {
  const db = getPool();
  const result = await db.query<RateChange>(
    `INSERT INTO rate_change_log
       (competitor_id, property_id, check_in_date, room_type, old_rate, new_rate, change_amount, change_pct)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.competitor_id,
      data.property_id,
      data.check_in_date,
      data.room_type,
      data.old_rate,
      data.new_rate,
      data.change_amount,
      data.change_pct,
    ]
  );
  return result.rows[0];
}

export async function getRateChanges(
  propertyId: string,
  from: string,
  to: string,
  pagination: PaginationParams
): Promise<PaginatedResult<RateChange>> {
  const db = getPool();

  const countResult = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM rate_change_log
     WHERE property_id = $1
       AND detected_at >= $2::TIMESTAMPTZ
       AND detected_at <= $3::TIMESTAMPTZ`,
    [propertyId, from, to]
  );

  const result = await db.query<RateChange>(
    `SELECT rcl.*, c.name AS competitor_name
     FROM rate_change_log rcl
     LEFT JOIN competitors c ON c.id = rcl.competitor_id
     WHERE rcl.property_id = $1
       AND rcl.detected_at >= $2::TIMESTAMPTZ
       AND rcl.detected_at <= $3::TIMESTAMPTZ
     ORDER BY rcl.detected_at DESC
     LIMIT $4 OFFSET $5`,
    [propertyId, from, to, pagination.limit, pagination.offset]
  );

  return {
    data: result.rows,
    total: parseInt(countResult.rows[0].count, 10),
    limit: pagination.limit,
    offset: pagination.offset,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// CALENDAR QUERIES
// ══════════════════════════════════════════════════════════════════════════════

export interface CalendarDayData {
  check_in_date: string;
  competitor_id: string;
  competitor_name: string;
  room_type: string | null;
  rate_amount: number | null;
  currency: string;
  is_available: boolean;
}

export async function getCalendarData(
  propertyId: string,
  year: number,
  month: number
): Promise<CalendarDayData[]> {
  const db = getPool();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const result = await db.query<CalendarDayData>(
    `SELECT DISTINCT ON (rs.check_in_date, rs.competitor_id, rs.room_type)
       rs.check_in_date,
       rs.competitor_id,
       c.name AS competitor_name,
       rs.room_type,
       rs.rate_amount,
       rs.currency,
       rs.is_available
     FROM rate_snapshots rs
     JOIN competitors c ON c.id = rs.competitor_id
     WHERE rs.property_id = $1
       AND rs.check_in_date >= $2::DATE
       AND rs.check_in_date < $3::DATE
     ORDER BY rs.check_in_date, rs.competitor_id, rs.room_type, rs.scraped_at DESC`,
    [propertyId, startDate, endDate]
  );
  return result.rows;
}

export interface CheapestSummary {
  competitor_id: string;
  competitor_name: string;
  cheapest_count: number;
  avg_rate: number;
  min_rate: number;
  max_rate: number;
}

export async function getCheapestSummary(
  propertyId: string,
  year: number,
  month: number
): Promise<CheapestSummary[]> {
  const db = getPool();
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const result = await db.query<CheapestSummary>(
    `WITH latest_rates AS (
       SELECT DISTINCT ON (rs.check_in_date, rs.competitor_id)
         rs.check_in_date,
         rs.competitor_id,
         c.name AS competitor_name,
         rs.rate_amount
       FROM rate_snapshots rs
       JOIN competitors c ON c.id = rs.competitor_id
       WHERE rs.property_id = $1
         AND rs.check_in_date >= $2::DATE
         AND rs.check_in_date < $3::DATE
         AND rs.rate_amount IS NOT NULL
         AND rs.is_available = true
       ORDER BY rs.check_in_date, rs.competitor_id, rs.scraped_at DESC
     ),
     cheapest_per_day AS (
       SELECT DISTINCT ON (check_in_date)
         check_in_date,
         competitor_id,
         competitor_name,
         rate_amount
       FROM latest_rates
       ORDER BY check_in_date, rate_amount ASC
     )
     SELECT
       competitor_id,
       competitor_name,
       COUNT(*)::INT AS cheapest_count,
       ROUND(AVG(rate_amount), 2)::NUMERIC AS avg_rate,
       MIN(rate_amount)::NUMERIC AS min_rate,
       MAX(rate_amount)::NUMERIC AS max_rate
     FROM cheapest_per_day
     GROUP BY competitor_id, competitor_name
     ORDER BY cheapest_count DESC`,
    [propertyId, startDate, endDate]
  );
  return result.rows;
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

export interface DashboardSummary {
  total_competitors: number;
  active_competitors: number;
  total_snapshots_today: number;
  new_parity_alerts: number;
  last_refresh: RefreshLog | null;
  rate_changes_24h: number;
  avg_competitor_rate: number | null;
  min_competitor_rate: number | null;
  max_competitor_rate: number | null;
}

export async function getDashboardSummary(propertyId: string): Promise<DashboardSummary> {
  const db = getPool();

  const [
    competitorCounts,
    snapshotCount,
    alertCount,
    lastRefresh,
    rateChangeCount,
    rateStats,
  ] = await Promise.all([
    db.query<{ total: string; active: string }>(
      `SELECT
         COUNT(*)::TEXT AS total,
         COUNT(*) FILTER (WHERE is_active = true)::TEXT AS active
       FROM competitors
       WHERE property_id = $1`,
      [propertyId]
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count
       FROM rate_snapshots
       WHERE property_id = $1
         AND scraped_at >= CURRENT_DATE`,
      [propertyId]
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count
       FROM parity_alerts
       WHERE property_id = $1
         AND alert_status = 'new'`,
      [propertyId]
    ),
    db.query<RefreshLog>(
      `SELECT *
       FROM refresh_logs
       WHERE property_id = $1
       ORDER BY started_at DESC
       LIMIT 1`,
      [propertyId]
    ),
    db.query<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count
       FROM rate_change_log
       WHERE property_id = $1
         AND detected_at >= NOW() - INTERVAL '24 hours'`,
      [propertyId]
    ),
    db.query<{ avg_rate: string | null; min_rate: string | null; max_rate: string | null }>(
      `SELECT
         ROUND(AVG(rs.rate_amount), 2)::TEXT AS avg_rate,
         MIN(rs.rate_amount)::TEXT AS min_rate,
         MAX(rs.rate_amount)::TEXT AS max_rate
       FROM rate_snapshots rs
       WHERE rs.property_id = $1
         AND rs.scraped_at >= CURRENT_DATE
         AND rs.rate_amount IS NOT NULL
         AND rs.is_available = true`,
      [propertyId]
    ),
  ]);

  return {
    total_competitors: parseInt(competitorCounts.rows[0].total, 10),
    active_competitors: parseInt(competitorCounts.rows[0].active, 10),
    total_snapshots_today: parseInt(snapshotCount.rows[0].count, 10),
    new_parity_alerts: parseInt(alertCount.rows[0].count, 10),
    last_refresh: lastRefresh.rows[0] ?? null,
    rate_changes_24h: parseInt(rateChangeCount.rows[0].count, 10),
    avg_competitor_rate: rateStats.rows[0].avg_rate ? parseFloat(rateStats.rows[0].avg_rate) : null,
    min_competitor_rate: rateStats.rows[0].min_rate ? parseFloat(rateStats.rows[0].min_rate) : null,
    max_competitor_rate: rateStats.rows[0].max_rate ? parseFloat(rateStats.rows[0].max_rate) : null,
  };
}
