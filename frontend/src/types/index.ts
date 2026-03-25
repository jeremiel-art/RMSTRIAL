export interface Property {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  parityThreshold: number;
  lookAheadDays: number;
  refreshCron: string;
  createdAt: string;
  updatedAt: string;
}

export interface Competitor {
  id: string;
  propertyId: string;
  name: string;
  source: string;
  url: string;
  enabled: boolean;
  createdAt: string;
}

export interface RateSnapshot {
  id: string;
  competitorId: string;
  competitorName: string;
  source: string;
  checkIn: string;
  checkOut: string;
  roomType: string;
  rate: number;
  currency: string;
  fetchedAt: string;
}

export interface RefreshLog {
  id: string;
  propertyId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;
  ratesCollected: number;
  errors: number;
}

export interface ParityAlert {
  id: string;
  propertyId: string;
  competitorId: string;
  competitorName: string;
  source: string;
  checkIn: string;
  roomType: string;
  ourRate: number;
  theirRate: number;
  differencePercent: number;
  status: 'new' | 'acknowledged';
  detectedAt: string;
  acknowledgedAt: string | null;
}

export interface RateChange {
  id: string;
  competitorId: string;
  competitorName: string;
  source: string;
  checkIn: string;
  roomType: string;
  oldRate: number;
  newRate: number;
  changePercent: number;
  detectedAt: string;
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
  parityScore: number;
  ratePosition: number;
  totalPositions: number;
  activeAlerts: number;
  competitorCount: number;
  lastRefresh: string | null;
  nextRefresh: string | null;
}

export interface CheapestSummary {
  daysWithParity: number;
  totalDays: number;
  mostFrequentCheapest: string;
  avgUndercutAmount: number;
  ourAvgRate: number;
}

export interface RateGridRow {
  competitorId: string;
  competitorName: string;
  source: string;
  rates: Record<string, {
    rate: number;
    previousRate: number | null;
    change: number | null;
    changePercent: number | null;
  } | null>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
