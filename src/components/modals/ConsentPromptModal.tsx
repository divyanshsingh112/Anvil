"use client";

import { useState } from "react";
import { useUserStore } from "@/store/useUserStore";
import { Sparkles, X, ShieldCheck, Check, Loader2 } from "lucide-react";

export default function ConsentPromptModal() {
  const { hasSeenConsentPrompt, lastFetched, markConsentPromptSeen } = useUserStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only render if stats have been loaded at least once AND user has not seen the prompt
  if (lastFetched === null || hasSeenConsentPrompt) {
    return null;
  }

  const handleDecision = async (consent: boolean) => {
    setIsSubmitting(true);
    // Optimistically update store
    markConsentPromptSeen(consent);

    try {
      await fetch("/api/user/consent-prompt-seen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent }),
      });
    } catch (err) {
      console.error("Failed to record consent prompt decision:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseX = async () => {
    setIsSubmitting(true);
    // X close must NOT silently opt-in: explicitly set/keep consent as false
    markConsentPromptSeen(false);

    try {
      await fetch("/api/user/consent-prompt-seen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: false }),
      });
    } catch (err) {
      console.error("Failed to dismiss consent prompt:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md rounded-2xl border p-6 shadow-2xl flex flex-col gap-5 overflow-hidden"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        {/* Subtle top accent gradient bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
              style={{
                backgroundColor: "rgba(168, 85, 247, 0.12)",
                borderColor: "rgba(168, 85, 247, 0.25)",
              }}
            >
              <Sparkles className="h-5 w-5 text-purple-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight font-sora">
                Help make Anvil smarter?
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Privacy-first AI feature improvement
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseX}
            disabled={isSubmitting}
            aria-label="Close modal"
            className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Short, Skimmable Bullet Points */}
        <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0" />
            <p className="text-xs text-slate-300 leading-relaxed">
              We&apos;d like to use anonymized patterns (streaks, completion timing — not your habit names or notes) to improve Anvil&apos;s AI features
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-teal-400 shrink-0" />
            <p className="text-xs text-slate-300 leading-relaxed">
              Your name, email, and habit text are never included
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
            <p className="text-xs text-slate-300 leading-relaxed">
              You can turn this off anytime in Settings
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => handleDecision(false)}
            disabled={isSubmitting}
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl border border-slate-700/80 bg-slate-900/60 hover:bg-slate-800 text-xs font-bold text-slate-300 hover:text-white transition-all disabled:opacity-50 cursor-pointer text-center"
          >
            No thanks
          </button>

          <button
            type="button"
            onClick={() => handleDecision(true)}
            disabled={isSubmitting}
            className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg shadow-purple-900/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Yes, help improve Anvil</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
