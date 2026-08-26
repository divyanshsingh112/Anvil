"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Swords, ShoppingBag, Trophy, User, Coins, BookOpen, LogOut, Users, Settings, CalendarCheck, Menu, X } from "lucide-react";
import { useLabels } from "@/hooks/useLabels";
import ConsentPromptModal from "@/components/modals/ConsentPromptModal";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { coins, level, fetchUserStats } = useUserStore();
  const labels = useLabels();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    fetchUserStats();
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  // Handle ESC key to close drawer & lock background scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDrawerOpen(false);
      }
    };

    if (isDrawerOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDrawerOpen]);

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: Swords },
    { label: labels.journalLabel, href: "/journal", icon: BookOpen },
    { label: "Rivals", href: "/rivals", icon: Users },
    { label: "Shop", href: "/shop", icon: ShoppingBag },
    { label: labels.leaderboardLabel, href: "/leaderboard", icon: Trophy },
    { label: "Profile", href: "/profile", icon: User },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  const isItemActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    if (href === "/habits") {
      return pathname === "/habits" || pathname.startsWith("/habits/") || pathname.startsWith("/year");
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

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

          {/* Navigation Links (Desktop 768px+) */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = isItemActive(item.href);

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

          {/* User Status Stats & Action Widget */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Coins */}
            <div
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-bold"
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
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-bold"
              style={{
                backgroundColor: "rgba(168, 85, 247, 0.15)",
                borderColor: "rgba(168, 85, 247, 0.3)",
                color: "#c084fc",
              }}
              title={`Your Active ${labels.levelLabel}`}
            >
              <span>{labels.levelLabel === "Level" ? "LVL" : labels.levelLabel.toUpperCase()} {level}</span>
            </div>

            {/* Desktop Log Out Button */}
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-200 hover:bg-red-500/20 hover:border-red-500/40 text-red-400 border-red-500/20"
              title="Log out of session"
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out</span>
            </button>

            {/* Mobile Hamburger Button (<768px) */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen((prev) => !prev)}
              aria-label={isDrawerOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={isDrawerOpen}
              className="flex md:hidden items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border transition-all duration-200"
              style={{
                backgroundColor: "var(--bg-secondary)",
                borderColor: "var(--border)",
                color: isDrawerOpen ? "var(--accent-purple)" : "var(--text-primary)",
              }}
            >
              {isDrawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Backdrop & Sheet (<768px) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex justify-end">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer sheet panel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation drawer"
            className="relative z-10 w-[280px] max-w-[85vw] h-full flex flex-col border-l shadow-2xl overflow-y-auto"
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--border)",
            }}
          >
            {/* Drawer Header */}
            <div
              className="h-16 px-4 flex items-center justify-between border-b shrink-0"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{
                    background: "linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-teal) 100%)",
                  }}
                >
                  <Swords className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-black tracking-wider text-white">ANVIL</span>
              </div>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close navigation menu"
                className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border transition-all duration-200"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Navigation Links */}
            <nav className="flex-1 p-4 flex flex-col gap-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = isItemActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsDrawerOpen(false)}
                    className="flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-lg text-xs font-bold tracking-wide uppercase transition-all duration-200 w-full"
                    style={{
                      color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                      backgroundColor: isActive ? "var(--bg-tertiary)" : "transparent",
                    }}
                  >
                    <Icon
                      className="h-4 w-4 shrink-0"
                      style={{
                        color: isActive ? "var(--accent-purple)" : "inherit",
                      }}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Drawer Footer with Logout */}
            <div
              className="p-4 border-t mt-auto shrink-0"
              style={{ borderColor: "var(--border)" }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  handleLogout();
                }}
                className="flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 w-full border"
                style={{
                  backgroundColor: "var(--bg-primary)",
                  borderColor: "var(--border)",
                  color: "var(--danger)",
                }}
              >
                <LogOut className="h-4 w-4" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">{children}</div>

      {/* One-Time First-Login AI Consent Prompt Modal */}
      <ConsentPromptModal />
    </div>
  );
}

