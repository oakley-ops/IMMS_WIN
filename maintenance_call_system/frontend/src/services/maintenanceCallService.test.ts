import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted lets the mock factory reference these without TDZ errors,
// since vi.mock calls are hoisted to the top of the file.
const mockAxiosInstance = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  interceptors: {
    request: { use: vi.fn() },
  },
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
  },
}));

import svc from './maintenanceCallService';

beforeEach(() => {
  mockAxiosInstance.post.mockReset();
  mockAxiosInstance.get.mockReset();
  mockAxiosInstance.put.mockReset();
});

describe('maintenanceCallService', () => {
  describe('badgeSwipe', () => {
    it('POSTs to /badge-swipe with badge_id and reader_key', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({ data: { action: 'call_created' } });
      const result = await svc.badgeSwipe('B1', 'press-1');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/badge-swipe', {
        badge_id: 'B1',
        reader_key: 'press-1',
      });
      expect(result.action).toBe('call_created');
    });
  });

  describe('getActiveCalls', () => {
    it('GETs /active and returns the body', async () => {
      const calls = [{ call_id: 1, status: 'open' }];
      mockAxiosInstance.get.mockResolvedValueOnce({ data: calls });
      const result = await svc.getActiveCalls();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/active');
      expect(result).toEqual(calls);
    });
  });

  describe('resolveCall', () => {
    it('PUTs /:id/resolve with the resolution body', async () => {
      mockAxiosInstance.put.mockResolvedValueOnce({ data: { call_id: 1, status: 'resolved' } });
      const result = await svc.resolveCall(1, { resolution_notes: 'Fixed' });
      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/1/resolve', {
        resolution_notes: 'Fixed',
      });
      expect(result.status).toBe('resolved');
    });
  });

  describe('searchParts', () => {
    it('GETs /parts/search with the query as a param', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({ data: [] });
      await svc.searchParts('bearing');
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/parts/search', {
        params: { q: 'bearing' },
      });
    });
  });

  describe('getMetrics', () => {
    it('GETs /stats/metrics and forwards filter params', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { overall: {}, by_machine: [], by_reason: [], by_shift: [] },
      });
      await svc.getMetrics({ from: '2026-01-01', to: '2026-01-31' });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/stats/metrics', {
        params: { from: '2026-01-01', to: '2026-01-31' },
      });
    });
  });

  describe('registerBadge', () => {
    it('POSTs the badge payload to /admin/badges', async () => {
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { badge_id: 'B1', person_name: 'Joe', role: 'operator' },
      });
      const body = { badge_id: 'B1', person_name: 'Joe', role: 'operator' as const };
      await svc.registerBadge(body);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/admin/badges', body);
    });
  });

  describe('propagates errors', () => {
    it('rejects when the underlying request rejects', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('network'));
      await expect(svc.getActiveCalls()).rejects.toThrow('network');
    });
  });
});

describe('getPartsMetrics', () => {
  it('GETs /stats/parts-metrics and forwards filter params', async () => {
    const parts = { top_parts: [], by_machine: [], by_tech: [] };
    mockAxiosInstance.get.mockResolvedValueOnce({ data: parts });
    const result = await svc.getPartsMetrics({ from: '2026-01-01', machine_id: 125 });
    expect(mockAxiosInstance.get).toHaveBeenCalledWith('/stats/parts-metrics', {
      params: { from: '2026-01-01', machine_id: 125 },
    });
    expect(result).toEqual(parts);
  });
});
