"use client";
// Email + password login. There is no sign-up form: you create your one account
// in the Supabase dashboard (see README), which keeps strangers out.
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Particles from "@/components/Particles";
import { APP_NAME } from "@/lib/config";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { setError(error.message === "Invalid login credentials" ? "That email or password didn't match." : error.message); return; }
    // Full page load so the server sees the new login cookie.
    window.location.href = "/";
  };

  return (
    <>
      <Particles />
      <main className="shell" style={{ paddingTop: "calc(env(safe-area-inset-top) + 18vh)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }} className="fade-in">
          <div style={{ fontSize: 44 }}>🌙</div>
          <h1 style={{ fontFamily: "var(--serif)", fontWeight: 400, margin: "8px 0 4px" }}>{APP_NAME}</h1>
          <p className="muted">Your day, turned into tonight's dream.</p>
        </div>
        <form className="card fade-in" onSubmit={submit}>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div style={{ height: 12 }} />
          <label className="label" htmlFor="pw">Password</label>
          <input id="pw" type="password" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="error small">{error}</p>}
          <button className="primary block" style={{ marginTop: 16 }} disabled={busy}>{busy ? "Opening…" : "Enter"}</button>
        </form>
      </main>
    </>
  );
}
