export interface TerminologyPack {
  habitSingular: string;
  habitPlural: string;
  classWarrior: string;
  classMage: string;
  classRogue: string;
  difficultyNovice: string;
  difficultyAdept: string;
  difficultyMaster: string;
  xpLabel: string;
  coinsLabel: string;
  streakLabel: string;
  levelLabel: string;
  perfectDayLabel: string;
  leaderboardLabel: string;
  attrStr: string;
  attrInt: string;
  attrWis: string;
  attrCha: string;
  chainLabel: string;
  chainPlural: string;
  rivalLabel: string;
  rivalPlural: string;
  createActionLabel: string;
  emptyStateLabel: string;
  classSelectorLabel: string;
  journalLabel: string;
  iconWarrior: string; // lucide icon name
  iconMage: string;
  iconRogue: string;
}

export const terminologyPacks: Record<string, TerminologyPack> = {
  plain: {
    habitSingular: "Habit",
    habitPlural: "Habits",
    classWarrior: "Fitness",
    classMage: "Study",
    classRogue: "Other",
    difficultyNovice: "Easy",
    difficultyAdept: "Medium",
    difficultyMaster: "Hard",
    xpLabel: "Points",
    coinsLabel: "Coins",
    streakLabel: "Streak",
    levelLabel: "Level",
    perfectDayLabel: "Perfect Day",
    leaderboardLabel: "Leaderboard",
    attrStr: "Physical",
    attrInt: "Focus",
    attrWis: "Discipline",
    attrCha: "Social",
    chainLabel: "Routine",
    chainPlural: "Routines",
    rivalLabel: "Rival",
    rivalPlural: "Rivals",
    createActionLabel: "Create Habit",
    emptyStateLabel: "No habits yet — add your first one",
    classSelectorLabel: "Category",
    journalLabel: "Habit Journal",
    iconWarrior: "Dumbbell",
    iconMage: "BookOpen",
    iconRogue: "Shuffle",
  },
  rpg: {
    habitSingular: "Quest",
    habitPlural: "Quests",
    classWarrior: "Warrior",
    classMage: "Mage",
    classRogue: "Rogue",
    difficultyNovice: "Novice",
    difficultyAdept: "Adept",
    difficultyMaster: "Master",
    xpLabel: "XP",
    coinsLabel: "Gold",
    streakLabel: "Streak",
    levelLabel: "Level",
    perfectDayLabel: "Perfect Day",
    leaderboardLabel: "Leaderboard",
    attrStr: "STR",
    attrInt: "INT",
    attrWis: "WIS",
    attrCha: "CHA",
    chainLabel: "Quest Chain",
    chainPlural: "Quest Chains",
    rivalLabel: "Rival",
    rivalPlural: "Rivals",
    createActionLabel: "Forge New Quest",
    emptyStateLabel: "No quests yet — forge your first one",
    classSelectorLabel: "Hero Class",
    journalLabel: "Quest Journal",
    iconWarrior: "Sword",
    iconMage: "Sparkles",
    iconRogue: "Zap",
  },
  racing: {
    habitSingular: "Lap",
    habitPlural: "Laps",
    classWarrior: "Speed",
    classMage: "Strategy",
    classRogue: "Handling",
    difficultyNovice: "Rookie",
    difficultyAdept: "Pro",
    difficultyMaster: "Champion",
    xpLabel: "Speed Points",
    coinsLabel: "Fuel",
    streakLabel: "Win Streak",
    levelLabel: "Rank",
    perfectDayLabel: "Flawless Lap",
    leaderboardLabel: "Standings",
    attrStr: "Speed",
    attrInt: "Strategy",
    attrWis: "Handling",
    attrCha: "Rep",
    chainLabel: "Circuit",
    chainPlural: "Circuits",
    rivalLabel: "Rival",
    rivalPlural: "Rivals",
    createActionLabel: "Start New Lap",
    emptyStateLabel: "No laps yet — start your first one",
    classSelectorLabel: "Vehicle Spec",
    journalLabel: "Lap Log",
    iconWarrior: "Gauge",
    iconMage: "Route",
    iconRogue: "Wrench",
  },
  sports: {
    habitSingular: "Drill",
    habitPlural: "Drills",
    classWarrior: "Strength",
    classMage: "Focus",
    classRogue: "Agility",
    difficultyNovice: "Rookie",
    difficultyAdept: "Starter",
    difficultyMaster: "All-Star",
    xpLabel: "Score",
    coinsLabel: "MVP Points",
    streakLabel: "Win Streak",
    levelLabel: "Tier",
    perfectDayLabel: "Perfect Game",
    leaderboardLabel: "Rankings",
    attrStr: "Strength",
    attrInt: "Focus",
    attrWis: "Agility",
    attrCha: "Clout",
    chainLabel: "Combo",
    chainPlural: "Combos",
    rivalLabel: "Rival",
    rivalPlural: "Rivals",
    createActionLabel: "Run New Drill",
    emptyStateLabel: "No drills yet — run your first one",
    classSelectorLabel: "Athlete Role",
    journalLabel: "Drill Log",
    iconWarrior: "Dumbbell",
    iconMage: "Target",
    iconRogue: "Zap",
  },
};

/**
 * Returns the terminology pack matching the given theme ID.
 * Defaults to 'plain' if the theme is not a defined terminology key (e.g. pure color-only themes).
 */
export function getTerminology(themeId: string | null | undefined): TerminologyPack {
  const normalized = (themeId || "").toLowerCase();
  if (normalized in terminologyPacks) {
    return terminologyPacks[normalized];
  }
  // Color-only themes (midnight, forest, cyberpunk, default/plain) default to 'plain' terminology pack
  return terminologyPacks.plain;
}
