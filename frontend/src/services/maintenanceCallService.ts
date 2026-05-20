import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1';

const api = axios.create({ baseURL: `${API}/maintenance-calls` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export type ReasonCategory =
  | 'mechanical'
  | 'electrical'
  | 'tooling'
  | 'material'
  | 'operator_error'
  | 'other';

export interface MaintenanceCall {
  call_id: number;
  machine_id: number;
  machine_name: string;
  machine_location: string;
  machine_cost_per_hour: number | null;
  reader_id: number;
  operator_badge_id: string;
  operator_name: string;
  status: 'open' | 'in_progress' | 'resolved';
  priority: 'normal' | 'critical';
  shift_name: string | null;
  called_at: string;
  acknowledged_at: string | null;
  technician_arrived_at: string | null;
  escalated_at: string | null;
  escalated_to: string | null;
  resolved_at: string | null;
  technician_badge_id: string | null;
  technician_id: number | null;
  technician_name: string | null;
  reason_category: ReasonCategory | null;
  root_cause: string | null;
  reopened_from_call_id: number | null;
  problem_description: string | null;
  resolution_notes: string | null;
  response_minutes: number | null;
  travel_minutes: number | null;
  repair_minutes: number | null;
  downtime_minutes: number | null;
  sla_met: boolean | null;
  downtime_cost: number | null;
  seconds_since_called?: number;
}

export interface BadgeRegistration {
  badge_id: string;
  person_name: string;
  role: 'operator' | 'technician';
  technician_id: number | null;
  technician_name?: string;
  active: boolean;
  created_at: string;
}

export interface BadgeReader {
  reader_id: number;
  reader_key: string;
  machine_id: number;
  machine_name: string;
  location_label: string;
  active: boolean;
  created_at: string;
}

export interface BadgeSwipeResult {
  action: 'call_created' | 'call_acknowledged' | 'already_active' | 'already_in_progress' | 'no_active_call' | 'unknown_badge';
  call?: MaintenanceCall;
  machine_name: string | null;
}

export interface CallMetrics {
  overall: {
    total_calls: number;
    open_calls: number;
    avg_response_minutes: number | null;
    avg_repair_minutes: number | null;
    avg_downtime_minutes: number | null;
    total_downtime_hours: number | null;
    total_downtime_cost: number | null;
    sla_pct: number | null;
  };
  by_machine: {
    machine_id: number;
    machine_name: string;
    call_count: number;
    avg_downtime_minutes: number | null;
    total_downtime_hours: number | null;
    total_downtime_cost: number | null;
  }[];
  by_reason: {
    reason_category: ReasonCategory | null;
    count: number;
    avg_downtime_minutes: number | null;
  }[];
  by_shift: {
    shift_name: string | null;
    call_count: number;
    avg_response_minutes: number | null;
    avg_downtime_minutes: number | null;
  }[];
  by_tech: {
    technician_id: number | null;
    technician_name: string | null;
    call_count: number;
    avg_response_minutes: number | null;
    avg_repair_minutes: number | null;
    sla_pct: number | null;
  }[];
  trend_weekly: {
    week_start: string;
    call_count: number;
    avg_mtta_minutes: number | null;
    avg_mttr_minutes: number | null;
    avg_downtime_minutes: number | null;
  }[];
  repeat_failures: {
    machine_id: number;
    machine_name: string;
    reason_category: ReasonCategory | null;
    occurrences: number;
  }[];
}

export interface MetricsFilters {
  from?: string;
  to?: string;
  machine_id?: number;
  shift?: string;
  reason?: ReasonCategory;
}

export interface CallFilters {
  status?: string;
  machine_id?: number;
  from?: string;
  to?: string;
  shift?: string;
  reason?: ReasonCategory;
  limit?: number;
  offset?: number;
}

const maintenanceCallService = {
  badgeSwipe: async (badge_id: string, reader_key: string): Promise<BadgeSwipeResult> => {
    const { data } = await api.post('/badge-swipe', { badge_id, reader_key });
    return data;
  },

  getActiveCalls: async (): Promise<MaintenanceCall[]> => {
    const { data } = await api.get('/active');
    return data;
  },

  getReaderInfo: async (reader_key: string): Promise<BadgeReader> => {
    const { data } = await api.get(`/reader/${reader_key}`);
    return data;
  },

  getCalls: async (filters?: CallFilters): Promise<MaintenanceCall[]> => {
    const { data } = await api.get('/', { params: filters });
    return data;
  },

  getCall: async (id: number): Promise<MaintenanceCall> => {
    const { data } = await api.get(`/${id}`);
    return data;
  },

  resolveCall: async (id: number, payload: { reason_category?: string; resolution_notes: string; problem_description?: string }): Promise<MaintenanceCall> => {
    const { data } = await api.put(`/${id}/resolve`, payload);
    return data;
  },

  getMetrics: async (filters?: MetricsFilters): Promise<CallMetrics> => {
    const { data } = await api.get('/stats/metrics', { params: filters });
    return data;
  },

  getBadges: async (): Promise<BadgeRegistration[]> => {
    const { data } = await api.get('/admin/badges');
    return data;
  },

  registerBadge: async (payload: { badge_id: string; person_name: string; role: 'operator' | 'technician'; technician_id?: number }): Promise<BadgeRegistration> => {
    const { data } = await api.post('/admin/badges', payload);
    return data;
  },

  updateBadge: async (badge_id: string, payload: Partial<BadgeRegistration>): Promise<BadgeRegistration> => {
    const { data } = await api.put(`/admin/badges/${badge_id}`, payload);
    return data;
  },

  getReaders: async (): Promise<BadgeReader[]> => {
    const { data } = await api.get('/admin/readers');
    return data;
  },

  registerReader: async (payload: { reader_key: string; machine_id: number; location_label?: string }): Promise<BadgeReader> => {
    const { data } = await api.post('/admin/readers', payload);
    return data;
  },

  updateReader: async (reader_id: number, payload: Partial<BadgeReader>): Promise<BadgeReader> => {
    const { data } = await api.put(`/admin/readers/${reader_id}`, payload);
    return data;
  },
};

export default maintenanceCallService;
