import { describe, it, expect } from 'vitest';
import {
  getLocalToday,
  getLocalYesterday,
  toLocalDate,
  getWeekStart,
  getMonthStart,
  isToday,
  isYesterday,
} from '../utils/dateRange';

describe('getLocalToday', () => {
  it('returns YYYY-MM-DD format', () => {
    const today = getLocalToday();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('matches current date', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(getLocalToday()).toBe(expected);
  });
});

describe('getLocalYesterday', () => {
  it('returns YYYY-MM-DD format', () => {
    expect(getLocalYesterday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('is one day before today', () => {
    const today = new Date(getLocalToday());
    const yesterday = new Date(getLocalYesterday());
    const diff = today.getTime() - yesterday.getTime();
    expect(diff).toBe(24 * 60 * 60 * 1000);
  });
});

describe('toLocalDate', () => {
  it('handles ISO timestamps with Z suffix', () => {
    const result = toLocalDate('2026-03-15T10:30:00Z');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('handles ISO timestamps without Z suffix (naive UTC)', () => {
    const result = toLocalDate('2026-03-15T10:30:00');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('handles timestamps with space separator', () => {
    const result = toLocalDate('2026-03-15 10:30:00');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns today for undefined input', () => {
    expect(toLocalDate(undefined)).toBe(getLocalToday());
  });
});

describe('getWeekStart', () => {
  it('returns YYYY-MM-DD format', () => {
    expect(getWeekStart()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns a Monday', () => {
    const weekStart = new Date(getWeekStart() + 'T12:00:00');
    // Monday = 1
    expect(weekStart.getDay()).toBe(1);
  });

  it('with offset=1 returns previous week Monday', () => {
    const thisWeek = new Date(getWeekStart(0) + 'T12:00:00');
    const lastWeek = new Date(getWeekStart(1) + 'T12:00:00');
    const diff = thisWeek.getTime() - lastWeek.getTime();
    expect(diff).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('getMonthStart', () => {
  it('returns first of month', () => {
    const monthStart = getMonthStart();
    expect(monthStart).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it('with offset=1 returns first of previous month', () => {
    const prevMonth = getMonthStart(1);
    expect(prevMonth).toMatch(/^\d{4}-\d{2}-01$/);
  });
});

describe('isToday / isYesterday', () => {
  it('isToday returns true for current date', () => {
    const now = new Date().toISOString();
    expect(isToday(now)).toBe(true);
  });

  it('isToday returns false for old date', () => {
    expect(isToday('2020-01-01T12:00:00Z')).toBe(false);
  });

  it('isYesterday returns true for yesterday timestamp', () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(12, 0, 0, 0);
    expect(isYesterday(d.toISOString())).toBe(true);
  });
});
