import type { Metadata } from "next";
import AuthProvider from "@/components/shared/AuthProvider";
import ThemeApplier from "@/components/gamification/ThemeApplier";
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
        <AuthProvider>
          <ThemeApplier />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
