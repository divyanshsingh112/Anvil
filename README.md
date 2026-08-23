# Anvil

> **Live Application**: [https://anvilapp.online](https://anvilapp.online)

Most habit trackers end up feeling like glorified to-do lists or spreadsheets you eventually feel guilty for ignoring. I built Anvil because I wanted habit building to feel more like playing an RPG: something with progression, real stakes, and genuine mechanics that keep you showing up every day.

What started as a personal project to fix my own consistency issues turned into a full-featured web app with real users, custom machine learning analytics, and competitive multiplayer features.

---

## What Anvil Does

### 1. Habit Tracking & Core Progression
Every habit you create has a class (*Warrior*, *Mage*, or *Rogue*) and a difficulty tier (*Novice*, *Adept*, *Master*). When you check off a habit on the monthly calendar grid, you don't just increment a streak—you earn XP and coins, level up your character, and build your momentum.

If you miss a day, your streak takes a hit unless you've earned a **Streak Freeze** from the shop or built up enough buffer.

### 2. The Rival System (1v1 Habit Duels)
Instead of vague social accountability, Anvil lets you challenge other users to direct 1v1 duels over specific habits. You set the duration (e.g., 7 or 14 days), pick the habit, and see who logs more completions before the clock runs out. Duels have custom defeat messages and win/loss records tracked directly on your profile.

### 3. Quest Chains (Habit Stacking)
James Clear's *Atomic Habits* popularized habit stacking—chaining multiple small habits together so one triggers the next. In Anvil, you can group habits into **Quest Chains** (like a morning routine: *Hydrate -> 10min Stretch -> Read 5 Pages*). Completing an entire chain rewards bonus XP and chain-mastery achievements.

### 4. Custom Themes & Terminology Packs
Not everyone wants to read RPG jargon. Anvil lets you completely change both the UI aesthetic and the terminology across the entire app:
- **RPG Mode**: Quests, XP, Bosses, Duels, Classes.
- **Racing Theme**: Laps, Pit Stops, Horsepower, Rivals.
- **Sports Theme**: Drills, Training, Matchups, Conditioning.
- **Plain / Minimalist**: Clean, no-nonsense habit and task terminology with sleek dark theme palettes.

You can unlock additional themes (Cyberpunk, Forest Cloak, Midnight Mode) in the shop using the coins you earn from staying consistent.

### 5. Avatar Builder
A retro-styled modular SVG avatar creator where you can customize your character's base sprite, hair, armor, facial expressions, and accessories to represent your persona on the global leaderboard and in rival duels.

### 6. Behavioral Machine Learning & AI Insights
Instead of just showing static completion charts, Anvil computes several statistical and ML models on top of your 30-day completion history:
- **Momentum Score**: A decay-weighted composite (0–100) that models habit momentum rather than just raw streak count.
- **Procrastination Fingerprint**: Calculates your **Average Execution Window** via temporal centroid math ($\sum (\text{hour} \times \text{count}) / \sum \text{count}$) to highlight daytime postponement, tracks your late-night completion rate (after 10 PM), and detects **Avoidance Substitution Patterns** (e.g., whether you consistently skip study habits on days you over-index on workouts).
- **Habit Autopsy (Gemini AI)**: When a habit is struggling or stalling, you can request an autopsy. The app feeds your past 30 days of metrics, class distribution, and difficulty trends into Google Gemini to generate a specific, actionable post-mortem on why that habit is failing and how to tweak it.
- **Adaptive Difficulty Evaluator**: Detects when a habit has become too easy (or unmanageably difficult) and prompts you with cooldown-protected difficulty upgrades or downgrades.

---

## Screenshots

| Dashboard & Overview | Monthly Habit Grid |
| :---: | :---: |
| ![Dashboard](./screenshots/dashboard.png) | ![Month Tracker](./screenshots/month_tracker.png) |

| 1v1 Rival Duels | ML Procrastination Fingerprint |
| :---: | :---: |
| ![Rival Duel](./screenshots/rival_duel.png) | ![ML Fingerprint](./screenshots/ml_fingerprint.png) |

---

## Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router, Server Components & Route Handlers)
- **Database**: [PostgreSQL](https://www.postgresql.org/) via [Supabase](https://supabase.com/)
- **ORM**: [Prisma 7](https://www.prisma.io/) with `@prisma/adapter-pg` connection pooling
- **Authentication**: [NextAuth.js](https://next-auth.js.org/) (JWT strategy with Credentials & Google OAuth)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + CSS variables for dynamic runtime theme swapping
- **AI & Analytics**: [Google Gemini 3.6 Flash](https://ai.google.dev/) (`gemini-3.6-flash`) for Habit Autopsy & custom statistical algorithms for behavioral archetyping
- **Charts & Icons**: [Recharts](https://recharts.org/) and [Lucide React](https://lucide.dev/)
- **Deployment**: [Vercel](https://vercel.com/)

---

## Getting Started (Local Development)

If you'd like to run Anvil locally or contribute, follow these steps:

### 1. Clone the repository
```bash
git clone https://github.com/divyanshsingh112/Anvil.git
cd Anvil
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env.local` file in the root directory and fill in the required keys:

```env
# Database (PostgreSQL / Supabase connection strings)
DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# NextAuth Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-generated-32-byte-secret"

# Optional OAuth Providers
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# AI / ML Features
GEMINI_API_KEY="your-google-gemini-api-key"

# Cron & System Secrets
CRON_SECRET="your-cron-secret-string"
ANON_SYSTEM_SECRET="your-anon-system-secret"
```

### 4. Run database migrations & seed items
```bash
# Push schema migrations to your database
npx prisma migrate dev

# Seed default shop items and achievements
node prisma/seed.js
```

### 5. Start the local dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the app.

---

## Built By

Built by **Divyansh Singh** as a full-stack exploration into behavioral psychology, gamification mechanics, and machine learning analytics.

If you have feedback, feature ideas, or find a bug, feel free to open an issue or reach out!
