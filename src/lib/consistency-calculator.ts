import { PrismaClient } from "@prisma/client";
import { getISTDayOfWeek } from "@/lib/date-utils";

/**
 * Calculates a user's Consistency Score (0-100%) based on scheduled days over the past 30 days.
 * 
 * Rules:
 * 1. Only evaluates days that were scheduled for the user's active habits (using scheduledDays).
 * 2. Non-scheduled days are completely excluded and never count as missed.
 * 3. On a missed scheduled day, the score decays gradually (ratio of completed scheduled slots to total scheduled slots).
 * 4. Returns a rounded integer 0-100 (or 100 if 0 scheduled slots exist yet).
 */
export async function calculateConsistencyScore(
  db: PrismaClient,
  userId: string,
  targetDate: Date = new Date()
): Promise<number> {
  const start29DaysAgo = new Date(targetDate.getTime() - 29 * 24 * 60 * 60 * 1000);
  start29DaysAgo.setUTCHours(0, 0, 0, 0);

  // Fetch habits and completions in parallel for user in the 30-day window
  const [habits, completions] = await Promise.all([
    db.habit.findMany({
      where: {
        userId,
        OR: [
          { archivedAt: null },
          { archivedAt: { gte: start29DaysAgo } },
        ],
      },
      select: {
        id: true,
        createdAt: true,
        archivedAt: true,
        scheduledDays: true,
      },
    }),
    db.completion.findMany({
      where: {
        userId,
        date: {
          gte: start29DaysAgo,
          lte: targetDate,
        },
      },
      select: {
        date: true,
        habitId: true,
      },
    }),
  ]);

  let totalScheduledSlots = 0;
  let completedScheduledSlots = 0;

  for (let i = 0; i < 30; i++) {
    const checkDay = new Date(start29DaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    const dayOfWeek = getISTDayOfWeek(checkDay);
    const dateStr = `${checkDay.getUTCFullYear()}-${String(checkDay.getUTCMonth() + 1).padStart(2, "0")}-${String(checkDay.getUTCDate()).padStart(2, "0")}`;

    for (const h of habits) {
      const created = new Date(h.createdAt);
      const archived = h.archivedAt ? new Date(h.archivedAt) : null;

      if (created <= checkDay && (!archived || archived > checkDay)) {
        const days = (h.scheduledDays && h.scheduledDays.length > 0) ? h.scheduledDays : [0, 1, 2, 3, 4, 5, 6];

        if (days.includes(dayOfWeek)) {
          totalScheduledSlots++;

          const hasCompletion = completions.some((c: { habitId: string; date: Date }) => {
            if (c.habitId !== h.id) return false;
            const cDate = new Date(c.date);
            const cStr = `${cDate.getUTCFullYear()}-${String(cDate.getUTCMonth() + 1).padStart(2, "0")}-${String(cDate.getUTCDate()).padStart(2, "0")}`;
            return cStr === dateStr;
          });

          if (hasCompletion) {
            completedScheduledSlots++;
          }
        }
      }
    }
  }

  if (totalScheduledSlots === 0) return 100;
  return Math.min(100, Math.max(0, Math.round((completedScheduledSlots / totalScheduledSlots) * 100)));
}
