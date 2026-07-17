-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "activeTheme" TEXT NOT NULL DEFAULT 'default',
    "heroClass" TEXT,
    "momentumScore" DECIMAL(65,30) NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Habit" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "activeDays" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Completion" (
    "id" UUID NOT NULL,
    "habitId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "timeBucket" TEXT NOT NULL,
    "timeAccuracy" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "Completion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStats" (
    "userId" UUID NOT NULL,
    "totalCompletions" INTEGER NOT NULL DEFAULT 0,
    "perfectDays" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "warriorCompletions" INTEGER NOT NULL DEFAULT 0,
    "mageCompletions" INTEGER NOT NULL DEFAULT 0,
    "rogueCompletions" INTEGER NOT NULL DEFAULT 0,
    "strScore" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "intScore" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "wisScore" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "chaScore" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStats_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ShopItem" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priceCoins" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "cssVariables" JSONB,
    "isLimited" BOOLEAN NOT NULL DEFAULT false,
    "availableUntil" TIMESTAMP(3),

    CONSTRAINT "ShopItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isEquipped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "xpReward" INTEGER NOT NULL,
    "icon" TEXT NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "userId" UUID NOT NULL,
    "achievementId" UUID NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("userId","achievementId")
);

-- CreateTable
CREATE TABLE "BossBattle" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "weekStart" DATE NOT NULL,
    "bossName" TEXT NOT NULL,
    "bossClass" TEXT NOT NULL,
    "challengeQuest" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rewardCoins" INTEGER NOT NULL,
    "rewardXp" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "BossBattle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestChain" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "habitIds" TEXT[],
    "bonusXp" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestChain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rival" (
    "id" UUID NOT NULL,
    "challengerId" UUID NOT NULL,
    "rivalId" UUID NOT NULL,
    "habitName" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "challengerCount" INTEGER NOT NULL DEFAULT 0,
    "rivalCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "winnerId" UUID,
    "defeatMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rival_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MlUserProfile" (
    "userId" UUID NOT NULL,
    "behavioralArchetype" TEXT,
    "dangerZoneHours" INTEGER[],
    "bestTimeBucket" TEXT,
    "procrastinationScore" DECIMAL(65,30),
    "lastMinuteRate" DECIMAL(65,30),
    "avoidancePattern" JSONB,
    "momentumHistory" JSONB,
    "predictedCompletionRate" DECIMAL(65,30),
    "lastComputedAt" TIMESTAMP(3),

    CONSTRAINT "MlUserProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "SeasonalEvent" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "bonusClass" TEXT NOT NULL,
    "xpMultiplier" DECIMAL(65,30) NOT NULL,
    "limitedItemIds" TEXT[],

    CONSTRAINT "SeasonalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Habit_userId_year_month_idx" ON "Habit"("userId", "year", "month");

-- CreateIndex
CREATE INDEX "Completion_userId_date_idx" ON "Completion"("userId", "date");

-- CreateIndex
CREATE INDEX "Completion_habitId_date_idx" ON "Completion"("habitId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_key_key" ON "Achievement"("key");

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Completion" ADD CONSTRAINT "Completion_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Completion" ADD CONSTRAINT "Completion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStats" ADD CONSTRAINT "UserStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ShopItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BossBattle" ADD CONSTRAINT "BossBattle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestChain" ADD CONSTRAINT "QuestChain_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rival" ADD CONSTRAINT "Rival_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rival" ADD CONSTRAINT "Rival_rivalId_fkey" FOREIGN KEY ("rivalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MlUserProfile" ADD CONSTRAINT "MlUserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
