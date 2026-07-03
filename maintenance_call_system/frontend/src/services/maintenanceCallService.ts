import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api/v1';

const IMMS_LOGIN_URL =
  process.env.NEXT_PUBLIC_IMMS_LOGIN_URL || 'http://localhost:3000/login';

const api = axios.create({ baseURL: `${API}/maintenance-calls` });

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('mcs_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('mcs_token');
      localStorage.removeItem('mcs_user');
      const returnTo = encodeURIComponent(window.location.href);
      window.location.href = `${IMMS_LOGIN_URL}?returnTo=${returnTo}`;
    }
    return Promise.reject(err);
  }
);

export type BoardStatus = 'running' | 'wait' | 'te_present' | 'suspend' | 'pm';

export type LayoutOrientation = 'landscape' | 'portrait';

export interface CallBoardTile {
  tile_id?: number;
  machine_id: number;
  machine_name?: string;
  col_start: number;
  row_start: number;
  col_span: number;
  row_span: number;
}

export interface CallBoardLayoutSummary {
  layout_id: number;
  name: string;
  orientation: LayoutOrientation;
  grid_cols: number;
  grid_rows: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CallBoardLayout extends CallBoardLayoutSummary {
  tiles: CallBoardTile[];
}

export interface BoardStatusEntry {
  machine_id: number;
  name: string;
  location: string | null;
  status: BoardStatus;
  call_id: number | null;
  called_at: string | null;
  operator_name: string | null;
  technician_name: string | null;
  technician_arrived_at: string | null;
  suspended_at: string | null;
  suspension_notes: string | null;
  priority: 'normal' | 'critical' | null;
  shift_name: string | null;
  pm_id: number | null;
  pm_started_at: string | null;
  queue_position: number | null;
}

export interface MaintenanceCall {
  call_id: number;
  machine_id: number;
  machine_name: string;
  machine_location: string;
  operator_badge_id: string;
  operator_name: string;
  status: 'open' | 'in_progress' | 'suspended' | 'resolved';
  priority: 'normal' | 'critical';
  shift_name: string;
  called_at: string;
  technician_arrived_at: string | null;
  resolved_at: string | null;
  technician_name: string | null;
  reason_category: string | null;
  problem_description: string | null;
  resolution_notes: string | null;
  suspension_notes: string | null;
  response_seconds: number | null;
  repair_seconds: number | null;
  downtime_seconds: number | null;
  seconds_since_called?: number;
}

export interface BadgeRegistration {
  badge_id: string;
  person_name: string;
  role: 'operator' | 'technician';
  technician_id: number | null;
  technician_name?: string;
  active: boolean;
}

export interface PartResult {
  part_id: number;
  name: string;
  fiserv_part_number: string | null;
  manufacturer_part_number: string | null;
  quantity: number;
}

export interface InventoryDecrementResult {
  part_id: number;
  decremented: boolean;
  error?: string;
}

export interface LogPartsResult {
  parts: { call_id: number; part_id: number; part_name: string; part_number: string | null; quantity: number }[];
  inventory: InventoryDecrementResult[];
}

export interface BadgeReader {
  reader_id: number;
  reader_key: string;
  machine_id: number;
  machine_name: string;
  location_label: string;
  active: boolean;
}

export interface BadgeSwipeResult {
  action: 'call_created' | 'call_acknowledged' | 'already_active' | 'already_in_progress' | 'no_active_call' | 'unknown_badge';
  call?: MaintenanceCall;
  machine_name: string | null;
}

export type ReasonCategory =
  | 'mechanical'
  | 'electrical'
  | 'tooling'
  | 'material'
  | 'operator_error'
  | 'other';

export interface CallMetrics {
  overall: {
    total_calls: string;
    open_calls: number;
    avg_response_minutes: string | null;
    avg_repair_minutes: string | null;
    avg_downtime_minutes: string | null;
    total_downtime_hours: string | null;
    total_downtime_cost: string | null;
    sla_pct: string | null;
    critical_calls: string | null;
  };
  by_machine: {
    machine_id: number;
    machine_name: string;
    call_count: string;
    avg_downtime_minutes: string | null;
    total_downtime_hours: string | null;
    total_downtime_cost: string | null;
  }[];
  by_reason: {
    reason_category: string;
    count: string;
    avg_downtime_minutes: string | null;
  }[];
  by_shift: {
    shift_name: string;
    call_count: string;
    avg_response_minutes: string | null;
    avg_downtime_minutes: string | null;
  }[];
  by_tech: {
    technician_id: number | null;
    technician_name: string | null;
    call_count: string;
    avg_response_minutes: string | null;
    avg_repair_minutes: string | null;
    sla_pct: string | null;
    suspensions: string | null;
  }[];
  trend_weekly: {
    week_start: string;
    call_count: string;
    avg_mtta_minutes: string | null;
    avg_mttr_minutes: string | null;
    avg_downtime_minutes: string | null;
  }[];
  repeat_failures: {
    machine_id: number;
    machine_name: string;
    reason_category: string | null;
    occurrences: string;
    suspensions: string | null;
  }[];
}

export interface MetricsFilters {
  from?: string;
  to?: string;
  shift_name?: string;
  machine_id?: number | string;
  reason?: ReasonCategory;
}

export interface PartsMetrics {
  top_parts: {
    part_id: number;
    part_name: string;
    part_number: string | null;
    total_qty: number;
    call_count: number;
  }[];
  by_machine: {
    machine_id: number;
    machine_name: string;
    unique_parts: number;
    total_qty: number;
  }[];
  by_tech: {
    technician_id: number | null;
    technician_name: string | null;
    calls_with_parts: number;
    unique_parts: number;
    total_qty: number;
  }[];
}

const svc = {
  badgeSwipe: (badge_id: string, reader_key: string) =>
    api.post<BadgeSwipeResult>('/badge-swipe', { badge_id, reader_key }).then(r => r.data),

  getActiveCalls: () =>
    api.get<MaintenanceCall[]>('/active').then(r => r.data),

  getBoardStatus: () =>
    api.get<BoardStatusEntry[]>('/board-status').then(r => r.data),

  resumeCall: (id: number) =>
    api.put<MaintenanceCall>(`/${id}/resume`).then(r => r.data),

  getReaderInfo: (reader_key: string) =>
    api.get<BadgeReader>(`/reader/${reader_key}`).then(r => r.data),

  getCalls: (params?: object) =>
    api.get<MaintenanceCall[]>('/', { params }).then(r => r.data),

  resolveCall: (id: number, body: { reason_category?: string; resolution_notes: string; problem_description?: string }) =>
    api.put<MaintenanceCall>(`/${id}/resolve`, body).then(r => r.data),

  suspendCall: (id: number, suspension_notes?: string) =>
    api.put<MaintenanceCall>(`/${id}/suspend`, { suspension_notes }).then(r => r.data),

  searchParts: (q: string) =>
    api.get<PartResult[]>('/parts/search', { params: { q } }).then(r => r.data),

  logParts: (id: number, parts: { part_id: number; part_name: string; part_number: string; quantity: number }[]) =>
    api.post<LogPartsResult>(`/${id}/parts`, { parts }).then(r => r.data),

  getMetrics: (params?: MetricsFilters) =>
    api.get<CallMetrics>('/stats/metrics', { params }).then(r => r.data),

  getPartsMetrics: (params?: MetricsFilters) =>
    api.get<PartsMetrics>('/stats/parts-metrics', { params }).then(r => r.data),

  getBadges: () =>
    api.get<BadgeRegistration[]>('/admin/badges').then(r => r.data),

  registerBadge: (body: { badge_id: string; person_name: string; role: 'operator' | 'technician'; technician_id?: number }) =>
    api.post<BadgeRegistration>('/admin/badges', body).then(r => r.data),

  updateBadge: (badge_id: string, body: object) =>
    api.put<BadgeRegistration>(`/admin/badges/${badge_id}`, body).then(r => r.data),

  getReaders: () =>
    api.get<BadgeReader[]>('/admin/readers').then(r => r.data),

  registerReader: (body: { reader_key: string; machine_id: number; location_label?: string }) =>
    api.post<BadgeReader>('/admin/readers', body).then(r => r.data),

  updateReader: (reader_id: number, body: object) =>
    api.put<BadgeReader>(`/admin/readers/${reader_id}`, body).then(r => r.data),

  getMachines: () =>
    api.get<{ machine_id: number; name: string; location: string }[]>('/machines/list').then(r => r.data),

  exportAnalyticsPdf: async (filters: MetricsFilters): Promise<Blob> => {
    const params: Record<string, string> = {};
    if (filters.from)       params.from       = filters.from;
    if (filters.to)         params.to         = filters.to;
    if (filters.shift_name) params.shift_name = filters.shift_name;
    if (filters.machine_id) params.machine_id = String(filters.machine_id);
    if (filters.reason)     params.reason     = filters.reason;
    const token = typeof window !== 'undefined' ? localStorage.getItem('mcs_token') : null;
    const response = await axios.get(`${API}/mcs/analytics/pdf`, {
      params,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      responseType: 'blob',
    });
    // Explicitly set MIME type — Axios doesn't always preserve Content-Type on blobs.
    return new Blob([response.data], { type: 'application/pdf' });
  },
};

export default svc;
