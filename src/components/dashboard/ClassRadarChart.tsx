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
      <div className="glass-card rounded-2xl p-6 border flex flex-col items-center justify-center min-h-[320px]">
        <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
        <span className="font-geist text-xs text-slate-400 font-bold uppercase tracking-wider mt-3">
          Loading attributes...
        </span>
      </div>
    );
  }

  if (error || !attrs) {
    return (
      <div className="glass-card rounded-2xl p-6 border flex flex-col items-center justify-center min-h-[320px]">
        <Shield className="h-6 w-6 text-rose-500" />
        <span className="font-geist text-xs text-slate-400 font-bold uppercase tracking-wider mt-3">
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
    <div className="glass-card rounded-2xl p-6 border border-slate-700/60 min-h-[320px] transition-all duration-300">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-500/30 shadow-md">
          <Shield className="h-4 w-4 text-purple-400" />
        </div>
        <div>
          <h3 className="font-geist text-xs font-extrabold uppercase tracking-widest text-slate-300">
            {labels.habitSingular === "Quest" ? "Class Attributes" : labels.habitSingular === "Lap" ? "Performance Stats" : labels.habitSingular === "Drill" ? "Skill Attributes" : "Habit Attributes"}
          </h3>
        </div>
      </div>

      {/* Main Layout Area */}
      <div className="flex flex-col md:flex-row items-center gap-6 mt-2">
        {/* Compact Avatar Builder */}
        <div className="flex-shrink-0">
          <AvatarBuilder
            warriorCompletions={warriorCompletions}
            mageCompletions={mageCompletions}
            rogueCompletions={rogueCompletions}
            size={84}
          />
        </div>

        {/* Recharts Radar Chart */}
        <div className="flex-1 w-full">
          <ResponsiveContainer width="100%" height={210}>
            <RadarChart cx="50%" cy="50%" outerRadius="65%" data={chartData}>
              <PolarGrid stroke="#334155" strokeOpacity={0.8} />
              <PolarAngleAxis
                dataKey="attribute"
                tick={{
                  fill: "#cbd5e1",
                  fontSize: 11,
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
                stroke="#8b5cf6"
                strokeWidth={2.5}
                fill="#8b5cf6"
                fillOpacity={0.3}
                animationDuration={800}
                animationEasing="ease-out"
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Score Labels Grid */}
      <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-700/60">
        {chartData.map((d) => (
          <div key={d.attribute} className="text-center">
            <div className="font-sora text-base font-black text-white">
              {d.value}
            </div>
            <div className="font-geist text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              {d.attribute}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
