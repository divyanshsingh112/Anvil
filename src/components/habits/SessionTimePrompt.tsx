"use client";

import { useHabitStore } from "@/store/useHabitStore";

interface SessionTimePromptProps {
  onResolve: () => void;
}

export default function SessionTimePrompt({ onResolve }: SessionTimePromptProps) {
  const { setSessionTimeBucket } = useHabitStore();

  const handleSelect = (bucket: "morning" | "afternoon" | "evening" | "night" | null) => {
    // Save to store
    setSessionTimeBucket(bucket);
    // Mark as shown in sessionStorage to prevent popping up again this tab session
    sessionStorage.setItem("anvil_session_time_bucket_prompt_resolved", "true");
    onResolve();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-xl border p-8 shadow-2xl space-y-6"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        <div className="text-center">
          <h2
            className="text-2xl font-black tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Morning Briefing
          </h2>
          <p
            className="mt-2 text-sm font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            When did you complete most of your quests today?
          </p>
        </div>

        <div className="grid gap-3">
          {[
            { label: "🌅 Morning (5am - 11am)", value: "morning" },
            { label: "☀️ Afternoon (12pm - 4pm)", value: "afternoon" },
            { label: "🌆 Evening (5pm - 9pm)", value: "evening" },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => handleSelect(item.value as "morning" | "afternoon" | "evening")}
              className="w-full rounded-lg border py-3 text-sm font-bold transition-all hover:scale-[1.01] active:scale-[0.99] hover:opacity-90"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            >
              {item.label}
            </button>
          ))}
          
          <button
            onClick={() => handleSelect(null)}
            className="w-full rounded-lg border border-dashed py-3 text-sm font-bold opacity-75 transition-all hover:opacity-100"
            style={{
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            Mixed / Derive from current hour
          </button>
        </div>
      </div>
    </div>
  );
}
