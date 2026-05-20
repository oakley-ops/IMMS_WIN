import axios from 'axios';
import {
  CallBoardLayout, CallBoardLayoutSummary, CallBoardTile, LayoutOrientation,
} from './maintenanceCallService';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api/v1';

const api = axios.create({ baseURL: `${API}/call-board-layouts` });

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mcs_token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const layoutsService = {
  list: () =>
    api.get<CallBoardLayoutSummary[]>('/').then(r => r.data),

  getDefault: () =>
    api.get<CallBoardLayout | null>('/default/current').then(r => r.data),

  get: (id: number) =>
    api.get<CallBoardLayout>(`/${id}`).then(r => r.data),

  create: (body: {
    name: string;
    orientation?: LayoutOrientation;
    grid_cols?: number;
    grid_rows?: number;
    is_default?: boolean;
  }) =>
    api.post<CallBoardLayout>('/', body).then(r => r.data),

  update: (
    id: number,
    body: Partial<Pick<CallBoardLayout, 'name' | 'orientation' | 'grid_cols' | 'grid_rows' | 'is_default'>>
  ) =>
    api.put<CallBoardLayoutSummary>(`/${id}`, body).then(r => r.data),

  remove: (id: number) =>
    api.delete<{ deleted: number }>(`/${id}`).then(r => r.data),

  saveTiles: (
    id: number,
    tiles: Omit<CallBoardTile, 'tile_id' | 'machine_name'>[]
  ) =>
    api.put<{ layout_id: number; tiles: CallBoardTile[] }>(`/${id}/tiles`, { tiles }).then(r => r.data),
};

export default layoutsService;
