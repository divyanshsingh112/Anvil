"use client";

import { useEffect, useState, useRef } from "react";
import {
  ShieldCheck,
  Swords,
  Info,
  Loader2,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  XCircle,
  User,
  Save,
  AtSign,
  Phone,
  Calendar,
  Sparkles,
  Camera
} from "lucide-react";
import { useLabels } from "@/hooks/useLabels";

export default function SettingsPage() {
  const labels = useLabels();
  const [consent, setConsent] = useState(false);
  const [allowChallenges, setAllowChallenges] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingConsent, setIsSavingConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showDetailedInfo, setShowDetailedInfo] = useState(false);

  // Avatar Upload State
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Personal Info State
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState<string | number>("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Email Change State
  const [currentEmail, setCurrentEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isEmailChanging, setIsEmailChanging] = useState(false);
  const [isCancellingPending, setIsCancellingPending] = useState(false);
  const [emailChangeMessage, setEmailChangeMessage] = useState("");
  const [emailChangeError, setEmailChangeError] = useState("");

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/user/settings");
      if (res.ok) {
        const data = await res.json();
        setConsent(!!data.trainingDataConsent);
        setAllowChallenges(data.allowChallenges ?? true);
        setCurrentEmail(data.email || "");
        setAvatarUrl(data.avatarUrl || null);
        setPendingEmail(data.pendingEmail || null);
        setHasPassword(data.hasPassword ?? true);
        
        // Personal info fields
        setDisplayName(data.displayName || "");
        setUsername(data.username || "");
        setPhone(data.phone || "");
        setGender(data.gender || "");
        setAge(data.age !== null && data.age !== undefined ? String(data.age) : "");

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

  useEffect(() => {
    loadSettings();
  }, []);

  // Avatar Upload Handler
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/user/avatar", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload avatar");
      }

      setAvatarUrl(data.avatarUrl);
      setMessage("Profile picture updated successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to upload avatar");
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Save Personal Info
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setMessage("");
    setError("");

    try {
      const bodyPayload: {
        displayName: string;
        username?: string | null;
        phone?: string | null;
        gender?: string | null;
        age?: number | null;
      } = {
        displayName: displayName.trim(),
        username: username.trim() || null,
        phone: phone.trim() || null,
        gender: gender.trim() || null,
        age: age !== "" ? parseInt(String(age), 10) : null,
      };

      const res = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      setDisplayName(data.displayName || "");
      setUsername(data.username || "");
      setPhone(data.phone || "");
      setGender(data.gender || "");
      setAge(data.age !== null && data.age !== undefined ? String(data.age) : "");
      setMessage("Personal information updated successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleToggleConsent = async () => {
    setIsSavingConsent(true);
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
      setMessage("Privacy settings updated successfully!");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSavingConsent(false);
    }
  };

  const handleToggleAllowChallenges = async () => {
    setIsSavingConsent(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowChallenges: !allowChallenges }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update challenge settings");
      }

      const data = await res.json();
      setAllowChallenges(data.allowChallenges);
      setMessage("Duel challenge settings updated successfully!");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSavingConsent(false);
    }
  };

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailChangeMessage("");
    setEmailChangeError("");
    setIsEmailChanging(true);

    try {
      const res = await fetch("/api/user/email-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to request email change");
      }

      setPendingEmail(data.pendingEmail);
      setCurrentPassword("");
      setNewEmail("");
      setEmailChangeMessage(data.message || "Confirmation link sent to your new email address. Please check your inbox.");
    } catch (err: any) {
      setEmailChangeError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsEmailChanging(false);
    }
  };

  const handleCancelPendingEmailChange = async () => {
    setEmailChangeMessage("");
    setEmailChangeError("");
    setIsCancellingPending(true);

    try {
      const res = await fetch("/api/user/email-change", {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel pending email change");
      }

      setPendingEmail(null);
      setEmailChangeMessage("Pending email change cancelled successfully.");
    } catch (err: any) {
      setEmailChangeError(err.message || "Failed to cancel pending change.");
    } finally {
      setIsCancellingPending(false);
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
    <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6 font-geist">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2 font-sora">
          Settings
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your personal profile, credentials, privacy configurations, and duel preferences.
        </p>
      </div>

      {/* Message banners */}
      {message && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20 animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20 animate-fadeIn">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* ─── CARD 1: Personal Info ─── */}
      <div
        className="rounded-xl border p-6 transition-all duration-300 flex flex-col gap-5 relative overflow-hidden"
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
            <User className="h-5 w-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-extrabold text-white tracking-tight font-sora">
              Personal Info
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Update your profile picture, display name, username handle, and optional profile details.
            </p>
          </div>
        </div>

        {/* Profile Picture Upload Section */}
        <div className="flex items-center gap-4 bg-slate-950/30 border border-slate-800/60 p-4 rounded-xl">
          <div className="relative group shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-purple-500/40 bg-slate-900 flex items-center justify-center shadow-md">
              {isUploadingAvatar ? (
                <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
              ) : avatarUrl ? (
                <img src={avatarUrl} alt="Profile Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="h-8 w-8 text-purple-400" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute bottom-0 right-0 p-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-lg transition border border-slate-900 cursor-pointer disabled:opacity-50"
              title="Upload profile picture"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarFileChange}
              className="hidden"
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold text-white">Profile Picture</span>
            <p className="text-[11px] text-slate-400">
              Click the camera icon to upload a custom avatar (JPEG, PNG, or WebP up to 2MB).
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="self-start text-xs font-bold text-purple-400 hover:text-purple-300 transition mt-0.5"
            >
              {isUploadingAvatar ? "Uploading..." : avatarUrl ? "Change Photo" : "Upload Photo"}
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="border-t border-slate-800/80 pt-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Display Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="displayName" className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                DISPLAY NAME <span className="text-rose-400">*</span>
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={50}
                placeholder="e.g. Forgemaster Arthur"
                className="input-forge w-full h-10 px-3.5 rounded-lg text-sm placeholder:text-slate-500"
              />
            </div>

            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="username" className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <AtSign className="h-3.5 w-3.5 text-purple-400" />
                USERNAME
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                placeholder="e.g. arthur_forge"
                className="input-forge w-full h-10 px-3.5 rounded-lg text-sm placeholder:text-slate-500"
              />
              <span className="text-[10px] text-slate-500">3-20 characters, alphanumeric & underscores only</span>
            </div>

            {/* Phone */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="phone" className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-purple-400" />
                PHONE NUMBER
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={30}
                placeholder="e.g. +1 (555) 123-4567"
                className="input-forge w-full h-10 px-3.5 rounded-lg text-sm placeholder:text-slate-500"
              />
            </div>

            {/* Gender */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="gender" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                GENDER
              </label>
              <input
                id="gender"
                type="text"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                maxLength={50}
                placeholder="e.g. Non-binary, Female, Male"
                className="input-forge w-full h-10 px-3.5 rounded-lg text-sm placeholder:text-slate-500"
              />
            </div>

            {/* Age */}
            <div className="flex flex-col gap-1.5 sm:col-span-2 sm:max-w-[200px]">
              <label htmlFor="age" className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-purple-400" />
                AGE
              </label>
              <input
                id="age"
                type="number"
                min={13}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="13 - 120"
                className="input-forge w-full h-10 px-3.5 rounded-lg text-sm placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="px-4 py-2.5 rounded-lg font-bold text-xs text-white bg-purple-600 hover:bg-purple-500 transition shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSavingProfile ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Personal Info</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ─── CARD 2: Email Address & Security ─── */}
      <div
        className="rounded-xl border p-6 transition-all duration-300 flex flex-col gap-5 relative overflow-hidden"
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
            <Mail className="h-5 w-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-extrabold text-white tracking-tight font-sora">
              Email Address & Security
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              View your primary sign-in email address and request account email changes.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-800/80 pt-4 flex flex-col gap-4">
          {/* Current Email Display */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/30 border border-slate-800/50 p-4 rounded-lg">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                CURRENT SIGN-IN EMAIL
              </span>
              <span className="text-sm font-semibold text-white mt-0.5 font-mono">
                {currentEmail || "Loading..."}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold self-start sm:self-auto">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Verified & Active</span>
            </div>
          </div>

          {/* Email Change Status Notifications */}
          {emailChangeMessage && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{emailChangeMessage}</span>
            </div>
          )}
          {emailChangeError && (
            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{emailChangeError}</span>
            </div>
          )}

          {/* Pending Email Change State Banner */}
          {pendingEmail ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-purple-950/30 border border-purple-800/40">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-white">
                    Verification Pending for: <span className="font-mono text-purple-300">{pendingEmail}</span>
                  </span>
                  <p className="text-xs text-slate-400">
                    We sent a verification link to your new address. Click the link in your email to complete the swap. Your current email remains active until confirmed.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelPendingEmailChange}
                disabled={isCancellingPending}
                className="px-3 py-2 rounded-lg border border-slate-700 hover:border-rose-500/50 bg-slate-900/60 hover:bg-rose-950/30 text-slate-300 hover:text-rose-300 text-xs font-semibold transition shrink-0 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isCancellingPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Cancel Request</span>
                  </>
                )}
              </button>
            </div>
          ) : !hasPassword ? (
            /* OAuth Google Account Notice */
            <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-900/40 border border-slate-800 text-xs text-slate-400">
              <Info className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
              <p>
                This account is signed in using Google OAuth. Accounts created via Google sign-in cannot change their email address through password confirmation.
              </p>
            </div>
          ) : (
            /* Email Change Form */
            <form onSubmit={handleRequestEmailChange} className="flex flex-col gap-4 mt-1">
              <div className="text-xs text-slate-400">
                To change your email address, confirm your current password and specify your new email address. A confirmation link will be delivered to the new address.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Current Password Field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    CURRENT PASSWORD
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="input-forge w-full h-10 pl-3.5 pr-10 rounded-lg text-sm placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition p-0.5"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* New Email Field */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    NEW EMAIL ADDRESS
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    placeholder="new-email@domain.com"
                    className="input-forge w-full h-10 px-3.5 rounded-lg text-sm placeholder:text-slate-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isEmailChanging}
                className="self-start px-4 py-2.5 rounded-lg font-bold text-xs text-white bg-purple-600 hover:bg-purple-500 transition shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer mt-1"
              >
                {isEmailChanging ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Sending Confirmation Link...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Request Email Change</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ─── CARD 3: Rival Challengeability Toggle Card ─── */}
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
            <Swords className="h-5 w-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-extrabold text-white tracking-tight font-sora">
              Rival Challenges
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Control whether other users can find and challenge you to habit duels.
            </p>
          </div>
        </div>

        <div className="border-t border-slate-800/80 pt-4 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4 bg-slate-950/20 border border-slate-800/40 p-4 rounded-lg">
            <div className="flex-1">
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                Allow other users to search for your username or email and challenge you to 7-day habit duels. When turned off, any new challenge requests targeting your account will be automatically declined.
              </p>
            </div>
            
            <button
              onClick={handleToggleAllowChallenges}
              disabled={isSavingConsent}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                allowChallenges ? "bg-purple-600" : "bg-slate-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  allowChallenges ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ─── CARD 4: Privacy Consent Card ─── */}
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
            <h3 className="text-base font-extrabold text-white tracking-tight font-sora">
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
              disabled={isSavingConsent}
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
                    <li>The text titles, descriptions, or names of your {labels.habitPlural.toLowerCase()}.</li>
                    <li>Free-text comments, notes, or entries in your {labels.journalLabel}.</li>
                    <li>Opponent/{labels.rivalLabel.toLowerCase()} names, profiles, or relationships.</li>
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
