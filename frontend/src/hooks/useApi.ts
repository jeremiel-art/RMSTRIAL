import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Property,
  Competitor,
  RateGridRow,
  RateSnapshot,
  ParityAlert,
  RateChange,
  CalendarDay,
  CheapestSummary,
  DashboardSummary,
  RefreshLog,
} from '../types';

const API_BASE = '/api';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

// ---- Properties ----

export function useProperties() {
  return useQuery<Property[]>({
    queryKey: ['properties'],
    queryFn: () => apiFetch('/properties'),
  });
}

// ---- Dashboard Summary ----

export function useDashboardSummary(propertyId: string | undefined) {
  return useQuery<DashboardSummary>({
    queryKey: ['dashboard-summary', propertyId],
    queryFn: () => apiFetch(`/dashboard/summary?property_id=${propertyId}`),
    enabled: !!propertyId,
  });
}

// ---- Rate Grid ----

export function useRatesGrid(propertyId: string | undefined) {
  return useQuery<RateGridRow[]>({
    queryKey: ['rates-grid', propertyId],
    queryFn: () => apiFetch(`/rates/grid?property_id=${propertyId}`),
    enabled: !!propertyId,
  });
}

// ---- Rate History ----

export function useRateHistory(
  competitorId: string | undefined,
  checkIn: string | undefined,
  days: number = 30
) {
  return useQuery<RateSnapshot[]>({
    queryKey: ['rate-history', competitorId, checkIn, days],
    queryFn: () =>
      apiFetch(
        `/rates/history?competitor_id=${competitorId}&check_in=${checkIn ?? ''}&days=${days}`
      ),
    enabled: !!competitorId,
  });
}

export function useRateHistoryAll(propertyId: string | undefined, from: string, to: string) {
  return useQuery<{
    ourRates: { date: string; rate: number }[];
    competitors: { competitorId: string; competitorName: string; source: string; rates: { date: string; rate: number }[] }[];
  }>({
    queryKey: ['rate-history-all', propertyId, from, to],
    queryFn: () => apiFetch(`/rates/history?property_id=${propertyId}&from=${from}&to=${to}`),
    enabled: !!propertyId,
  });
}

// ---- Parity Alerts ----

export function useParityAlerts(propertyId: string | undefined, status?: string) {
  return useQuery<ParityAlert[]>({
    queryKey: ['parity-alerts', propertyId, status],
    queryFn: () => {
      const params = new URLSearchParams({ property_id: propertyId! });
      if (status) params.set('status', status);
      return apiFetch(`/parity?${params.toString()}`);
    },
    enabled: !!propertyId,
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) =>
      apiFetch(`/parity/${alertId}/acknowledge`, { method: 'PATCH' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parity-alerts'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

// ---- Competitors ----

export function useCompetitors(propertyId: string | undefined) {
  return useQuery<Competitor[]>({
    queryKey: ['competitors', propertyId],
    queryFn: async () => {
      const res = await apiFetch<{ data: Competitor[] }>(`/competitors?property_id=${propertyId}`);
      return res.data;
    },
    enabled: !!propertyId,
  });
}

export function useAddCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { property_id: string; name: string; google_hotels_url: string }) =>
      apiFetch('/competitors', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competitors'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

export function useDeleteCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (competitorId: string) =>
      apiFetch(`/competitors/${competitorId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competitors'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });
}

export function useToggleCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ competitorId, enabled }: { competitorId: string; enabled: boolean }) =>
      apiFetch(`/competitors/${competitorId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: enabled }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competitors'] });
    },
  });
}

// ---- Rate Changes ----

export function useRateChanges(propertyId: string | undefined, from?: string, to?: string) {
  return useQuery<RateChange[]>({
    queryKey: ['rate-changes', propertyId, from, to],
    queryFn: () => {
      const params = new URLSearchParams({ property_id: propertyId! });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      return apiFetch(`/history/rate-changes?${params.toString()}`);
    },
    enabled: !!propertyId,
  });
}

// ---- Calendar ----

export function useCalendar(propertyId: string | undefined, month: string) {
  return useQuery<CalendarDay[]>({
    queryKey: ['calendar', propertyId, month],
    queryFn: () => apiFetch(`/calendar?property_id=${propertyId}&month=${month}`),
    enabled: !!propertyId,
  });
}

export function useCheapestSummary(propertyId: string | undefined, month: string) {
  return useQuery<CheapestSummary[]>({
    queryKey: ['cheapest-summary', propertyId, month],
    queryFn: () => apiFetch(`/calendar/cheapest-summary?property_id=${propertyId}&month=${month}`),
    enabled: !!propertyId,
  });
}

// ---- Refresh ----

export function useRefresh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (propertyId: string) => {
      const res = await apiFetch<{ message: string; refresh_id?: string; property_id?: string }>('/refresh', {
        method: 'POST',
        body: JSON.stringify({ property_id: propertyId }),
      });
      return res;
    },
    onSuccess: () => {
      // Invalidate all data queries after refresh starts
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
        qc.invalidateQueries({ queryKey: ['rates-grid'] });
        qc.invalidateQueries({ queryKey: ['rate-history'] });
        qc.invalidateQueries({ queryKey: ['parity-alerts'] });
        qc.invalidateQueries({ queryKey: ['rate-changes'] });
        qc.invalidateQueries({ queryKey: ['calendar'] });
      }, 2000);
    },
  });
}

export function useRefreshStatus(refreshId: string | undefined) {
  return useQuery<RefreshLog>({
    queryKey: ['refresh-status', refreshId],
    queryFn: () => apiFetch(`/refresh/${refreshId}/status`),
    enabled: !!refreshId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === 'completed' || data.status === 'failed')) return false;
      return 3000;
    },
  });
}

// ---- Hotel Search ----

export interface HotelSearchResult {
  property_token: string;
  name: string;
  address: string;
  overall_rating: number | null;
  stars: number | null;
  thumbnail: string | null;
  rate_per_night: number | null;
  currency: string;
  reviews: number | null;
  amenities: string[];
}

export function useSearchHotels(query: string, checkIn?: string, checkOut?: string) {
  const params = new URLSearchParams({ q: query });
  if (checkIn) params.set('check_in', checkIn);
  if (checkOut) params.set('check_out', checkOut);
  return useQuery<{ data: HotelSearchResult[] }>({
    queryKey: ['search-hotels', query, checkIn, checkOut],
    queryFn: () => apiFetch(`/search/hotels?${params.toString()}`),
    enabled: query.length >= 3,
  });
}

// ---- Create Property ----

export function useCreateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; address?: string; google_hotels_url?: string }) =>
      apiFetch<{ data: Property }>('/properties', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}

// ---- Settings / Property Update ----

export function useUpdateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, data }: { propertyId: string; data: Record<string, unknown> }) =>
      apiFetch(`/properties/${propertyId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}
