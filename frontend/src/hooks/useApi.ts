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
    queryFn: () => apiFetch(`/properties/${propertyId}/dashboard`),
    enabled: !!propertyId,
  });
}

// ---- Rate Grid ----

export function useRatesGrid(propertyId: string | undefined) {
  return useQuery<{ ourRates: Record<string, number | null>; competitors: RateGridRow[]; dates: string[] }>({
    queryKey: ['rates-grid', propertyId],
    queryFn: () => apiFetch(`/properties/${propertyId}/rates/grid`),
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
        `/competitors/${competitorId}/history?checkIn=${checkIn ?? ''}&days=${days}`
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
    queryFn: () => apiFetch(`/properties/${propertyId}/rates/history?from=${from}&to=${to}`),
    enabled: !!propertyId,
  });
}

// ---- Parity Alerts ----

export function useParityAlerts(propertyId: string | undefined, status?: string) {
  return useQuery<ParityAlert[]>({
    queryKey: ['parity-alerts', propertyId, status],
    queryFn: () =>
      apiFetch(
        `/properties/${propertyId}/alerts${status ? `?status=${status}` : ''}`
      ),
    enabled: !!propertyId,
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) =>
      apiFetch(`/alerts/${alertId}/acknowledge`, { method: 'PATCH' }),
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
    queryFn: () => apiFetch(`/properties/${propertyId}/competitors`),
    enabled: !!propertyId,
  });
}

export function useAddCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { propertyId: string; name: string; source: string; url: string }) =>
      apiFetch(`/properties/${data.propertyId}/competitors`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competitors'] });
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
    },
  });
}

export function useToggleCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ competitorId, enabled }: { competitorId: string; enabled: boolean }) =>
      apiFetch(`/competitors/${competitorId}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competitors'] });
    },
  });
}

// ---- Rate Changes ----

export function useRateChanges(propertyId: string | undefined, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return useQuery<RateChange[]>({
    queryKey: ['rate-changes', propertyId, from, to],
    queryFn: () => apiFetch(`/properties/${propertyId}/rate-changes${qs ? `?${qs}` : ''}`),
    enabled: !!propertyId,
  });
}

// ---- Calendar ----

export function useCalendar(propertyId: string | undefined, month: string) {
  return useQuery<CalendarDay[]>({
    queryKey: ['calendar', propertyId, month],
    queryFn: () => apiFetch(`/properties/${propertyId}/calendar?month=${month}`),
    enabled: !!propertyId,
  });
}

export function useCheapestSummary(propertyId: string | undefined, month: string) {
  return useQuery<CheapestSummary>({
    queryKey: ['cheapest-summary', propertyId, month],
    queryFn: () => apiFetch(`/properties/${propertyId}/calendar/summary?month=${month}`),
    enabled: !!propertyId,
  });
}

// ---- Refresh ----

export function useRefresh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (propertyId: string) =>
      apiFetch<RefreshLog>(`/properties/${propertyId}/refresh`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      qc.invalidateQueries({ queryKey: ['rates-grid'] });
    },
  });
}

export function useRefreshStatus(refreshId: string | undefined) {
  return useQuery<RefreshLog>({
    queryKey: ['refresh-status', refreshId],
    queryFn: () => apiFetch(`/refresh/${refreshId}`),
    enabled: !!refreshId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === 'completed' || data.status === 'failed')) return false;
      return 3000;
    },
  });
}

// ---- Settings / Property Update ----

export function useUpdateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ propertyId, data }: { propertyId: string; data: Partial<Property> }) =>
      apiFetch(`/properties/${propertyId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}
