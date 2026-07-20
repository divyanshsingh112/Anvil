import { prisma } from "@/lib/prisma";
import { calculateCompletionRate } from "@/lib/completion-rate";

export interface ConsistencyTrendPoint {
  month: number;
  year: number;
  label: string;
  percentage: number;
  /** Distinguishes "0% no habits" from "0% had habits but none completed" */
  hadHabits: boolean;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Computes the completion rate for each of the last 6 calendar months
 * (current month + previous 5) using the shared calculateCompletionRate
 * utility.
 *
 * Returns an array of 6 data points, ordered oldest → newest.
 */
export async function calculateConsistencyTrend(
  userId: string
): Promise<ConsistencyTrendPoint[]> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  const results: ConsistencyTrendPoint[] = [];

  for (let offset = 5; offset >= 0; offset--) {
    // Calculate target month (going back from current)
    let targetMonth = currentMonth - offset;
    let targetYear = currentYear;

    while (targetMonth < 0) {
      targetMonth += 12;
      targetYear--;
    }

    // Month boundaries (inclusive)
    const startDate = new Date(Date.UTC(targetYear, targetMonth, 1));
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const endDate = new Date(Date.UTC(targetYear, targetMonth, daysInMonth));

    const result = await calculateCompletionRate(
      prisma,
      userId,
      startDate,
      endDate
    );

    results.push({
      month: targetMonth + 1, // 1-indexed for API consumers
      year: targetYear,
      label: MONTH_LABELS[targetMonth],
      percentage: result.percentage,
      hadHabits: result.hadHabits,
    });
  }

  return results;
}
