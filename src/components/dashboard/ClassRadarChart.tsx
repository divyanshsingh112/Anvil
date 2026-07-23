"use client";

import { useEffect, useState } from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import { Loader2, Shield } from "lucide-react";
import { useLabels } from "@/hooks/useLabels";
import { useUserStore } from "@/store/useUserStore";
import AvatarBuilder from "@/components/gamification/AvatarBuilder";

interface AttributeData {
  strScore: number;
  intScore: number;
  wisScore: number;
  chaScore: number;
}

export default function ClassRadarChart() {
  const labels = useLabels();
  const { warriorCompletions, mageCompletions, rogueCompletions, fetchUserStats } = useUserStore();
  const [attrs, setAttrs] = useState<AttributeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAttributes();
    fetchUserStats();
  }, [fetchUserStats]);

  const fetchAttributes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/attributes");
      if (!res.ok) throw new Error("Failed to load attributes");
      const data: AttributeData = await res.json();
      setAttrs(data);
    } catch (err) {
      const errorObj = err as Error;
      setError(errorObj.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className="stat-card flex flex-col items-center justify-center"
        style={{ minHeight: "320px" }}
      >
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2">
          Loading attributes...
        </span>
      </div>
    );
  }

  if (error || !attrs) {
    return (
      <div
        className="stat-card flex flex-col items-center justify-center"
        style={{ minHeight: "320px" }}
      >
        <Shield className="h-6 w-6 text-red-500" />
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2">
          Failed to load attributes
        </span>
      </div>
    );
  }

  const chartData = [
    { attribute: labels.attrStr, value: attrs.strScore, fullMark: 100 },
    { attribute: labels.attrInt, value: attrs.intScore, fullMark: 100 },
    { attribute: labels.attrWis, value: attrs.wisScore, fullMark: 100 },
    { attribute: labels.attrCha, value: attrs.chaScore, fullMark: 100 },
  ];

  return (
    <div className="stat-card" style={{ minHeight: "320px" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{
            backgroundColor: "rgba(124, 58, 237, 0.15)",
            border: "1px solid rgba(124, 58, 237, 0.3)",
          }}
        >
          <Shield className="h-4 w-4" style={{ color: "var(--accent-purple)" }} />
        </div>
        <div>
          <span
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            {labels.habitSingular === "Quest" ? "Class Attributes" : labels.habitSingular === "Lap" ? "Performance Stats" : labels.habitSingular === "Drill" ? "Skill Attributes" : "Habit Attributes"}
          </span>
        </div>
      </div>

      {/* Main Layout Area: Responsive Flex Container */}
      <div className="flex flex-col md:flex-row items-center gap-6 mt-4">
        {/* Left Panel: Compact Avatar Builder */}
        <div className="flex-shrink-0">
          <AvatarBuilder
            warriorCompletions={warriorCompletions}
            mageCompletions={mageCompletions}
            rogueCompletions={rogueCompletions}
            size={76}
          />
        </div>

        {/* Right Panel: Recharts Radar Chart */}
        <div className="flex-1 w-full">
          <ResponsiveContainer width="100%" height={210}>
            <RadarChart cx="50%" cy="50%" outerRadius="65%" data={chartData}>
              <PolarGrid
                stroke="var(--border)"
                strokeOpacity={0.6}
              />
              <PolarAngleAxis
                dataKey="attribute"
                tick={{
                  fill: "var(--text-secondary)",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <Radar
                name="Attributes"
                dataKey="value"
                stroke="var(--accent-purple)"
                strokeWidth={2}
                fill="var(--accent-purple)"
                fillOpacity={0.25}
                animationDuration={800}
                animationEasing="ease-out"
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Score Labels */}
      <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
        {chartData.map((d) => (
          <div key={d.attribute} className="text-center">
            <div
              className="text-xs font-black"
              style={{ color: "var(--text-primary)" }}
            >
              {d.value}
            </div>
            <div
              className="text-[9px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              {d.attribute}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
