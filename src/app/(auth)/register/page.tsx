"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Register the user
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      // Auto sign-in after successful registration
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      setLoading(false);

      if (result?.error) {
        setError("Account created but sign-in failed. Please log in.");
        router.push("/login");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div
        className="w-full max-w-md rounded-xl border p-8"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        <h1
          className="mb-2 text-center text-3xl font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Create your account
        </h1>
        <p
          className="mb-8 text-center text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          Begin your journey to unbreakable habits
        </p>

        {error && (
          <div
            className="mb-4 rounded-lg px-4 py-3 text-sm"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              color: "var(--danger)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="displayName"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
              placeholder="Your display name"
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors focus:ring-2"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
              placeholder="Min 8 characters"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--accent-purple)" }}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p
          className="mt-6 text-center text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          Already have an account?{" "}
          <a
            href="/login"
            className="font-medium underline"
            style={{ color: "var(--accent-purple)" }}
          >
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
