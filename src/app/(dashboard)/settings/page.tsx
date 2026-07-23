"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Info, Loader2, Save, HelpCircle } from "lucide-react";

export default function SettingsPage() {
  const [consent, setConsent] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showDetailedInfo, setShowDetailedInfo] = useState(false);

  // Fetch current consent status from stats API (we extended it to include completions,
  // let's fetch settings directly or extend stats API or fetch setting from stats)
  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/user/stats");
      if (!res.ok) throw new Error("Failed to load settings");
      const data = await res.json();
      // Wait, does stats route return trainingDataConsent?
      // Ah! In stats route we didn't return trainingDataConsent in the JSON, let's verify.
      // Yes, GET /api/user/stats returned user.trainingDataConsent in DB check, but let's see what was returned in the final JSON.
      // Let's modify stats route to return trainingDataConsent too! That is super clean and easy.
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/user/stats");
        if (res.ok) {
          const data = await res.json();
          // We'll read from data.trainingDataConsent (which we will verify/add in user stats route)
          setConsent(!!data.trainingDataConsent);
          if (data.trainingConsentUpdatedAt) {
            setUpdatedAt(new Date(data.trainingConsentUpdatedAt).toLocaleString());
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleToggleConsent = async () => {
    setIsSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingDataConsent: !consent }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update consent settings");
      }

      const data = await res.json();
      setConsent(data.trainingDataConsent);
      setUpdatedAt(data.trainingConsentUpdatedAt ? new Date(data.trainingConsentUpdatedAt).toLocaleString() : null);
      setMessage("Settings updated successfully!");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        <span className="text-sm text-slate-400 font-medium">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
          Settings
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your account settings, privacy configurations, and options.
        </p>
      </div>

      {/* Message banners */}
      {message && <div className="text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">{message}</div>}
      {error && <div className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">{error}</div>}

      {/* Privacy Consent Card */}
      <div
        className="rounded-xl border p-6 transition-all duration-300 flex flex-col gap-4 relative overflow-hidden"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
            style={{
              backgroundColor: "var(--bg-tertiary)",
              borderColor: "var(--border)",
            }}
          >
            <ShieldCheck className="h-5 w-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-extrabold text-white tracking-tight">
              AI & Model Training Consent
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Choose whether to share your habit patterns to train Anvil models.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-800/80 pt-4 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 bg-slate-950/20 border border-slate-800/40 p-4 rounded-lg">
            <div className="flex-1">
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                Help improve Anvil's AI features — share your anonymized habit patterns (never your name, email, or habit names) to help train smarter versions of Anvil's momentum, difficulty, and pattern models for everyone. You can turn this off anytime, and your data is never linked back to your identity.
              </p>
              {updatedAt && (
                <p className="text-[10px] text-slate-500 mt-2">
                  Last updated on: {updatedAt}
                </p>
              )}
            </div>
            
            <button
              onClick={handleToggleConsent}
              disabled={isSaving}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                consent ? "bg-purple-600" : "bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  consent ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Accordion / Expandable details */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowDetailedInfo(!showDetailedInfo)}
              className="text-xs font-bold text-purple-400 hover:text-purple-300 transition flex items-center gap-1.5 self-start"
            >
              <Info className="h-3.5 w-3.5" />
              {showDetailedInfo ? "Hide privacy and data policy details" : "Learn what data is collected and how it is protected"}
            </button>

            {showDetailedInfo && (
              <div className="text-xs text-slate-300 bg-slate-950/40 border border-slate-800 p-4 rounded-lg flex flex-col gap-4 mt-2 leading-relaxed">
                <div>
                  <h4 className="font-extrabold text-white uppercase tracking-wider text-[10px]">What is Shared</h4>
                  <ul className="list-disc pl-4 mt-1.5 flex flex-col gap-1 text-slate-400">
                    <li>Completion rate trend ratio (completions divided by scheduled days) over the last 14 days.</li>
                    <li>Current active habit streak length.</li>
                    <li>Login frequency (days since last login).</li>
                    <li>Variance score of habit completions across weekdays.</li>
                    <li>Aggregated completion counts per time of day (morning, afternoon, evening, night).</li>
                    <li>Class completion distribution ratios (e.g., % Warrior vs % Rogue completions).</li>
                    <li>Difficulty level distribution ratios in active habits (e.g., % Adept habits).</li>
                    <li>Your numerical momentum score.</li>
                    <li>Your general behavioral archetype label, if calculated (e.g., "Night Owl").</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-extrabold text-white uppercase tracking-wider text-[10px]">What is STRICTLY NEVER Shared</h4>
                  <ul className="list-disc pl-4 mt-1.5 flex flex-col gap-1 text-slate-400">
                    <li>Your real name, display name, or email address.</li>
                    <li>The text titles, descriptions, or names of your habits.</li>
                    <li>Free-text comments, notes, or entries in your Quest Journal.</li>
                    <li>Opponent/rival names, profiles, or relationships.</li>
                    <li>Exact timestamps of habit completions (only aggregated time buckets).</li>
                    <li>IP addresses, locations, or hardware fingerprinting details.</li>
                  </ul>
                </div>

                <div className="border-t border-slate-800 pt-3">
                  <h4 className="font-extrabold text-white uppercase tracking-wider text-[10px]">Data Deletion & Opt-Out Policy</h4>
                  <p className="mt-1 text-slate-400">
                    You can toggle consent off at any time to immediately halt future snapshot exports.
                  </p>
                  <p className="mt-1.5 text-slate-400">
                    <strong>Important Note on Retroactivity:</strong> Turning data collection off prevents any new snapshots from being generated, but does not retroactively delete existing snapshots already exported. Because existing snapshots are completely anonymized and decoupled (with no link paths, foreign keys, or user identifiers connecting them to your account), it is mathematically impossible for the system to trace or identify which snapshots belonged to you in order to delete them selectively.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
