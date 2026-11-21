"use client";
// Journal: month calendar with mood icons, "On this day", search, and each day's
// dream or real day.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DreamReader from "@/components/DreamReader";
import RealDay from "@/components/RealDay";
import { getEntries } from "@/lib/data";
import { supabase } from "@/lib/supabase/client";
import { localDate, parseLocal } from "@/lib/sky";
import { entryIcon, type Entry } from "@/lib/types";

export default function JournalPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState(localDate());
  const [view, setView] = useState<"dream" | "real">("dream");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Entry[] | null>(null);

  useEffect(() => {
    getEntries().then(({ entries, offline }) => { setEntries(entries); setOffline(offline); setLoading(false); });
  }, []);

  // Group by day; newest entry first within each day.
  const byDay = useMemo(() => {
    const m = new Map<string, Entry[]>();
    entries.forEach((e) => m.set(e.entry_date, [...(m.get(e.entry_date) ?? []), e]));
    return m;
  }, [entries]);

  // "On this day": a month ago and a year ago.
  const onThisDay = useMemo(() => {
    const t = new Date();
    const monthAgo = localDate(new Date(t.getFullYear(), t.getMonth() - 1, t.getDate()));
    const yearAgo = localDate(new Date(t.getFullYear() - 1, t.getMonth(), t.getDate()));
    return [
      ...(byDay.get(yearAgo) ?? []).slice(0, 1).map((e) => ({ e, when: "A year ago" })),
      ...(byDay.get(monthAgo) ?? []).slice(0, 1).map((e) => ({ e, when: "A month ago" })),
    ];
  }, [byDay]);

  // Search runs in the database (search_text column); falls back to local search offline.
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) { setResults(null); return; }
    const t = setTimeout(async () => {
      const escaped = q.replace(/[\\%_]/g, (c) => "\\" + c);
      const { data, error } = await supabase().from("entries").select("*")
        .ilike("search_text", `%${escaped}%`).order("created_at", { ascending: false }).limit(50);
      if (error) setResults(entries.filter((e) => (e.title + e.story + JSON.stringify(e.check_in)).toLowerCase().includes(q)));
      else setResults((data ?? []) as Entry[]);
    }, 300);
    return () => clearTimeout(t);
  }, [query, entries]);

  // Calendar cells (weeks start on Monday).
  const cells = useMemo(() => {
    const first = (month.getDay() + 6) % 7;
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => localDate(new Date(month.getFullYear(), month.getMonth(), i + 1)))];
  }, [month]);

  const dayEntries = byDay.get(selected) ?? [];
  const today = localDate();
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <>
      <div className="topbar"><h1>Journal</h1></div>
      {offline && <div className="banner">You're offline. Showing dreams saved on this device.</div>}

      <input type="search" placeholder="Search dreams and days…" value={query} onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 14 }} />

      {results ? (
        <div>
          <p className="muted small">{results.length} found</p>
          {results.map((e) => <EntryRow key={e.id} e={e} />)}
        </div>
      ) : (
        <>
          {onThisDay.map(({ e, when }) => (
            <Link key={e.id} href={`/dream/${e.id}`} className="card list-item fade-in" style={{ display: "block" }}>
              <span className="label">On this day · {when}</span>
              <div style={{ fontFamily: "var(--serif)", fontSize: 19 }}>{entryIcon(e)} {e.title}</div>
              <div className="muted small">{e.story.slice(0, 120)}…</div>
            </Link>
          ))}

          <div className="card">
            <div className="spread" style={{ marginBottom: 8 }}>
              <button className="ghost icon-btn" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
              <strong style={{ fontFamily: "var(--serif)", fontWeight: 400, fontSize: 19 }}>
                {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </strong>
              <button className="ghost icon-btn" onClick={() => shift(1)} aria-label="Next month">›</button>
            </div>
            <div className="cal">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i} className="dow">{d}</div>)}
              {cells.map((d, i) => d === null ? <div key={i} /> : (
                <button key={d} onClick={() => { setSelected(d); setView("dream"); }}
                  className={[byDay.has(d) && "has", d === selected && "sel", d === today && "today"].filter(Boolean).join(" ")}>
                  <span>{Number(d.slice(8))}</span>
                  <span className="ico">{byDay.has(d) ? entryIcon(byDay.get(d)![0]) : ""}</span>
                </button>
              ))}
            </div>
            <p className="muted small" style={{ marginBottom: 0, textAlign: "center" }}>
              🌙 peaceful · ✨ mystical · 🌫️ eerie · ☁️ heavy day · ☀️ happy day
            </p>
          </div>

          {loading ? <p className="muted">Loading…</p> : dayEntries.length === 0 ? (
            <p className="muted" style={{ textAlign: "center" }}>No dream on {parseLocal(selected).toLocaleDateString(undefined, { month: "long", day: "numeric" })}.</p>
          ) : (
            <>
              <div className="spread" style={{ margin: "8px 0 12px" }}>
                <span className="muted small">{parseLocal(selected).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span>
                <div className="toggle">
                  <button className={view === "dream" ? "on" : ""} onClick={() => setView("dream")}>Dream</button>
                  <button className={view === "real" ? "on" : ""} onClick={() => setView("real")}>Real day</button>
                </div>
              </div>
              {view === "dream" ? <DreamReader key={dayEntries[0].id} entry={dayEntries[0]} /> : <RealDay entry={dayEntries[0]} />}
              {dayEntries.length > 1 && (
                <div style={{ marginTop: 16 }}>
                  <span className="label">Other dreams this day</span>
                  {dayEntries.slice(1).map((e) => <EntryRow key={e.id} e={e} />)}
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}

function EntryRow({ e }: { e: Entry }) {
  return (
    <Link href={`/dream/${e.id}`} className="card list-item" style={{ display: "block" }}>
      <div className="spread">
        <span style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{entryIcon(e)} {e.title}</span>
        <span className="muted small">{parseLocal(e.entry_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
      </div>
      <div className="muted small">{e.story.slice(0, 110)}…</div>
    </Link>
  );
}
