export interface Property {
  id: string;
  name: string;
  address: string | null;
  google_hotels_url: string | null;
  created_at: string;
}

export interface Competitor {
  id: string;
  property_id: string;
  name: string;
  google_hotels_url: string;
  is_active: boolean;
  created_at: string;
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
  scraped_at: string;
  refresh_id: string | null;
}

export interface RefreshLog {
  id: string;
  property_id: string;
  trigger_type: string;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at: string | null;
  total_competitors: number;
  successful_scrapes: number;
  failed_scrapes: number;
  error_log: string | null;
}

export interface ParityAlert {
  id: string;
  property_id: string;
  competitor_id: string;
  competitor_name?: string;
  rate_snapshot_id: string | null;
  our_rate: number;
  competitor_rate: number;
  difference_amount: number;
  difference_pct: number;
  check_in_date: string;
  room_type: string | null;
  alert_status: 'new' | 'acknowledged';
  detected_at: string;
}

export interface RateChange {
  id: string;
  competitor_id: string;
  competitor_name?: string;
  property_id: string;
  check_in_date: string;
  room_type: string | null;
  old_rate: number;
  new_rate: number;
  change_amount: number;
  change_pct: number;
  detected_at: string;
}

export interface CalendarDay {
  date: string;
  ourRate: number | null;
  channels: CalendarChannel[];
  parityStatus: 'ok' | 'warning' | 'violation' | 'no-data';
}

export interface CalendarChannel {
  competitorId: string;
  competitorName: string;
  source: string;
  rate: number;
  differencePercent: number;
}

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

export interface CheapestSummary {
  competitor_id: string;
  competitor_name: string;
  cheapest_count: number;
  avg_rate: number;
  min_rate: number;
  max_rate: number;
}

export interface RateGridRow {
  competitor_id: string;
  competitor_name: string;
  check_in_date: string;
  room_type: string | null;
  rate_amount: number | null;
  currency: string;
  is_available: boolean;
  scraped_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
