import { isSameDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export const IST = "Asia/Kolkata";

/**
 * Returns the day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * in Asia/Kolkata (IST) timezone.
 */
export function getISTDayOfWeek(date: Date | string | number): number {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  const zoned = toZonedTime(d, IST);
  return zoned.getDay();
}

/**
 * Checks if two dates fall on the same calendar day in Asia/Kolkata (IST) timezone.
 */
export function isSameISTDay(
  dateA: Date | string | number,
  dateB: Date | string | number
): boolean {
  const dA = typeof dateA === "string" || typeof dateA === "number" ? new Date(dateA) : dateA;
  const dB = typeof dateB === "string" || typeof dateB === "number" ? new Date(dateB) : dateB;
  return isSameDay(toZonedTime(dA, IST), toZonedTime(dB, IST));
}
