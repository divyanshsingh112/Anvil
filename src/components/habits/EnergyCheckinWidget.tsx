"use client";

import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { FEATURE_ENERGY_CHECKIN } from "@/config/features";

interface EnergyCheckinWidgetProps {
  onEnergyChanged?: (level: "low" | "medium" | "high") => void;
}

export default function EnergyCheckinWidget({ onEnergyChanged }: EnergyCheckinWidgetProps) {
  const [selectedLevel, setSelectedLevel] = useState<"low" | "medium" | "high" | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!FEATURE_ENERGY_CHECKIN) {
      setIsLoading(false);
      return;
    }

    const fetchEnergy = async () => {
      try {
        const res = await fetch("/api/user/energy-checkin");
        if (res.ok) {
          const data = await res.json();
          setSelectedLevel(data.level);
        }
      } catch (err) {
        console.error("Failed to fetch energy checkin", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEnergy();
  }, []);

  if (!FEATURE_ENERGY_CHECKIN || isLoading) return null;

  const handleSelect = async (level: "low" | "medium" | "high") => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const prev = selectedLevel;
    setSelectedLevel(level);

    try {
      const res = await fetch("/api/user/energy-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level }),
      });

      if (!res.ok) {
        setSelectedLevel(prev);
      } else if (onEnergyChanged) {
        onEnergyChanged(level);
      }
    } catch (err) {
      console.error(err);
      setSelectedLevel(prev);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="rounded-xl border p-4 shadow-sm mb-4 transition-all"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400 fill-amber-400" />
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            How&apos;s your energy today?
          </span>
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            (Optional)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSelect("low")}
            disabled={isSubmitting}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              selectedLevel === "low"
                ? "bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-sm"
                : "bg-slate-800/40 text-slate-400 border-slate-700/60 hover:bg-slate-800"
            }`}
          >
            ⚡ Low
          </button>
          <button
            type="button"
            onClick={() => handleSelect("medium")}
            disabled={isSubmitting}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              selectedLevel === "medium"
                ? "bg-blue-500/20 text-blue-300 border-blue-500/60 shadow-sm"
                : "bg-slate-800/40 text-slate-400 border-slate-700/60 hover:bg-slate-800"
            }`}
          >
            ⚡ Medium
          </button>
          <button
            type="button"
            onClick={() => handleSelect("high")}
            disabled={isSubmitting}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              selectedLevel === "high"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-sm"
                : "bg-slate-800/40 text-slate-400 border-slate-700/60 hover:bg-slate-800"
            }`}
          >
            ⚡ High
          </button>
        </div>
      </div>
    </div>
  );
}
