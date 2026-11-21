"use client";
// The calm reading view for one dream: text, waking thought, fragment,
// who appeared, read-aloud, ambient sound and the "Before sleep" rituals.
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { peopleInEntry } from "@/lib/data";
import { canSpeak, speak, stopSpeaking } from "@/lib/speech";
import { startAmbience, stopAmbience, type Ambience } from "@/lib/ambience";
import type { Entry, Fragment, Ritual } from "@/lib/types";

export default function DreamReader({ entry }: { entry: Entry }) {
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [fragment, setFragment] = useState<Fragment | null>(null);
  const [rituals, setRituals] = useState<Ritual[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [sound, setSound] = useState<Ambience | "off">("off");

  useEffect(() => {
    peopleInEntry(entry.id).then(setPeople).catch(() => {});
    supabase().from("fragments").select("*").eq("entry_id", entry.id).maybeSingle()
      .then(({ data }: { data: Fragment | null }) => setFragment(data));
    supabase().from("rituals").select("*").eq("entry_id", entry.id)
      .then(({ data }: { data: Ritual[] | null }) => setRituals(data ?? []));
    return () => { stopSpeaking(); stopAmbience(); }; // stop sounds when leaving
  }, [entry.id]);

  const paragraphs = entry.story.split(/\n\s*\n/).filter((p) => p.trim());

  const toggleSpeak = () => {
    if (speaking) { stopSpeaking(); setSpeaking(false); return; }
    setSpeaking(true);
    speak(`${entry.title}.\n\n${entry.story}`, () => setSpeaking(false));
  };

  const changeSound = (s: Ambience | "off") => {
    setSound(s);
    if (s === "off") stopAmbience(); else startAmbience(s);
  };

  return (
    <article className="fade-in">
      <div className="row" style={{ justifyContent: "center", marginBottom: 8 }}>
        {canSpeak() && (
          <button className="chip" onClick={toggleSpeak}>{speaking ? "⏹ Stop" : "🔈 Read aloud"}</button>
        )}
        <select aria-label="Ambient sound" value={sound} onChange={(e) => changeSound(e.target.value as any)}
          style={{ width: "auto", minHeight: 44, borderRadius: 999, padding: "8px 14px", fontSize: 16 }}>
          <option value="off">Sound: off</option>
          <option value="rain">🌧 Rain</option>
          <option value="night">🌌 Night</option>
          <option value="wind">🍃 Soft wind</option>
        </select>
      </div>

      <div className="dream">
        <h2>{entry.title}</h2>
        {paragraphs.map((p, i) => <p key={i} style={{ animationDelay: `${Math.min(i * 0.35, 3)}s` }}>{p}</p>)}
      </div>

      {entry.waking_thought && <p className="waking">“{entry.waking_thought}”</p>}

      {people.length > 0 && (
        <p className="muted small" style={{ textAlign: "center" }}>
          In this dream:{" "}
          {people.map((p, i) => (
            <span key={p.id}>{i > 0 && ", "}<Link href={`/people/${p.id}`}>{p.name}</Link></span>
          ))}
        </p>
      )}

      {fragment && (
        <div className="card fragment">
          <span className="label">A fragment you kept</span>
          <div className="name">🗝️ {fragment.name}</div>
          {fragment.description && <div className="muted small">{fragment.description}</div>}
        </div>
      )}

      <BeforeSleep entryId={entry.id} rituals={rituals} onSaved={(r) => setRituals((list) => [...list.filter((x) => x.kind !== r.kind), r])} />
    </article>
  );
}

function BeforeSleep({ entryId, rituals, onSaved }: { entryId: string; rituals: Ritual[]; onSaved: (r: Ritual) => void }) {
  const [open, setOpen] = useState<"intention" | "worry" | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const kinds = [
    { kind: "intention" as const, icon: "🕯️", label: "Set an intention for tonight", placeholder: "Tonight I'd like to…" },
    { kind: "worry" as const, icon: "🍃", label: "Let a worry drift away", placeholder: "I'm letting go of…" },
  ];

  const save = async () => {
    if (!open) return;
    setSaving(true);
    const existing = rituals.find((r) => r.kind === open);
    const q = existing
      ? supabase().from("rituals").update({ text }).eq("id", existing.id).select("*").single()
      : supabase().from("rituals").insert({ entry_id: entryId, kind: open, text }).select("*").single();
    const { data } = await q;
    setSaving(false);
    if (data) onSaved(data as Ritual);
    setOpen(null);
  };

  return (
    <div className="card">
      <span className="label">Before sleep</span>
      {kinds.map((k) => {
        const done = rituals.find((r) => r.kind === k.kind);
        return (
          <div key={k.kind} style={{ marginBottom: 8 }}>
            {open === k.kind ? (
              <div className="fade-in">
                <textarea autoFocus placeholder={k.placeholder} value={text} onChange={(e) => setText(e.target.value)}
                  style={{ minHeight: 70 }} maxLength={500} />
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="primary" onClick={save} disabled={saving}>{k.kind === "worry" ? "Let it drift" : "Keep it"}</button>
                  <button className="ghost" onClick={() => setOpen(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="ghost block" style={{ justifyContent: "flex-start", borderRadius: 14 }}
                onClick={() => { setOpen(k.kind); setText(done?.text ?? ""); }}>
                {k.icon} {k.label}
                {done && <span className="muted small" style={{ marginLeft: "auto" }}>✓ {done.text ? "saved" : "done"}</span>}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
