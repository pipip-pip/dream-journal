"use client";
// A short, skippable breathing moment before the dream appears.
import { useEffect, useState } from "react";

export default function Breathing({ onDone, seconds = 16 }: { onDone: () => void; seconds?: number }) {
  const [phase, setPhase] = useState("Breathe in…");
  useEffect(() => {
    const flip = setInterval(() => setPhase((p) => (p.startsWith("Breathe in") ? "Breathe out…" : "Breathe in…")), 4000);
    const end = setTimeout(onDone, seconds * 1000);
    return () => { clearInterval(flip); clearTimeout(end); };
  }, [onDone, seconds]);
  return (
    <div className="breath" role="dialog" aria-label="Breathing moment">
      <div className="orb" />
      <p className="muted" style={{ fontFamily: "var(--serif)", fontSize: 20 }}>{phase}</p>
      <button className="ghost" onClick={onDone}>Skip</button>
    </div>
  );
}
