-- CreateIndex
CREATE UNIQUE INDEX "Completion_userId_habitId_date_key" ON "Completion"("userId", "habitId", "date");
