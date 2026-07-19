"use client";

import { useEffect, useState } from "react";

interface HeatmapProps {
  year: number;
  month: number;
}

interface HeatmapEntry {
  date: string;
  count: number;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getHeatColor(count: number): string {
  if (count === 0) return "var(--heat-0)";
  if (count === 1) return "var(--heat-1)";
  if (count === 2) return "var(--heat-2)";
  return "var(--heat-3)"; // 3+
}

function getTooltip(count: number): string {
  if (count === 0) return "No quests completed";
  if (count === 1) return "1 quest completed";
  return `${count} quests completed`;
}

export default function Heatmap({ year, month }: HeatmapProps) {
  const [data, setData] = useState<HeatmapEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHeatmap = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/completions/heatmap?year=${year}&month=${month}`
        );
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Failed to fetch heatmap data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHeatmap();
  }, [year, month]);

  // Build a lookup of date -> count
  const countMap: Record<string, number> = {};
  for (const entry of data) {
    countMap[entry.date] = entry.count;
  }

  // Build the calendar grid
  const daysInMonth = new Date(year, month, 0).getDate();
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Get the day-of-week for the 1st of the month (convert Sun=0 to Mon=0 system)
  const firstDayRaw = new Date(year, month - 1, 1).getDay();
  const firstDayMon = firstDayRaw === 0 ? 6 : firstDayRaw - 1; // Mon=0, Sun=6

  // Build rows: each row is a week, Mon-Sun
  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = new Array(firstDayMon).fill(null);

  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  // Pad the last week
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  if (isLoading) {
    return (
      <div
        className="rounded-xl border p-5"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        <h3
          className="text-sm font-bold uppercase tracking-wider mb-4"
          style={{ color: "var(--text-secondary)" }}
        >
          Completion Heatmap
        </h3>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-sm font-bold uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
        >
          Completion Heatmap
        </h3>
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Less
          </span>
          {[0, 1, 2, 3].map((level) => (
            <div
              key={level}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: `var(--heat-${level})` }}
            />
          ))}
          <span
            className="text-[10px] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            More
          </span>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="heatmap-grid" style={{ gridTemplateColumns: `auto repeat(7, 1fr)` }}>
        {/* Header row */}
        <div /> {/* empty corner */}
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-[10px] font-bold uppercase tracking-wider pb-1"
            style={{ color: "var(--text-muted)" }}
          >
            {label}
          </div>
        ))}

        {/* Week rows */}
        {weeks.map((week, weekIdx) => (
          <>
            <div key={`label-${weekIdx}`} className="heatmap-label">
              W{weekIdx + 1}
            </div>
            {week.map((day, dayIdx) => {
              if (day === null) {
                return (
                  <div
                    key={`empty-${weekIdx}-${dayIdx}`}
                    className="heatmap-cell"
                    style={{ backgroundColor: "transparent" }}
                  />
                );
              }

              const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const count = countMap[dateStr] || 0;
              const isToday = dateStr === todayStr;

              return (
                <div
                  key={dateStr}
                  className={`heatmap-cell ${isToday ? "heatmap-cell--today" : ""}`}
                  style={{ backgroundColor: getHeatColor(count) }}
                  title={`${day}: ${getTooltip(count)}`}
                />
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
