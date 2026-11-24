"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

function safeRedirect(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/api/")) {
    return "/";
  }
  return value;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("next"));

  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!account.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: account.trim(), password }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Sign in failed. Please try again.");
      }

      router.replace(redirectTo);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-visual" aria-hidden="true">
        <div className="login-visual-inner">
          <div className="login-brand">
            <span className="login-brand-mark">C</span>
            <span className="login-brand-copy">
              <strong>CONSTRUCT</strong>
              <small>FIELD OPERATIONS</small>
            </span>
          </div>

          <div className="login-pitch">
            <span className="login-pitch-eyebrow">FIELD OPERATIONS, CONNECTED</span>
            <h1>Every site.<br />Every worker.<br />One clear view.</h1>
            <p>
              Track attendance, sites, tasks, payroll and safety from a single construction
              operations workspace.
            </p>
          </div>

          <div className="login-highlights">
            <div className="login-highlight">
              <span className="login-highlight-icon">S</span>
              <span><strong>Live sites</strong><small>Field footprint at a glance</small></span>
            </div>
            <div className="login-highlight">
              <span className="login-highlight-icon">A</span>
              <span><strong>Attendance</strong><small>Daily workforce records</small></span>
            </div>
            <div className="login-highlight">
              <span className="login-highlight-icon">R</span>
              <span><strong>Reports</strong><small>Shift, period and executive views</small></span>
            </div>
          </div>

          <p className="login-visual-footer">CONSTRUCTION OPERATIONS · SECURE WORKSPACE</p>
        </div>
      </section>

      <main className="login-panel">
        <div className="login-card">
          <div className="login-card-head">
            <span className="login-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="10" width="14" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" />
              </svg>
            </span>
            <h2>Welcome back</h2>
            <p>Sign in to open your operations workspace.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="login-field">
              <span>Username</span>
              <input
                autoCapitalize="none"
                autoComplete="username"
                autoFocus
                name="username"
                onChange={(event) => setAccount(event.target.value)}
                placeholder="admin"
                type="text"
                value={account}
              />
            </label>

            <label className="login-field">
              <span>Password</span>
              <span className="login-password-wrap">
                <input
                  autoComplete="current-password"
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  className="login-toggle-password"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>

            {error && (
              <div className="login-error" role="alert">
                <span aria-hidden="true">!</span>
                {error}
              </div>
            )}

            <button className="login-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Signing in…" : "Sign in"}
              {!isSubmitting && <span aria-hidden="true">→</span>}
            </button>
          </form>

          {process.env.NODE_ENV !== "production" && (
            <p className="login-hint">
              Default access: <code>admin</code> / <code>12345678</code>
            </p>
          )}
          <p className="login-footnote">Access is limited to authorized workspace users.</p>
        </div>
      </main>
    </div>
  );
}
