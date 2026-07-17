import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { XP_PER_COMPLETION, COINS_PER_PERFECT_DAY, calculateLevel } from "@/lib/gamification-constants";
import { calculateStreakOnCompletion, calculateStreakOnUncompletion } from "@/lib/streak-calculator";
import { Prisma } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { habitId, completed, timeBucket, timeAccuracy, customCompletedAt } = body;

    if (!habitId || typeof completed !== "boolean") {
      return NextResponse.json(
        { error: "habitId (string) and completed (boolean) are required fields" },
        { status: 400 }
      );
    }

    const now = new Date();
    // Anti-cheat: Always calculate date on server only
    const year = now.getFullYear();
    const month = now.getMonth();
    const dateVal = now.getDate();
    const today = new Date(Date.UTC(year, month, dateVal));
    const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Begin a single Prisma transaction for atomicity and anti-cheat/concurrency safety
    const result = await prisma.$transaction(async (tx) => {
      // 1. Look up habit and verify ownership
      const habit = await tx.habit.findFirst({
        where: { id: habitId, userId },
      });

      if (!habit) {
        throw new Error("HABIT_NOT_FOUND");
      }

      // Check if completion already exists for today
      const existingCompletion = await tx.completion.findFirst({
        where: { habitId, userId, date: today },
      });

      // Get user's current level, xp, coins, streak
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error("USER_NOT_FOUND");
      }

      let completion = null;
      let newXp = Number(user.xp);
      let newLevel = user.level;
      let newCoins = user.coins;
      let newStreak = user.streak;
      let newLongestStreak = user.longestStreak;
      let leveledUp = false;
      let perfectDay = false;

      // Map habit difficulty to XP reward
      const difficulty = habit.difficulty as keyof typeof XP_PER_COMPLETION;
      const xpReward = XP_PER_COMPLETION[difficulty] || 10;

      if (completed) {
        // Toggle complete
        if (existingCompletion) {
          // Already completed today, do not award rewards again but update time info
          const derivedTimeBucket = timeBucket;
          const derivedTimeAccuracy = timeAccuracy || "skip";
          let completedAtDate = now;

          if (derivedTimeAccuracy === "confirmed") {
            if (customCompletedAt) {
              const parsed = new Date(customCompletedAt);
              if (!isNaN(parsed.getTime())) completedAtDate = parsed;
            }
          }

          completion = await tx.completion.update({
            where: { id: existingCompletion.id },
            data: {
              loggedAt: now,
              completedAt: completedAtDate,
              timeBucket: derivedTimeBucket || existingCompletion.timeBucket,
              timeAccuracy: derivedTimeAccuracy,
            },
          });
        } else {
          // New completion today!
          let derivedTimeBucket = timeBucket;
          let derivedTimeAccuracy = timeAccuracy || "skip";
          let completedAtDate = now;

          if (derivedTimeAccuracy === "confirmed") {
            if (customCompletedAt) {
              const parsed = new Date(customCompletedAt);
              if (!isNaN(parsed.getTime())) completedAtDate = parsed;
            }
            if (!derivedTimeBucket) {
              const hour = completedAtDate.getHours();
              if (hour >= 5 && hour <= 11) derivedTimeBucket = "morning";
              else if (hour >= 12 && hour <= 16) derivedTimeBucket = "afternoon";
              else if (hour >= 17 && hour <= 21) derivedTimeBucket = "evening";
              else derivedTimeBucket = "night";
            }
          } else if (derivedTimeAccuracy === "estimated") {
            completedAtDate = now;
            if (!derivedTimeBucket) derivedTimeBucket = "morning";
          } else {
            derivedTimeAccuracy = "skip";
            completedAtDate = now;
            const hour = now.getHours();
            if (hour >= 5 && hour <= 11) derivedTimeBucket = "morning";
            else if (hour >= 12 && hour <= 16) derivedTimeBucket = "afternoon";
            else if (hour >= 17 && hour <= 21) derivedTimeBucket = "evening";
            else derivedTimeBucket = "night";
          }

          completion = await tx.completion.create({
            data: {
              habitId,
              userId,
              date: today,
              loggedAt: now,
              completedAt: completedAtDate,
              timeBucket: derivedTimeBucket,
              timeAccuracy: derivedTimeAccuracy,
            },
          });

          // 2. Increment XP
          newXp = newXp + xpReward;
          newLevel = calculateLevel(newXp);
          if (newLevel > user.level) {
            leveledUp = true;
          }

          // 3. Recalculate Streak
          const streakCalc = await calculateStreakOnCompletion(tx, userId, today, user.streak);
          newStreak = streakCalc.newStreak;
          if (newStreak > user.longestStreak) {
            newLongestStreak = newStreak;
          }

          // 4. Perfect Day coin check
          // Find if there is an existing UserStats for date check
          const stats = await tx.userStats.findUnique({
            where: { userId },
          });

          const alreadyPerfectToday = stats?.lastPerfectDay && 
            new Date(stats.lastPerfectDay).getTime() === today.getTime();

          // Find all non-archived habits for this month
          const monthHabits = await tx.habit.findMany({
            where: { userId, year: today.getFullYear(), month: today.getMonth() + 1, archivedAt: null },
          });

          // Filter to only those scheduled for today
          const todayScheduledHabits = monthHabits.filter((h) => {
            return !h.activeDays || h.activeDays.length === 0 || h.activeDays.includes(currentDayOfWeek);
          });

          // Count today's completions (includes the one we just wrote)
          const todayCompletionsCount = await tx.completion.count({
            where: { userId, date: today },
          });

          if (
            todayScheduledHabits.length > 0 &&
            todayCompletionsCount === todayScheduledHabits.length &&
            !alreadyPerfectToday
          ) {
            // Perfect day condition met!
            perfectDay = true;
            newCoins = newCoins + COINS_PER_PERFECT_DAY;
          }

          // 5. Update UserStats denormalized tables
          const classField = `${habit.class}Completions` as "warriorCompletions" | "mageCompletions" | "rogueCompletions";
          const updateStatsData: Prisma.UserStatsUpdateInput = {
            totalCompletions: { increment: 1 },
            [classField]: { increment: 1 },
          };

          if (perfectDay) {
            updateStatsData.perfectDays = { increment: 1 };
            updateStatsData.lastPerfectDay = today;
          }

          await tx.userStats.upsert({
            where: { userId },
            create: {
              userId,
              totalCompletions: 1,
              [classField]: 1,
              perfectDays: perfectDay ? 1 : 0,
              lastPerfectDay: perfectDay ? today : null,
            },
            update: updateStatsData,
          });
        }
      } else {
        // Toggle incomplete (un-toggle)
        if (!existingCompletion) {
          // Already uncompleted, do nothing
          return { completion: null, user, leveledUp: false, perfectDay: false };
        }

        // Delete completion row
        await tx.completion.delete({
          where: { id: existingCompletion.id },
        });

        // 1. Subtract XP
        newXp = Math.max(0, newXp - xpReward);
        newLevel = calculateLevel(newXp); // Can go down

        // 2. Recalculate Streak
        const streakCalc = await calculateStreakOnUncompletion(tx, userId, today, user.streak);
        newStreak = streakCalc.newStreak;

        // 3. Update UserStats counters
        const stats = await tx.userStats.findUnique({
          where: { userId },
        });

        if (stats) {
          const classField = `${habit.class}Completions` as "warriorCompletions" | "mageCompletions" | "rogueCompletions";
          const currentClassCompletions = Number(stats[classField] || 0);
          
          await tx.userStats.update({
            where: { userId },
            data: {
              totalCompletions: Math.max(0, stats.totalCompletions - 1),
              [classField]: Math.max(0, currentClassCompletions - 1),
            },
          });
        }
      }

      // Update the user record with the new values
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          xp: newXp,
          level: newLevel,
          coins: newCoins,
          streak: newStreak,
          longestStreak: newLongestStreak,
        },
      });

      return {
        completion,
        user: {
          xp: Number(updatedUser.xp),
          level: updatedUser.level,
          coins: updatedUser.coins,
          streak: updatedUser.streak,
          longestStreak: updatedUser.longestStreak,
        },
        leveledUp,
        perfectDay,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    const errorObj = error as Error;
    if (errorObj.message === "HABIT_NOT_FOUND") {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }
    if (errorObj.message === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    console.error("POST completions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({ message: "Completions toggle API stub" });
}
