import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateMomentumScore } from "@/lib/momentum-calculator";
import { getISTDayOfWeek } from "@/lib/date-utils";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get current calculation details
    const calcs = await calculateMomentumScore(userId);
    const score = calcs.score;

    // Fetch user and stats for interventions
    const [user, habits, activeDuel] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          streak: true,
          longestStreak: true,
          freeFreezeCharges: true,
          streakShieldActive: true,
        },
      }),
      prisma.habit.findMany({
        where: {
          userId,
          archivedAt: null,
        },
      }),
      prisma.rival.findFirst({
        where: {
          OR: [
            { challengerId: userId },
            { rivalId: userId },
          ],
          status: "active",
        },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Determine tier
    let tier: "on-fire" | "building" | "slipping" | "fading" | "cold";
    let label = "";
    let intervention: any = {};

    if (score >= 80) {
      tier = "on-fire";
      label = "On Fire";
      intervention = {
        type: "celebrate",
        message: "You are on fire! Keep maintaining your perfect streak.",
        details: { streak: user.streak, longestStreak: user.longestStreak },
      };
    } else if (score >= 60) {
      tier = "building";
      label = "Building";
      const diff = user.longestStreak - user.streak;
      intervention = {
        type: "encourage",
        message: diff > 0
          ? `You are ${diff} days away from your personal best streak!`
          : "You are matching your personal best streak!",
        details: { streak: user.streak, longestStreak: user.longestStreak, diff },
      };
    } else if (score >= 40) {
      tier = "slipping";
      label = "Slipping";
      
      // Calculate weakest-performing class (warrior, mage, rogue) in last 7 days
      const now = new Date();
      const start7DaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const completionsLast7 = await prisma.completion.findMany({
        where: {
          userId,
          date: { gte: start7DaysAgo },
        },
        select: {
          habit: {
            select: { class: true },
          },
        },
      });

      // Count scheduled sessions per class in last 7 days
      const scheduledCounts = { warrior: 0, mage: 0, rogue: 0 };
      const completionCounts = { warrior: 0, mage: 0, rogue: 0 };

      // Sum completions
      for (const c of completionsLast7) {
        const cClass = c.habit.class as keyof typeof completionCounts;
        if (cClass in completionCounts) {
          completionCounts[cClass]++;
        }
      }

      // Sum scheduled days
      for (let i = 0; i < 7; i++) {
        const checkDay = new Date(start7DaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
        const dayOfWeek = getISTDayOfWeek(checkDay);
        for (const h of habits) {
          const hClass = h.class as keyof typeof scheduledCounts;
          const days = h.scheduledDays && h.scheduledDays.length > 0 ? h.scheduledDays : [0, 1, 2, 3, 4, 5, 6];
          if (hClass in scheduledCounts && days.includes(dayOfWeek)) {
            scheduledCounts[hClass]++;
          }
        }
      }

      // Determine completion rates
      let weakestClass = "warrior";
      let lowestRate = 1.1; // rate is at most 1.0

      const classes: Array<"warrior" | "mage" | "rogue"> = ["warrior", "mage", "rogue"];
      for (const cClass of classes) {
        const sched = scheduledCounts[cClass];
        const comps = completionCounts[cClass];
        if (sched > 0) {
          const rate = comps / sched;
          if (rate < lowestRate) {
            lowestRate = rate;
            weakestClass = cClass;
          }
        }
      }

      intervention = {
        type: "challenge",
        message: `Your ${weakestClass} habits have been slipping — complete one today to recover momentum!`,
        details: { weakestClass },
      };
    } else if (score >= 20) {
      tier = "fading";
      label = "Fading";
      
      if (activeDuel) {
        intervention = {
          type: "rival",
          message: "Your rival is pulling ahead — time to catch up.",
          details: { hasActiveDuel: true },
        };
      } else {
        intervention = {
          type: "warning",
          message: "Your momentum is fading. Consistency is key — pick one simple habit to complete today.",
          details: { hasActiveDuel: false },
        };
      }
    } else {
      tier = "cold";
      label = "Cold";
      
      const hasShield = user.streakShieldActive;
      const hasFreeze = user.freeFreezeCharges > 0;
      
      intervention = {
        type: "freeze",
        message: (hasFreeze || hasShield)
          ? "Your habits are cold. Use an unused Streak Freeze or Streak Shield to protect your streak!"
          : "Your habits are cold. Complete a habit today or visit the shop to get streak protection.",
        details: { hasFreeze, hasShield },
      };
    }

    return NextResponse.json({
      score,
      tier,
      label,
      intervention,
      breakdown: {
        trend: calcs.scoreTrend,
        streak: calcs.scoreStreak,
        login: calcs.scoreLogin,
        consistency: calcs.scoreConsistency,
        best7: calcs.scoreBest7,
      },
    });
  } catch (error) {
    console.error("GET user momentum error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
