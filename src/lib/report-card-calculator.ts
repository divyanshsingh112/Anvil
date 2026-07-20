import { prisma } from "@/lib/prisma";
import { calculateCompletionRate } from "@/lib/completion-rate";

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
 *
 * Uses the shared calculateCompletionRate utility (lib/completion-rate.ts)
 * which respects activeDays, createdAt, and archivedAt for fair denominator.
 */
export async function calculateWeeklyReportCard(userId: string): Promise<WeeklyReportCardResult> {
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const startDate = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

  // Delegate to shared utility
  const result = await calculateCompletionRate(prisma, userId, startDate, today);
  const percentage = result.percentage;

  // Map to tier
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

