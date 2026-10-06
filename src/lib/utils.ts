export { cn } from "cn";

import { format } from "date-fns";

/**
 * Formats a number as Philippine Peso currency.
 * Example: formatCurrency(1234.5) → "₱1,234.50"
 */
export function formatCurrency(
  amount: number,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount);
}

/**
 * Formats a Date or ISO string using date-fns.
 * Default format: "MMM d, yyyy" (e.g. "Oct 3, 2026")
 */
export function formatDate(
  date: Date | string | null | undefined,
  formatStr = "MMM d, yyyy"
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, formatStr);
}

/**
 * Formats a Date or ISO string with time.
 * Default format: "MMM d, yyyy h:mm a" (e.g. "Oct 3, 2026 1:30 PM")
 */
export function formatDateTime(
  date: Date | string | null | undefined,
  formatStr = "MMM d, yyyy h:mm a"
): string {
  return formatDate(date, formatStr);
}
