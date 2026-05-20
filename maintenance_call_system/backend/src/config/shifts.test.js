import { describe, it, expect, vi, afterEach } from 'vitest';
const { getCurrentShift } = require('./shifts');

afterEach(() => vi.useRealTimers());

describe('getCurrentShift', () => {
  it('returns 1st Shift at 08:00 local time', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 8, 0, 0));
    expect(getCurrentShift()).toBe('1st Shift');
  });

  it('returns 1st Shift at the lower boundary 06:00', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 6, 0, 0));
    expect(getCurrentShift()).toBe('1st Shift');
  });

  it('returns 2nd Shift at 15:30 local time', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 15, 30, 0));
    expect(getCurrentShift()).toBe('2nd Shift');
  });

  it('returns 3rd Shift at 23:00 (overnight start)', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 23, 0, 0));
    expect(getCurrentShift()).toBe('3rd Shift');
  });

  it('returns 3rd Shift at 02:00 (overnight wrap)', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 2, 0, 0));
    expect(getCurrentShift()).toBe('3rd Shift');
  });

  it('returns a string for any time of day (guardrail)', () => {
    expect(typeof getCurrentShift()).toBe('string');
  });
});
