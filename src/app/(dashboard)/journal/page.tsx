"use client";

import JournalTimeline from "@/components/dashboard/JournalTimeline";
import { BookOpen } from "lucide-react";

export default function JournalPage() {
  return (
    <main className="min-h-screen px-4 py-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="border-b pb-6" style={{ borderColor: "var(--border)" }}>
        <h1
          className="text-3xl font-extrabold tracking-tight flex items-center gap-2"
          style={{ color: "var(--text-primary)" }}
        >
          <BookOpen className="h-7 w-7 text-purple-400" />
          Quest Journal
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          A scrollable history of your quest achievements and diary logs.
        </p>
      </div>

      {/* Timeline Component */}
      <JournalTimeline />
    </main>
  );
}
