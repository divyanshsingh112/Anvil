/**
 * Attribute Score Calculator — Phase 13
 *
 * Computes STR/INT/WIS/CHA scores normalized to 0-100 for radar chart display.
 *
 * Mapping (per original spec, Section 6):
 *   STR (Strength)      <- warriorCompletions
 *   INT (Intelligence)  <- mageCompletions
 *   WIS (Wisdom)        <- rogueCompletions
 *   CHA (Charisma)      <- TEMPORARY placeholder (see below)
 *
 * Normalization approach: Proportional distribution with square-root scaling
 *   - Each class score = proportion_of_total × sqrt(totalCompletions) × SCALE_FACTOR
 *   - Capped at 100
 *   - sqrt scaling ensures early completions have meaningful impact while
 *     veterans plateau gracefully near 100
 *   - SCALE_FACTOR = 20 means: at 25 total completions all in one class,
 *     that class reaches 100. A balanced user (3-way split) reaches max at ~100 total.
 */

const SCALE_FACTOR = 20;

export interface AttributeScores {
  strScore: number;
  intScore: number;
  wisScore: number;
  chaScore: number;
}

interface AttributeInput {
  warriorCompletions: number;
  mageCompletions: number;
  rogueCompletions: number;
  totalCompletions: number;
  /** Current active streak (days) */
  streak: number;
  /** All-time longest streak (days) */
  longestStreak: number;
  /**
   * Overall completion rate (0-100 percentage).
   * Pass 0 if not available; CHA will still be non-zero if streak data exists.
   */
  overallCompletionRate?: number;
  rivalWins?: number;
  rivalLosses?: number;
  rivalTies?: number;
}

/**
 * Computes a single class score (STR, INT, or WIS) using proportional sqrt scaling.
 */
function classScore(classCompletions: number, totalCompletions: number): number {
  if (totalCompletions === 0) return 0;
  const proportion = classCompletions / totalCompletions;
  const raw = proportion * Math.sqrt(totalCompletions) * SCALE_FACTOR;
  return Math.min(100, Math.round(raw));
}

/**
 * Computes the real CHA (Charisma) score.
 *
 * Formula:
 *   consistencyScore = streakRatio × 0.6 × sqrt(totalCompletions) × 10
 *                      + (totalCompletions > 0 ? overallCompletionRate × 0.4 : 0)
 *
 *   If the user has zero rival duels completed:
 *     rivalWeight = 0
 *     CHA = consistencyScore
 *
 *   If the user has rival history:
 *     rivalWeight = 0.4 (40% weight)
 *     winRate = rivalWins / (rivalWins + rivalLosses + rivalTies)
 *     rivalComponent = winRate × 100
 *     CHA = (1 - rivalWeight) × consistencyScore + rivalWeight × rivalComponent
 */
function calculateChaScore(
  totalCompletions: number,
  streak: number,
  longestStreak: number,
  overallCompletionRate: number,
  rivalWins: number = 0,
  rivalLosses: number = 0,
  rivalTies: number = 0
): number {
  if (totalCompletions === 0 && streak === 0) return 0;

  const streakRatio = streak / Math.max(longestStreak, 1);
  const streakComponent = streakRatio * 0.6 * Math.sqrt(totalCompletions) * 10;
  const rateComponent = totalCompletions > 0 ? overallCompletionRate * 0.4 : 0;
  const consistencyScore = streakComponent + rateComponent;

  const totalDuels = rivalWins + rivalLosses + rivalTies;
  let rivalComponent = 50; // Neutral baseline if no duels
  let rivalWeight = 0; // No weight if no duels (defaults to 100% consistency)

  if (totalDuels > 0) {
    const winRate = rivalWins / totalDuels;
    rivalComponent = winRate * 100;
    rivalWeight = 0.4; // 40% based on rival performance
  }

  const rawCha = (1 - rivalWeight) * consistencyScore + rivalWeight * rivalComponent;
  return Math.min(100, Math.round(rawCha));
}

/**
 * Calculates all four attribute scores from UserStats + User data.
 *
 * Designed to be called within the completion toggle transaction using
 * data already in scope (no additional DB queries needed).
 */
export function calculateAttributeScores(input: AttributeInput): AttributeScores {
  const {
    warriorCompletions,
    mageCompletions,
    rogueCompletions,
    totalCompletions,
    streak,
    longestStreak,
    overallCompletionRate = 0,
    rivalWins = 0,
    rivalLosses = 0,
    rivalTies = 0,
  } = input;

  return {
    strScore: classScore(warriorCompletions, totalCompletions),
    intScore: classScore(mageCompletions, totalCompletions),
    wisScore: classScore(rogueCompletions, totalCompletions),
    chaScore: calculateChaScore(
      totalCompletions,
      streak,
      longestStreak,
      overallCompletionRate,
      rivalWins,
      rivalLosses,
      rivalTies
    ),
  };
}
