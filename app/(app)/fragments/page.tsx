"use client";
// The Fragments shelf: small objects and images you kept from your dreams.
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Fragment } from "@/lib/types";

export default function FragmentsPage() {
  const [items, setItems] = useState<Fragment[] | null>(null);
  useEffect(() => {
    supabase().from("fragments").select("*").order("created_at", { ascending: false })
      .then(({ data }: { data: Fragment[] | null }) => setItems(data ?? []));
  }, []);

  return (
    <>
      <div className="topbar"><h1>Fragments</h1></div>
      <p className="muted small" style={{ marginTop: -8 }}>Small things you carried back from your dreams.</p>
      {items === null ? <p className="muted">Loading…</p> : items.length === 0 ? (
        <p className="muted">Your shelf is empty for now. Each dream leaves one fragment behind.</p>
      ) : (
        <div className="grid">
          {items.map((f) => (
            <Link key={f.id} href={f.entry_id ? `/dream/${f.entry_id}` : "#"} className="card list-item fade-in"
              style={{ marginBottom: 0, textAlign: "center" }}>
              <div style={{ fontSize: 26 }}>🗝️</div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 17 }}>{f.name}</div>
              {f.description && <div className="muted small">{f.description}</div>}
              <div className="muted small" style={{ marginTop: 6, opacity: 0.7 }}>{new Date(f.created_at).toLocaleDateString()}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
