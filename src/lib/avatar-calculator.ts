export type DominantClass = "warrior" | "mage" | "rogue" | "balanced";
export type AvatarTier = "novice-look" | "adept-look" | "master-look";

export interface AvatarCalculation {
  dominantClass: DominantClass;
  tier: AvatarTier;
  highestCount: number;
}

/**
 * Calculates the user's cosmetic avatar appearance based on class completion counts.
 * 
 * Logic:
 * 1. Find the class with the highest completions.
 * 2. If the highest count is 0, or if the relative difference between the highest
 *    and the second highest count is <= 15%, classify as "balanced" (hybrid appearance).
 * 3. Otherwise, classify as the dominant class ("warrior" | "mage" | "rogue").
 * 4. Determine cosmetic tier based on the highest count:
 *    - 0-9: "novice-look"
 *    - 10-49: "adept-look"
 *    - 50+: "master-look"
 */
export function calculateAvatarDetails(
  warriorCompletions: number = 0,
  mageCompletions: number = 0,
  rogueCompletions: number = 0
): AvatarCalculation {
  const classes = [
    { name: "warrior" as const, count: warriorCompletions },
    { name: "mage" as const, count: mageCompletions },
    { name: "rogue" as const, count: rogueCompletions },
  ];

  // Sort descending by count
  classes.sort((a, b) => b.count - a.count);

  const highest = classes[0];
  const second = classes[1];

  let dominantClass: DominantClass = highest.name;

  if (highest.count === 0) {
    dominantClass = "balanced";
  } else {
    // Relative difference: (highest - second) / highest
    const relativeDiff = (highest.count - second.count) / highest.count;
    if (relativeDiff <= 0.15) {
      dominantClass = "balanced";
    }
  }

  // Tier logic: purely cosmetic, based on the highest completion count
  let tier: AvatarTier = "novice-look";
  if (highest.count >= 50) {
    tier = "master-look";
  } else if (highest.count >= 10) {
    tier = "adept-look";
  }

  return {
    dominantClass,
    tier,
    highestCount: highest.count,
  };
}
