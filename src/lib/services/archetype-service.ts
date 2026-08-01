import { classifyArchetype, type ClassificationResult } from "../archetype-classifier";

/**
 * Lazy daily archetype recomputation.
 * Same pattern as momentum-service.ts — only recalculates if it hasn't run today.
 */
export async function triggerLazyArchetypeClassification(
  userId: string,
  todayInput?: Date,
  force = false
): Promise<{ result: ClassificationResult; recalculated: boolean }> {
  const { prisma } = await import("../prisma");

  const today = todayInput ? new Date(todayInput) : new Date();
  today.setUTCHours(0, 0, 0, 0);

  const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;

  // 1. Check if already computed today
  if (!force) {
    const profile = await prisma.mlUserProfile.findUnique({
      where: { userId },
      select: { archetypeComputedAt: true, behavioralArchetype: true },
    });

    if (profile?.archetypeComputedAt) {
      const lastDate = new Date(profile.archetypeComputedAt);
      const lastDateStr = `${lastDate.getUTCFullYear()}-${String(lastDate.getUTCMonth() + 1).padStart(2, "0")}-${String(lastDate.getUTCDate()).padStart(2, "0")}`;

      if (lastDateStr === todayStr) {
        // Already computed today — return cached
        return {
          result: {
            archetype: (profile.behavioralArchetype as any) || "insufficient_data",
            features: null, // not re-fetched for cached responses
            classifierVersion: 1,
            confidence: { completionsCount: 0, accountAgeDays: 0 },
          },
          recalculated: false,
        };
      }
    }
  }

  // 2. Run classifier
  const result = await classifyArchetype(userId, today);

  // 3. Upsert into MlUserProfile
  const archetypeValue = result.archetype === "insufficient_data" ? null : result.archetype;

  const profileExists = await prisma.mlUserProfile.findUnique({
    where: { userId },
    select: { userId: true },
  });

  if (profileExists) {
    await prisma.mlUserProfile.update({
      where: { userId },
      data: {
        behavioralArchetype: archetypeValue,
        archetypeVersion: result.classifierVersion,
        archetypeComputedAt: today,
      },
    });
  } else {
    await prisma.mlUserProfile.create({
      data: {
        userId,
        behavioralArchetype: archetypeValue,
        archetypeVersion: result.classifierVersion,
        archetypeComputedAt: today,
      },
    });
  }

  return { result, recalculated: true };
}
