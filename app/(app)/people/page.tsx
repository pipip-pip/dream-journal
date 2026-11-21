"use client";
// People who've appeared in your dreams, plus your open threads.
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { parseLocal } from "@/lib/sky";
import type { Person, Thread } from "@/lib/types";

export default function PeoplePage() {
  const [tab, setTab] = useState<"people" | "threads">("people");
  const [people, setPeople] = useState<(Person & { count: number })[] | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    supabase().from("people").select("*, entry_people(count)").order("last_mentioned", { ascending: false, nullsFirst: false })
      .then(({ data }: { data: any[] | null }) => setPeople((data ?? []).map((p) => ({ ...p, count: p.entry_people?.[0]?.count ?? 0 }))));
    supabase().from("threads").select("*").order("created_at", { ascending: false })
      .then(({ data }: { data: Thread[] | null }) => setThreads(data ?? []));
  }, []);

  const toggleThread = async (t: Thread) => {
    await supabase().from("threads").update({ resolved: !t.resolved }).eq("id", t.id);
    setThreads((list) => list.map((x) => (x.id === t.id ? { ...x, resolved: !x.resolved } : x)));
  };
  const removeThread = async (t: Thread) => {
    await supabase().from("threads").delete().eq("id", t.id);
    setThreads((list) => list.filter((x) => x.id !== t.id));
  };

  const shown = threads.filter((t) => showDone || !t.resolved);
  const fmt = (d: string | null) => (d ? parseLocal(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "");

  return (
    <>
      <div className="topbar">
        <h1>{tab === "people" ? "People" : "Threads"}</h1>
        <div className="toggle">
          <button className={tab === "people" ? "on" : ""} onClick={() => setTab("people")}>People</button>
          <button className={tab === "threads" ? "on" : ""} onClick={() => setTab("threads")}>Threads</button>
        </div>
      </div>

      {tab === "people" && (
        people === null ? <p className="muted">Loading…</p> : people.length === 0 ? (
          <p className="muted">People you mention in your check-ins will appear here on their own.</p>
        ) : (
          <div className="grid">
            {people.map((p) => (
              <Link key={p.id} href={`/people/${p.id}`} className="card list-item" style={{ marginBottom: 0 }}>
                <div style={{ fontFamily: "var(--serif)", fontSize: 19 }}>{p.name}</div>
                {p.relationship && <div className="muted small">{p.relationship}</div>}
                <div className="muted small" style={{ marginTop: 6 }}>
                  {p.count} dream{p.count === 1 ? "" : "s"}{p.last_mentioned && ` · last ${fmt(p.last_mentioned)}`}
                </div>
              </Link>
            ))}
          </div>
        )
      )}

      {tab === "threads" && (
        <>
          <p className="muted small">Ongoing things from your days. Dreams may gently follow up on open ones.</p>
          {shown.length === 0 && <p className="muted">No open threads.</p>}
          {shown.map((t) => (
            <div key={t.id} className="card" style={{ opacity: t.resolved ? 0.55 : 1 }}>
              <div style={{ textDecoration: t.resolved ? "line-through" : "none" }}>{t.summary}</div>
              {t.follow_up_hint && <div className="muted small">{t.follow_up_hint}</div>}
              <div className="row" style={{ marginTop: 8 }}>
                <button className="chip" onClick={() => toggleThread(t)}>{t.resolved ? "Reopen" : "✓ Done"}</button>
                <button className="chip ghost danger" onClick={() => removeThread(t)}>Remove</button>
              </div>
            </div>
          ))}
          {threads.some((t) => t.resolved) && (
            <button className="ghost" onClick={() => setShowDone(!showDone)}>{showDone ? "Hide done" : "Show done"}</button>
          )}
        </>
      )}
    </>
  );
}
