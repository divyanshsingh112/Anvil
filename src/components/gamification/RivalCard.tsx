"use client";

import { useState, memo } from "react";
import { Swords, Calendar, MessageSquare, ShieldAlert, Check, X, Loader2 } from "lucide-react";

interface HabitItem {
  id: string;
  name: string;
}

interface RivalCardProps {
  duel: any;
  userId: string;
  userHabits?: HabitItem[];
  type: "active" | "pending-incoming" | "pending-outgoing" | "history";
  onActionSuccess?: () => void;
}

function RivalCardComponent({
  duel,
  userId,
  userHabits = [],
  type,
  onActionSuccess,
}: RivalCardProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [selectedHabitId, setSelectedHabitId] = useState("");
  const [showHabitSelect, setShowHabitSelect] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [isSubmittingDefeatMsg, setIsSubmittingDefeatMsg] = useState(false);
  const [defeatMsg, setDefeatMsg] = useState("");
  const [error, setError] = useState("");

  const isChallenger = duel.challengerId === userId;
  const userCount = isChallenger ? duel.challengerCount : duel.rivalCount;
  const opponentCount = isChallenger ? duel.rivalCount : duel.challengerCount;
  const opponentName = isChallenger ? (duel.rivalName || "Rival") : (duel.challengerName || "Rival");

  // Respond handlers
  const handleDecline = async () => {
    setIsDeclining(true);
    setError("");
    try {
      const res = await fetch("/api/rivals/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rivalId: duel.id, action: "decline" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to decline");
      }
      onActionSuccess?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsDeclining(false);
    }
  };

  const handleAccept = async () => {
    if (!selectedHabitId) {
      setError("Please select a habit to link");
      return;
    }
    setIsAccepting(true);
    setError("");
    try {
      const res = await fetch("/api/rivals/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rivalId: duel.id,
          action: "accept",
          habitId: selectedHabitId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to accept");
      }
      setShowHabitSelect(false);
      onActionSuccess?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsAccepting(false);
    }
  };

  // Submit Defeat Message handler
  const handleSubmitDefeatMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!defeatMsg.trim()) return;
    setIsSubmittingDefeatMsg(true);
    setError("");
    try {
      const res = await fetch("/api/rivals/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rivalId: duel.id, defeatMessage: defeatMsg }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit message");
      }
      onActionSuccess?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSubmittingDefeatMsg(false);
    }
  };

  // Render variables
  const isWinner = duel.winnerId === userId;
  const isLoser = duel.winnerId && duel.winnerId !== userId;
  const isTie = duel.winnerId === null && duel.status === "completed";

  return (
    <div
      className="rounded-xl border p-5 transition-all duration-300 relative overflow-hidden flex flex-col gap-3"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderColor: type === "active" ? "var(--accent-purple)" : "var(--border)",
        boxShadow: type === "active" ? "0 4px 20px -2px rgba(124, 58, 237, 0.15)" : "none",
      }}
    >
      {/* Glow highlight for active duels */}
      {type === "active" && (
        <div
          className="absolute top-0 right-0 left-0 h-1"
          style={{
            background: "linear-gradient(90deg, transparent 0%, var(--accent-purple) 50%, transparent 100%)",
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg border"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              borderColor: type === "active" ? "var(--accent-purple)" : "var(--border)",
            }}
          >
            <Swords
              className="h-4 w-4"
              style={{ color: type === "active" ? "var(--accent-purple)" : "var(--text-secondary)" }}
            />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-white tracking-tight">
              {duel.habitName}
            </h4>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {type === "active" && `vs ${opponentName}`}
              {type === "pending-incoming" && `Challenge from ${duel.challengerName}`}
              {type === "pending-outgoing" && `Challenged ${opponentName}`}
              {type === "history" && `vs ${opponentName} (${duel.status})`}
            </p>
          </div>
        </div>

        {type === "active" && (
          <div className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--accent-gold)" }}>
            <Calendar className="h-3 w-3" />
            <span>{duel.daysRemaining} days left</span>
          </div>
        )}

        {type === "history" && (
          <div className="text-xs font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
            {isWinner && <span style={{ color: "var(--accent-teal)" }}>Victory</span>}
            {isLoser && <span style={{ color: "var(--accent-purple)" }}>Defeat</span>}
            {isTie && <span style={{ color: "var(--text-secondary)" }}>Tie</span>}
            {duel.status === "declined" && <span style={{ color: "var(--text-muted)" }}>Declined</span>}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500 bg-red-500/10 p-2 rounded">{error}</p>}

      {/* Body contents by type */}
      {type === "active" && (
        <div className="flex flex-col gap-3 mt-1">
          {/* Progress bar comparison */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-white flex justify-between">
                <span>You</span>
                <span className="font-extrabold text-accent-purple">{userCount}</span>
              </span>
              <div className="h-2 w-full bg-slate-800 rounded overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded transition-all duration-500"
                  style={{ width: `${Math.min(100, (userCount / Math.max(1, userCount + opponentCount)) * 100)}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-white flex justify-between">
                <span>{opponentName}</span>
                <span className="font-extrabold text-slate-400">{opponentCount}</span>
              </span>
              <div className="h-2 w-full bg-slate-800 rounded overflow-hidden">
                <div
                  className="h-full bg-slate-600 rounded transition-all duration-500"
                  style={{ width: `${Math.min(100, (opponentCount / Math.max(1, userCount + opponentCount)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {type === "pending-incoming" && (
        <div className="flex flex-col gap-2 mt-1">
          {!showHabitSelect ? (
            <div className="flex gap-2">
              <button
                onClick={() => setShowHabitSelect(true)}
                className="flex-1 px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center justify-center gap-1 transition"
              >
                <Check className="h-3.5 w-3.5" /> Accept
              </button>
              <button
                onClick={handleDecline}
                disabled={isDeclining}
                className="flex-1 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1 transition"
              >
                {isDeclining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Decline
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-3 rounded bg-slate-800/40 border border-slate-800">
              <label className="text-xs font-bold text-white">Select your habit for this duel:</label>
              <select
                value={selectedHabitId}
                onChange={(e) => setSelectedHabitId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white"
              >
                <option value="">-- Choose one of your habits --</option>
                {userHabits.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={handleAccept}
                  disabled={isAccepting}
                  className="flex-1 px-3 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center justify-center gap-1"
                >
                  {isAccepting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Link & Accept
                </button>
                <button
                  onClick={() => {
                    setShowHabitSelect(false);
                    setError("");
                  }}
                  className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {type === "pending-outgoing" && (
        <div className="text-xs text-slate-400 bg-slate-800/20 border border-dashed border-slate-800 p-2.5 rounded italic">
          Waiting for {opponentName} to accept the challenge on "{duel.habitName}"...
        </div>
      )}

      {type === "history" && (
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex justify-between text-slate-400 border-b border-slate-800 pb-1.5">
            <span>Final count:</span>
            <span>
              You: <strong className="text-white">{userCount}</strong> | {opponentName}: <strong className="text-white">{opponentCount}</strong>
            </span>
          </div>

          {/* Defeat message section */}
          {duel.defeatMessage ? (
            <div className="bg-slate-900/60 p-3 rounded border border-slate-800 flex gap-2 items-start mt-1">
              <MessageSquare className="h-3.5 w-3.5 text-purple-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Loser's Defeat Message</p>
                <p className="text-slate-300 italic mt-0.5">"{duel.defeatMessage}"</p>
              </div>
            </div>
          ) : isLoser && !duel.defeatMessage ? (
            <form onSubmit={handleSubmitDefeatMsg} className="flex flex-col gap-2 mt-1">
              <p className="font-semibold text-slate-300 flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5 text-yellow-500" />
                You lost this duel. Send a defeat message:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={200}
                  value={defeatMsg}
                  onChange={(e) => setDefeatMsg(e.target.value)}
                  placeholder="e.g. You were too fast for me this lap!..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                  required
                />
                <button
                  type="submit"
                  disabled={isSubmittingDefeatMsg}
                  className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs transition"
                >
                  {isSubmittingDefeatMsg ? "Sending..." : "Submit"}
                </button>
              </div>
            </form>
          ) : isWinner && !duel.defeatMessage ? (
            <div className="text-[11px] text-slate-500 italic mt-1">
              Waiting for the loser to submit their defeat message...
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default memo(RivalCardComponent);
