/**
 * Shared date range utilities for consistent "today/week/month" filtering.
 * ALL pages MUST use these functions — never hand-roll date comparisons.
 *
 * Dates are compared as YYYY-MM-DD strings in LOCAL time (not UTC).
 */

/** Get today's date as YYYY-MM-DD in local time. */
export function getLocalToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Get yesterday's date as YYYY-MM-DD in local time. */
export function getLocalYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Convert any date string (ISO or otherwise) to a local YYYY-MM-DD.
 *  Handles both UTC timestamps (with Z suffix) and naive timestamps from the API
 *  (no Z suffix — these are actually UTC from SQLite's func.now() but would be
 *  parsed as local time by JavaScript). We normalize by appending Z if missing,
 *  so all timestamps are consistently treated as UTC before converting to local. */
export function toLocalDate(dateStr: string | undefined): string {
  if (!dateStr) return getLocalToday();
  // Normalize: if the string looks like an ISO datetime but has no timezone indicator, treat it as UTC
  let normalized = dateStr;
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(dateStr) && !dateStr.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(dateStr)) {
    normalized = dateStr.replace(' ', 'T') + 'Z';
  }
  const d = new Date(normalized);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Get start of "this week" (Monday) as YYYY-MM-DD in local time. */
export function getWeekStart(offset = 0): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset - offset * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Get start of "this month" as YYYY-MM-DD in local time. */
export function getMonthStart(offset = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() - offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Check if a date string is "today" in local time. */
export function isToday(dateStr: string): boolean {
  return toLocalDate(dateStr) === getLocalToday();
}

/** Check if a date string is "yesterday" in local time. */
export function isYesterday(dateStr: string): boolean {
  return toLocalDate(dateStr) === getLocalYesterday();
}
