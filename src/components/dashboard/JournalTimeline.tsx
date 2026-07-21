"use client";

import { useEffect, useState } from "react";
import { Sword, Sparkles, Zap, Loader2, BookOpen, Clock, Calendar } from "lucide-react";
import { useLabels } from "@/hooks/useLabels";

interface JournalEntry {
  id: string;
  date: string;
  completedAt: string;
  note: string;
  habitName: string;
  habitClass: string;
}

export default function JournalTimeline() {
  const labels = useLabels();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchJournal = async (targetPage: number, append = false) => {
    if (targetPage === 1) {
      setIsLoading(true);
    } else {
      setIsFetchingMore(true);
    }
    setError(null);

    try {
      const res = await fetch(`/api/journal?page=${targetPage}`);
      if (!res.ok) {
        throw new Error("Failed to load journal entries");
      }
      const data = await res.json();
      
      setEntries((prev) => (append ? [...prev, ...data.data] : data.data));
      setHasNextPage(data.pagination.hasNextPage);
      setPage(data.pagination.page);
    } catch (err) {
      const errorObj = err as Error;
      setError(errorObj.message);
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
    }
  };

  useEffect(() => {
    fetchJournal(1);
  }, []);

  const handleLoadMore = () => {
    if (isFetchingMore || !hasNextPage) return;
    fetchJournal(page + 1, true);
  };

  const getClassIcon = (habitClass: string) => {
    switch (habitClass) {
      case "warrior":
        return <Sword className="h-4.5 w-4.5 text-red-400" />;
      case "mage":
        return <Sparkles className="h-4.5 w-4.5 text-indigo-400" />;
      case "rogue":
        return <Zap className="h-4.5 w-4.5 text-yellow-400" />;
      default:
        return <BookOpen className="h-4.5 w-4.5 text-purple-400" />;
    }
  };

  const getClassBgColor = (habitClass: string) => {
    switch (habitClass) {
      case "warrior":
        return "rgba(239, 68, 68, 0.15)";
      case "mage":
        return "rgba(99, 102, 241, 0.15)";
      case "rogue":
        return "rgba(234, 179, 8, 0.15)";
      default:
        return "rgba(168, 85, 247, 0.15)";
    }
  };

  const getClassBorderColor = (habitClass: string) => {
    switch (habitClass) {
      case "warrior":
        return "rgba(239, 68, 68, 0.3)";
      case "mage":
        return "rgba(99, 102, 241, 0.3)";
      case "rogue":
        return "rgba(234, 179, 8, 0.3)";
      default:
        return "rgba(168, 85, 247, 0.3)";
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return { dateString: dateStr, timeString: "" };
      
      const dateString = d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      
      const timeString = d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

      return { dateString, timeString };
    } catch {
      return { dateString: dateStr, timeString: "" };
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        <span className="text-sm text-slate-400 font-bold uppercase tracking-wider">
          Reading {labels.habitSingular} Logs...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-xl p-6 border text-center flex flex-col justify-center items-center gap-2 max-w-md mx-auto"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "rgba(239, 68, 68, 0.2)",
          color: "var(--danger)",
        }}
      >
        <span className="font-bold">Failed to load journal</span>
        <span className="text-xs text-slate-400">{error}</span>
        <button
          onClick={() => fetchJournal(1)}
          className="mt-4 px-4 py-2 rounded-lg bg-slate-800 text-xs font-bold text-white hover:bg-slate-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 px-4 text-center max-w-xl mx-auto"
        style={{ borderColor: "var(--border)" }}
      >
        <BookOpen className="h-12 w-12 mb-4 text-slate-500" />
        <p className="text-lg font-bold" style={{ color: "var(--text-secondary)" }}>
          No {labels.habitSingular.toLowerCase()} journal entries yet
        </p>
        <p className="text-sm mt-1 max-w-xs" style={{ color: "var(--text-muted)" }}>
          Add an optional note whenever you complete a {labels.habitSingular.toLowerCase()} on your tracker to document your journey here.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto relative px-4">
      {/* Central Timeline Line */}
      <div
        className="absolute left-[33px] top-4 bottom-4 w-[2px]"
        style={{ backgroundColor: "var(--border)" }}
      />

      <div className="space-y-8 relative">
        {entries.map((entry) => {
          const { dateString, timeString } = formatDateTime(entry.completedAt);
          return (
            <div key={entry.id} className="flex gap-6 items-start group">
              {/* Icon Node Container */}
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border z-10 transition-transform group-hover:scale-105"
                style={{
                  backgroundColor: getClassBgColor(entry.habitClass),
                  borderColor: getClassBorderColor(entry.habitClass),
                }}
              >
                {getClassIcon(entry.habitClass)}
              </div>

              {/* Message Details Bubble */}
              <div
                className="flex-1 rounded-2xl border p-5 shadow-sm transition-colors hover:border-slate-700"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  borderColor: "var(--border)",
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 pb-2 border-b" style={{ borderColor: "var(--border)" }}>
                  <h3 className="text-sm font-black text-white capitalize tracking-tight">
                    {entry.habitName}
                  </h3>
                  <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {dateString}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeString}
                    </span>
                  </div>
                </div>

                <p className="text-xs leading-relaxed italic text-purple-200 pl-2 border-l-2 border-purple-500">
                  &ldquo;{entry.note}&rdquo;
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Load More control */}
      {hasNextPage && (
        <div className="flex justify-center mt-10">
          <button
            onClick={handleLoadMore}
            disabled={isFetchingMore}
            className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-bold uppercase tracking-wider transition-colors min-w-[140px] text-white"
            style={{
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            {isFetchingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                Loading...
              </>
            ) : (
              "Load More Entries"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
