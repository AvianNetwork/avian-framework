/**
 * Format a date+time consistently with a fixed locale to avoid SSR/client
 * hydration mismatches caused by differing system locales.
 */
export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a date (no time) consistently with a fixed locale.
 */
export function formatDateShort(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
