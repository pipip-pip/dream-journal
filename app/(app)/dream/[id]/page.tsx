"use client";
// One dream, on its own page (linked from People, Fragments and search).
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DreamReader from "@/components/DreamReader";
import RealDay from "@/components/RealDay";
import { getEntry } from "@/lib/data";
import { parseLocal } from "@/lib/sky";
import type { Entry } from "@/lib/types";

export default function DreamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [entry, setEntry] = useState<Entry | null | undefined>(undefined);
  const [view, setView] = useState<"dream" | "real">("dream");

  useEffect(() => { getEntry(id).then(setEntry); }, [id]);

  return (
    <>
      <div className="topbar">
        <button className="ghost chip" onClick={() => router.back()}>← Back</button>
        {entry && (
          <div className="toggle">
            <button className={view === "dream" ? "on" : ""} onClick={() => setView("dream")}>Dream</button>
            <button className={view === "real" ? "on" : ""} onClick={() => setView("real")}>Real day</button>
          </div>
        )}
      </div>
      {entry === undefined && <p className="muted">Loading…</p>}
      {entry === null && <p className="muted">This dream couldn't be found.</p>}
      {entry && (
        <>
          <p className="muted small" style={{ textAlign: "center" }}>
            {parseLocal(entry.entry_date).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
          {view === "dream" ? <DreamReader entry={entry} /> : <RealDay entry={entry} />}
        </>
      )}
    </>
  );
}
