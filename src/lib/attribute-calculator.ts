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
 * Computes the CHA (Charisma) placeholder score.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  TEMPORARY PLACEHOLDER — Sprint 3 Rival System will replace this   │
 * │                                                                     │
 * │  Real CHA will be derived from social interactions (rival battles,  │
 * │  challenges sent/received, win rate) once the Rival System is       │
 * │  implemented. This formula is a stand-in so the radar chart has a   │
 * │  non-zero, meaningful CHA axis until then.                          │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Formula:
 *   streakRatio = currentStreak / max(longestStreak, 1)
 *   CHA = min(100, round(
 *     streakRatio × 0.6 × sqrt(totalCompletions) × 10
 *     + (totalCompletions > 0 ? overallCompletionRate × 0.4 : 0)
 *   ))
 *
 * Rationale:
 *   - streakRatio (60% weight): How close you are to your personal best streak.
 *     At peak streak the ratio is 1.0; after a break it drops, reflecting
 *     reduced "social reliability."
 *   - overallCompletionRate (40% weight): Rewards consistent habit completion.
 *   - sqrt(totalCompletions): Ensures the score grows with activity volume,
 *     not just from ratio alone.
 *
 * Example: streak=3, longestStreak=5, totalCompletions=16, completionRate=50%
 *   streakRatio = 0.6
 *   CHA = min(100, round(0.6 × 0.6 × 4 × 10 + 50 × 0.4))
 *       = min(100, round(14.4 + 20))
 *       = 34
 */
function chaPlaceholderScore(
  totalCompletions: number,
  streak: number,
  longestStreak: number,
  overallCompletionRate: number
): number {
  if (totalCompletions === 0 && streak === 0) return 0;

  const streakRatio = streak / Math.max(longestStreak, 1);

  const streakComponent = streakRatio * 0.6 * Math.sqrt(totalCompletions) * 10;
  const rateComponent = totalCompletions > 0 ? overallCompletionRate * 0.4 : 0;

  return Math.min(100, Math.round(streakComponent + rateComponent));
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
  } = input;

  return {
    strScore: classScore(warriorCompletions, totalCompletions),
    intScore: classScore(mageCompletions, totalCompletions),
    wisScore: classScore(rogueCompletions, totalCompletions),
    chaScore: chaPlaceholderScore(totalCompletions, streak, longestStreak, overallCompletionRate),
  };
}
