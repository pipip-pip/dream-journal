"use client";
// One person: edit their details, see every dream they appeared in,
// merge a duplicate into them, or remove them.
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { parseLocal } from "@/lib/sky";
import { entryIcon, type Entry, type Person } from "@/lib/types";

export default function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [person, setPerson] = useState<Person | null>(null);
  const [others, setOthers] = useState<Person[]>([]);
  const [dreams, setDreams] = useState<Entry[]>([]);
  const [mergeId, setMergeId] = useState("");
  const [saved, setSaved] = useState(false);

  const load = async () => {
    const db = supabase();
    const [{ data: p }, { data: all }, { data: links }] = await Promise.all([
      db.from("people").select("*").eq("id", id).maybeSingle(),
      db.from("people").select("*").neq("id", id).order("name"),
      db.from("entry_people").select("entries(*)").eq("person_id", id),
    ]);
    setPerson(p as Person | null);
    setOthers((all ?? []) as Person[]);
    setDreams(((links ?? []).map((l: any) => l.entries).filter(Boolean) as Entry[])
      .sort((a, b) => b.created_at.localeCompare(a.created_at)));
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!person) return <p className="muted">Loading…</p>;

  const update = (k: keyof Person, v: any) => { setPerson({ ...person, [k]: v }); setSaved(false); };

  const save = async () => {
    await supabase().from("people").update({
      name: person.name.trim() || "Someone", relationship: person.relationship, notes: person.notes,
      aliases: person.aliases.filter(Boolean),
    }).eq("id", person.id);
    setSaved(true);
  };

  // Merge: move the other person's dreams, names and notes into this one, then delete them.
  const merge = async () => {
    const other = others.find((o) => o.id === mergeId);
    if (!other || !confirm(`Merge “${other.name}” into “${person.name}”?`)) return;
    const db = supabase();
    const { data: links } = await db.from("entry_people").select("entry_id").eq("person_id", other.id);
    if (links?.length) {
      await db.from("entry_people").upsert(links.map((l: any) => ({ entry_id: l.entry_id, person_id: person.id })), { ignoreDuplicates: true });
    }
    const aliases = [...new Set([...person.aliases, other.name, ...other.aliases])].filter((a) => a.toLowerCase() !== person.name.toLowerCase());
    const dates = [person.first_mentioned, other.first_mentioned].filter(Boolean).sort();
    const lasts = [person.last_mentioned, other.last_mentioned].filter(Boolean).sort();
    await db.from("people").update({
      aliases,
      notes: [person.notes, other.notes].filter(Boolean).join("\n"),
      relationship: person.relationship || other.relationship,
      first_mentioned: dates[0] ?? null,
      last_mentioned: lasts[lasts.length - 1] ?? null,
    }).eq("id", person.id);
    await db.from("people").delete().eq("id", other.id);
    setMergeId("");
    load();
  };

  const remove = async () => {
    if (!confirm(`Remove ${person.name}? Their dreams stay in your journal.`)) return;
    await supabase().from("people").delete().eq("id", person.id);
    router.push("/people");
  };

  return (
    <>
      <div className="topbar"><Link href="/people" className="btn ghost chip">← People</Link></div>

      <div className="card">
        <label className="label">Name</label>
        <input value={person.name} onChange={(e) => update("name", e.target.value)} />
        <label className="label" style={{ marginTop: 12 }}>Relationship</label>
        <input placeholder="friend, sister, coworker…" value={person.relationship} onChange={(e) => update("relationship", e.target.value)} />
        <label className="label" style={{ marginTop: 12 }}>Also called</label>
        <input placeholder="my sister, Em" value={person.aliases.join(", ")}
          onChange={(e) => update("aliases", e.target.value.split(",").map((s) => s.trim()))} />
        <label className="label" style={{ marginTop: 12 }}>Notes</label>
        <textarea value={person.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Small things you've mentioned…" />
        <p className="muted small">
          {person.first_mentioned && <>First mentioned {parseLocal(person.first_mentioned).toLocaleDateString()}</>}
          {person.last_mentioned && <> · latest {parseLocal(person.last_mentioned).toLocaleDateString()}</>}
        </p>
        <button className="primary" onClick={save}>{saved ? "Saved ✓" : "Save"}</button>
      </div>

      <span className="label">Dreams with {person.name}</span>
      {dreams.length === 0 && <p className="muted">None yet.</p>}
      {dreams.map((e) => (
        <Link key={e.id} href={`/dream/${e.id}`} className="card list-item" style={{ display: "block" }}>
          <div className="spread">
            <span style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{entryIcon(e)} {e.title}</span>
            <span className="muted small">{parseLocal(e.entry_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          </div>
        </Link>
      ))}

      {others.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <span className="label">Merge a duplicate into {person.name}</span>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <select value={mergeId} onChange={(e) => setMergeId(e.target.value)}>
              <option value="">Choose someone…</option>
              {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <button onClick={merge} disabled={!mergeId}>Merge</button>
          </div>
        </div>
      )}
      <button className="ghost danger" onClick={remove}>Remove {person.name}</button>
    </>
  );
}
