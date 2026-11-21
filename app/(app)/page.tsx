"use client";
// Tonight: the daily check-in. Submit → breathing moment → the dream streams in → saved.
import { useCallback, useEffect, useRef, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import Breathing from "@/components/Breathing";
import DreamReader from "@/components/DreamReader";
import { getEntry, getSettings } from "@/lib/data";
import { partialDream, streamDream } from "@/lib/stream";
import { localDate, moonPhase, season } from "@/lib/sky";
import {
  EXTRA_PROMPTS, LENGTHS, LENGTH_LABEL, MODES, MODE_LABEL, MOODS, MOOD_EMOJI, TONES, TONE_LABEL,
  type CheckIn, type Entry, type Length, type Mode, type Mood, type Tone,
} from "@/lib/types";

type Stage = "form" | "dreaming" | "done" | "error";
const DRAFT_KEY = "dj-draft";

export default function TonightPage() {
  const [checkIn, setCheckIn] = useState<CheckIn>({});
  const [mood, setMood] = useState<Mood | null>(null);
  const [tone, setTone] = useState<Tone>("peaceful");
  const [length, setLength] = useState<Length>("medium");
  const [mode, setMode] = useState<Mode>("tonight");

  const [stage, setStage] = useState<Stage>("form");
  const [breathing, setBreathing] = useState(false);
  const [raw, setRaw] = useState("");
  const [entry, setEntry] = useState<Entry | null>(null);
  const [error, setError] = useState("");
  const lastSurprise = useRef(false);
  const abort = useRef<AbortController | null>(null);

  // Load defaults from Settings; mornings start in Morning mode. Restore an unsent draft.
  useEffect(() => {
    getSettings().then((s) => {
      setTone(s.default_tone); setLength(s.default_length);
      setMode(new Date().getHours() < 12 ? "morning" : s.default_mode);
    }).catch(() => {});
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (d && d.date === localDate()) { setCheckIn(d.checkIn ?? {}); setMood(d.mood ?? null); }
    } catch {}
  }, []);

  // Save the draft as you type (on this device only), so nothing is lost.
  useEffect(() => {
    if (stage !== "form") return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ date: localDate(), checkIn, mood })); } catch {}
  }, [checkIn, mood, stage]);

  const generate = async (surprise: boolean) => {
    lastSurprise.current = surprise;
    setStage("dreaming"); setBreathing(true); setRaw(""); setError(""); setEntry(null);
    abort.current = new AbortController();
    try {
      const id = await streamDream(
        { checkIn: surprise ? { surprise: true } : checkIn, mood: surprise ? null : mood, tone, length, mode, date: localDate() },
        setRaw, abort.current.signal,
      );
      const saved = await getEntry(id);
      setEntry(saved);
      setStage("done");
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e?.message || "Something went wrong.");
      setStage("error");
      setBreathing(false);
    }
  };

  const endBreathing = useCallback(() => setBreathing(false), []);
  const set = (k: keyof CheckIn, v: string) => setCheckIn((c) => ({ ...c, [k]: v }));
  const reset = () => { setStage("form"); setCheckIn({}); setMood(null); setEntry(null); setRaw(""); };

  // ─── Dreaming / done ───
  if (stage !== "form") {
    const partial = partialDream(raw);
    return (
      <>
        {breathing && stage === "dreaming" && <Breathing onDone={endBreathing} />}
        <div className="topbar">
          <button className="ghost chip" onClick={() => { abort.current?.abort(); reset(); }}>← New check-in</button>
        </div>
        {stage === "error" && (
          <div className="card fade-in" style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "var(--serif)", fontSize: 20 }}>The dream slipped away.</p>
            <p className="muted">{error}</p>
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="primary" onClick={() => generate(lastSurprise.current)}>Try again</button>
              <button className="ghost" onClick={() => setStage("form")}>Edit check-in</button>
            </div>
          </div>
        )}
        {stage === "dreaming" && !breathing && (
          <div className="dream fade-in">
            <h2>{partial.title || "…"}</h2>
            {partial.story
              ? partial.story.split(/\n\s*\n/).map((p, i, a) => <p key={i} className={i === a.length - 1 ? "cursor" : ""}>{p}</p>)
              : <p className="muted cursor" style={{ textAlign: "center" }}>Drifting off</p>}
          </div>
        )}
        {stage === "done" && entry && <DreamReader entry={entry} />}
      </>
    );
  }

  // ─── Check-in form ───
  const now = new Date();
  return (
    <>
      <div className="topbar">
        <h1>{mode === "morning" ? "Good morning" : "Tonight"}</h1>
        <ThemeToggle />
      </div>
      <p className="muted small" style={{ marginTop: -8 }}>
        {now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} · {season(now)} · {moonPhase(now)}
      </p>

      <div className="card">
        <label className="label" htmlFor="text">{mode === "morning" ? "What's ahead today?" : "What happened today?"}</label>
        <textarea id="text" placeholder="A few words is enough…" value={checkIn.text ?? ""} onChange={(e) => set("text", e.target.value)} />
        <details style={{ marginTop: 8 }}>
          <summary>＋ A few gentle prompts (optional)</summary>
          {EXTRA_PROMPTS.map((p) => (
            <div key={p.key} style={{ marginTop: 10 }}>
              <label className="label" htmlFor={p.key}>{p.label}</label>
              <input id={p.key} value={(checkIn as any)[p.key] ?? ""} onChange={(e) => set(p.key, e.target.value)} />
            </div>
          ))}
        </details>
      </div>

      <div className="card">
        <span className="label">Mood</span>
        <div className="row">
          {MOODS.map((m) => (
            <button key={m} className={`chip ${mood === m ? "on" : ""}`} onClick={() => setMood(mood === m ? null : m)}>
              {MOOD_EMOJI[m]} {m}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <span className="label">Tone</span>
        <div className="row">{TONES.map((t) => <button key={t} className={`chip ${tone === t ? "on" : ""}`} onClick={() => setTone(t)}>{TONE_LABEL[t]}</button>)}</div>
        <span className="label" style={{ marginTop: 14 }}>Length</span>
        <div className="row">{LENGTHS.map((l) => <button key={l} className={`chip ${length === l ? "on" : ""}`} onClick={() => setLength(l)}>{LENGTH_LABEL[l]}</button>)}</div>
        <span className="label" style={{ marginTop: 14 }}>Mode</span>
        <div className="row">{MODES.map((m) => <button key={m} className={`chip ${mode === m ? "on" : ""}`} onClick={() => setMode(m)}>{MODE_LABEL[m]}</button>)}</div>
      </div>

      <button className="primary block" style={{ minHeight: 54, fontSize: 18 }} onClick={() => generate(false)}>
        {mode === "morning" ? "Dream the day ahead" : "Dream it"}
      </button>
      <button className="ghost block" style={{ marginTop: 10 }} onClick={() => generate(true)}>✨ Surprise me</button>
    </>
  );
}
