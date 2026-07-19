@echo off
echo ==========================================
echo   ANVIL - Gamified Habit Tracker
echo   Starting Development Server...
echo ==========================================
echo.

cd /d "%~dp0"

:: Check if node_modules exists
if not exist "node_modules" (
    echo [!] node_modules not found. Installing dependencies...
    call npm install
    echo.
)

:: Generate Prisma client if needed
echo [*] Ensuring Prisma client is up to date...
call npx prisma generate
echo.

echo [*] Starting Next.js dev server on http://localhost:3000
echo [*] Press Ctrl+C to stop
echo.

call npm run dev
