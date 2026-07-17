export const XP_PER_COMPLETION = {
  novice: 10,
  adept: 15,
  master: 20,
} as const;

export const COINS_PER_PERFECT_DAY = 5;

export function calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}
