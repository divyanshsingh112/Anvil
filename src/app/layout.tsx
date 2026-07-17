import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anvil — Gamified Habit Tracker",
  description: "Forge unbreakable habits through gamification",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
