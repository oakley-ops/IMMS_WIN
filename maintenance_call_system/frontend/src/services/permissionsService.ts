import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api/v1';

const api = axios.create({ baseURL: `${API}/mcs/permissions` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mcs_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface UserPermissions {
  badges_add: boolean;
  readers_manage: boolean;
  calls_manage: boolean;
  analytics_view: boolean;
  skilled_operator: boolean;
}

export interface UserWithPermissions {
  user_id: number;
  username: string;
  role: string;
  permissions: UserPermissions;
  updated_at: string | null;
  updated_by_username: string | null;
}

const svc = {
  getUsers: (): Promise<UserWithPermissions[]> =>
    api.get<UserWithPermissions[]>('/').then((r) => r.data),

  getUserPermissions: (userId: number): Promise<UserWithPermissions> =>
    api.get<UserWithPermissions>(`/${userId}`).then((r) => r.data),

  savePermissions: (userId: number, permissions: Partial<UserPermissions>): Promise<UserWithPermissions> =>
    api.put<UserWithPermissions>(`/${userId}`, permissions).then((r) => r.data),
};

export default svc;
