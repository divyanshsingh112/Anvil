"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /habits now redirects to the current year/month tracker.
 * This keeps old bookmarks and links functional.
 */
export default function HabitsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    router.replace(`/year/${year}/month/${month}`);
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-3">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500" />
        <p style={{ color: "var(--text-secondary)" }}>
          Redirecting to your current quest journal...
        </p>
      </div>
    </main>
  );
}
