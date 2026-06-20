import axiosInstance from '../utils/axios';

// Reuses the configured axios instance (JWT request interceptor + 401 handling).
// Calls the bounded hybrid-search module: FTS + vector, RRF + cross-encoder rerank.

export interface SearchHit {
  part_id: number;
  name: string;
  description?: string;
  manufacturer_part_number?: string;
  barcode?: string;
  quantity?: number;
  location?: string;
  citation: { type: string; id: number; href: string };
}

export interface SearchResponse {
  results: SearchHit[];
  degraded: string[] | null; // e.g. ['vector'] or ['rerank']; null when fully healthy
  queryTimeMs: number;
}

export async function searchParts(q: string, limit = 10): Promise<SearchResponse> {
  const { data } = await axiosInstance.get('/api/v1/search', { params: { q, limit } });
  return data;
}
