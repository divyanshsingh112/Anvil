import { prisma } from "@/lib/prisma";

export interface WeeklyReportCardResult {
  tier: "elite" | "building" | "steady" | "reset";
  tierLabel: string;
  percentage: number;
  message: string;
  icon: string;
  color: string;
}

const MESSAGES = {
  elite: [
    "Sensational work! You crushed almost all your goals this week. The forge is burning bright!",
    "Incredible dedication! You are performing at an elite level. Keep forging ahead!",
    "Legendary week! Your habits are hardening into iron armor. Outstanding consistency!"
  ],
  building: [
    "Great progress! You are laying down solid foundations. Just a little more push to reach elite standing.",
    "Solid consistency! You completed the majority of your quests. Momentum is growing!",
    "You are doing fantastic. Each completed habit builds your strength. Keep the streak active!"
  ],
  steady: [
    "Steady steps! You are showing up and keeping the flame alive. Let's aim to complete one more quest each day next week.",
    "You are on the path. Progress is a slow climb, and you are taking it step-by-step. Keep showing up!",
    "Every victory counts. You completed several key habits. A gentle nudge to build a slightly higher rhythm next week!"
  ],
  reset: [
    "It's completely okay to have a quiet week. Life gets busy, and your energy is valuable. When you're ready, we can start with just one small quest together.",
    "No guilt, no pressure. Every master blacksmith has days when the fire cools. Be kind to yourself today, and we'll rebuild slowly tomorrow.",
    "Rest is a crucial part of the journey. This week was about recharging. Let's pick our simplest habit next week and focus on just that one."
  ]
};

/**
 * Calculates the weekly report card for the given user for the last 7 calendar days.
 * Employs the same logic as Phase 7 to calculate possible completions.
 */
export async function calculateWeeklyReportCard(userId: string): Promise<WeeklyReportCardResult> {
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const startDate = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

  // 1. Fetch all user habits that are not archived or were archived inside the 7-day window
  const habits = await prisma.habit.findMany({
    where: {
      userId,
      createdAt: { lte: today },
      OR: [
        { archivedAt: null },
        { archivedAt: { gte: startDate } }
      ]
    }
  });

  // 2. Count completions inside the 7-day window
  const completionsCount = await prisma.completion.count({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: today
      }
    }
  });

  // 3. Compute total possible completions
  let totalPossible = 0;

  for (let i = 0; i < 7; i++) {
    const currentDay = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dayOfWeek = currentDay.getUTCDay();

    for (const habit of habits) {
      const createdDate = new Date(habit.createdAt);
      // Clean dates to midnight for comparison
      const habitCreatedMidnight = Date.UTC(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate());
      const currentDayMidnight = currentDay.getTime();

      // Check if habit existed on currentDay
      if (habitCreatedMidnight > currentDayMidnight) {
        continue; // Habit didn't exist yet
      }

      // Check if habit was archived before currentDay
      if (habit.archivedAt) {
        const archivedDate = new Date(habit.archivedAt);
        const archivedMidnight = Date.UTC(archivedDate.getFullYear(), archivedDate.getMonth(), archivedDate.getDate());
        if (archivedMidnight < currentDayMidnight) {
          continue; // Habit was already archived
        }
      }

      // Check if habit was active on this day of week
      if (habit.activeDays && habit.activeDays.length > 0) {
        if (!habit.activeDays.includes(dayOfWeek)) {
          continue; // Not active on this weekday
        }
      }

      totalPossible++;
    }
  }

  // 4. Compute success percentage
  const percentage = totalPossible > 0 ? Math.round((completionsCount / totalPossible) * 100) : 0;

  // 5. Map to tier
  let tier: "elite" | "building" | "steady" | "reset";
  let tierLabel: string;
  let icon: string;
  let color: string;

  if (percentage >= 85) {
    tier = "elite";
    tierLabel = "Elite Status";
    icon = "Trophy";
    color = "#fbbf24"; // Gold
  } else if (percentage >= 60) {
    tier = "building";
    tierLabel = "Building Momentum";
    icon = "Sparkles";
    color = "var(--accent-purple)"; // Purple
  } else if (percentage >= 30) {
    tier = "steady";
    tierLabel = "Steady Progress";
    icon = "TrendingUp";
    color = "var(--accent-teal)"; // Teal
  } else {
    tier = "reset";
    tierLabel = "Reset Needed";
    icon = "RefreshCw";
    color = "#64748b"; // Neutral slate/muted
  }

  // Select random message variant
  const variants = MESSAGES[tier];
  const randIndex = Math.floor(Math.random() * variants.length);
  const message = variants[randIndex];

  return {
    tier,
    tierLabel,
    percentage,
    message,
    icon,
    color
  };
}
