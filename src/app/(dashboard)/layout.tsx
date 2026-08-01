"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { Swords, ShoppingBag, Trophy, User, Coins, BookOpen, LogOut, Users } from "lucide-react";
import { useLabels } from "@/hooks/useLabels";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { coins, level, fetchUserStats } = useUserStore();
  const labels = useLabels();

  useEffect(() => {
    fetchUserStats();
  }, []);

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: Swords },
    { label: labels.habitSingular === "Quest" ? "Journal" : `${labels.habitSingular} Journal`, href: "/journal", icon: BookOpen },
    { label: "Rivals", href: "/rivals", icon: Users },
    { label: "Shop", href: "/shop", icon: ShoppingBag },
    { label: labels.leaderboardLabel, href: "/leaderboard", icon: Trophy },
    { label: "Profile", href: "/profile", icon: User },
  ];

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Premium Top Navigation Bar */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-md"
        style={{
          backgroundColor: "rgba(10, 10, 12, 0.8)",
          borderColor: "var(--border)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{
                background: "linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-teal) 100%)",
              }}
            >
              <Swords className="h-5 w-5 text-white animate-pulse" />
            </div>
            <span className="text-lg font-black tracking-wider text-white">ANVIL</span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold tracking-wide uppercase transition-all duration-200"
                  style={{
                    color: isActive ? "white" : "var(--text-secondary)",
                    backgroundColor: isActive ? "var(--bg-tertiary)" : "transparent",
                  }}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-purple-400" : ""}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Status Stats & Logout Widget */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Coins */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold"
              style={{
                backgroundColor: "var(--bg-secondary)",
                borderColor: "var(--border)",
              }}
            >
              <Coins className="h-4 w-4 text-yellow-500" />
              <span className="text-yellow-400">{coins}</span>
            </div>

            {/* Level */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold"
              style={{
                backgroundColor: "rgba(168, 85, 247, 0.15)",
                borderColor: "rgba(168, 85, 247, 0.3)",
                color: "#c084fc",
              }}
              title={`Your Active ${labels.levelLabel}`}
            >
              <span>{labels.levelLabel === "Level" ? "LVL" : labels.levelLabel.toUpperCase()} {level}</span>
            </div>

            {/* Log Out Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-200 hover:bg-red-500/20 hover:border-red-500/40 text-red-400 border-red-500/20"
              title="Log out of session"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">Log Out</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Links (shown below top bar on mobile) */}
        <div
          className="flex sm:hidden border-t items-center justify-around py-2"
          style={{ borderColor: "var(--border)" }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1 text-[9px] font-bold uppercase tracking-wider transition-all duration-200"
                style={{
                  color: isActive ? "white" : "var(--text-muted)",
                }}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-purple-400" : ""}`} />
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-red-400 transition-all duration-200"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}
