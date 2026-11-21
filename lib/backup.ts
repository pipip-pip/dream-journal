"use client";
// Export everything to a JSON file, and import it back.
// The importer also understands both formats from the old app:
//   - "dream-journal" (version 2): entries, people, threads, settings
//   - "lanternwood" (version 1): entries with keepsakes and reflections, village characters
import { supabase } from "./supabase/client";
import { clearCache } from "./data";
import { DEFAULT_SETTINGS, LENGTHS, MOODS, TONES, type Settings } from "./types";

export const EXPORT_APP = "dream-journal-cloud";

export async function exportAll() {
  const db = supabase();
  const get = async (t: string) => (await db.from(t).select("*")).data ?? [];
  const [entries, people, entry_people, threads, fragments, rituals, settings] = await Promise.all(
    ["entries", "people", "entry_people", "threads", "fragments", "rituals", "settings"].map(get),
  );
  // search_text is computed by the database, so leave it out
  return {
    app: EXPORT_APP, version: 3, exportedAt: new Date().toISOString(),
    entries: entries.map(({ search_text, user_id, ...e }: any) => e),
    people: people.map(({ user_id, ...p }: any) => p),
    entry_people: entry_people.map(({ user_id, ...x }: any) => x),
    threads: threads.map(({ user_id, ...t }: any) => t),
    fragments: fragments.map(({ user_id, ...f }: any) => f),
    rituals: rituals.map(({ user_id, ...r }: any) => r),
    settings: settings[0] ? (({ user_id, ...s }: any) => s)(settings[0]) : null,
  };
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export interface ImportSummary { entries: number; people: number; threads: number; fragments: number; rituals: number; settings: boolean; skipped: number; duplicates: number }

// ── Normalized shape every format is converted into before saving ──
interface NEntry {
  key: string; // used to link people to entries
  created_at: string; entry_date: string; check_in: any; mood: string | null; tone: string; length: string; mode: string;
  title: string; story: string; waking_thought: string;
  fragment?: { name: string; description: string };
  ritual?: { kind: "intention" | "worry"; text: string; at: string };
  peopleNames: string[];
}
interface NPerson { name: string; aliases: string[]; relationship: string; notes: string; first?: string | null; last?: string | null; entryKeys: string[] }
interface NThread { summary: string; follow_up_hint: string; resolved: boolean; created_at?: string }

const str = (v: unknown) => (typeof v === "string" ? v : "");
const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);
const fixTone = (t: unknown) => (TONES.includes(t as any) ? (t as string) : "peaceful"); // "cozy" → peaceful
const fixMode = (m: unknown) => (m === "morning" ? "morning" : "tonight");                // "evening" → tonight
const fixRitual = (k: unknown): "intention" | "worry" => (k === "worry" || k === "boat" ? "worry" : "intention"); // lantern → intention

function normalize(data: any): { entries: NEntry[]; people: NPerson[]; threads: NThread[]; settings: Partial<Settings> | null; rituals: { entryKey: string; kind: "intention" | "worry"; text: string; created_at: string }[]; skipped: number } {
  let skipped = 0;
  const entries: NEntry[] = [];
  const people: NPerson[] = [];
  const extraRituals: { entryKey: string; kind: "intention" | "worry"; text: string; created_at: string }[] = [];

  if (data.app === EXPORT_APP) {
    // This app's own backup.
    const peopleById = new Map<string, any>((data.people ?? []).map((p: any) => [p.id, p]));
    const fragByEntry = new Map<string, any>((data.fragments ?? []).map((f: any) => [f.entry_id, f]));
    for (const e of data.entries ?? []) {
      if (!e?.story || !isDate(e.entry_date)) { skipped++; continue; }
      entries.push({
        key: e.id, created_at: e.created_at, entry_date: e.entry_date.slice(0, 10), check_in: e.check_in ?? {},
        mood: MOODS.includes(e.mood) ? e.mood : null, tone: fixTone(e.tone), length: LENGTHS.includes(e.length) ? e.length : "medium",
        mode: fixMode(e.mode), title: str(e.title), story: e.story, waking_thought: str(e.waking_thought),
        fragment: fragByEntry.get(e.id), peopleNames: [],
      });
    }
    for (const p of data.people ?? []) {
      if (!p?.name) { skipped++; continue; }
      people.push({ name: p.name, aliases: p.aliases ?? [], relationship: str(p.relationship), notes: str(p.notes),
        first: p.first_mentioned, last: p.last_mentioned,
        entryKeys: (data.entry_people ?? []).filter((x: any) => x.person_id === p.id).map((x: any) => x.entry_id) });
    }
    for (const r of data.rituals ?? []) {
      if (r?.entry_id) extraRituals.push({ entryKey: r.entry_id, kind: fixRitual(r.kind), text: str(r.text), created_at: r.created_at });
    }
    void peopleById;
  } else if (data.app === "dream-journal" || data.app === "lanternwood") {
    // The old app (either format).
    for (const e of data.entries ?? []) {
      if (!e?.story || !isDate(e.date)) { skipped++; continue; }
      const c = e.checkIn ?? {};
      const frag = e.fragment ?? e.keepsake;
      entries.push({
        key: String(e.id), created_at: isDate(e.id) ? e.id : new Date(e.date).toISOString(), entry_date: e.date.slice(0, 10),
        check_in: { text: str(c.text), good: str(c.good), bothered: str(c.bothered), noticed: str(c.noticed),
                    ate: str(c.ate), body: str(c.body), surprise: !!c.surprise },
        mood: MOODS.includes(c.mood) ? c.mood : null, tone: fixTone(c.tone), length: LENGTHS.includes(c.length) ? c.length : "medium",
        mode: fixMode(c.mode), title: str(e.title), story: e.story,
        waking_thought: str(e.wakingThought ?? e.reflection),
        fragment: frag?.name ? { name: str(frag.name), description: str(frag.description) } : undefined,
        ritual: e.ritual?.text != null ? { kind: fixRitual(e.ritual.kind), text: str(e.ritual.text), at: str(e.ritual.at) } : undefined,
        peopleNames: Array.isArray(e.people) ? e.people.filter((n: any) => typeof n === "string") : [],
      });
    }
    for (const p of data.people ?? []) {
      if (!p?.name) { skipped++; continue; }
      people.push({ name: p.name, aliases: Array.isArray(p.aliases) ? p.aliases : [], relationship: str(p.relationship),
        notes: str(p.notes), first: p.firstMentioned, last: p.lastMentioned, entryKeys: Array.isArray(p.dreamIds) ? p.dreamIds.map(String) : [] });
    }
    // Lanternwood village characters → people, using the real person's name.
    for (const ch of data.characters ?? []) {
      const name = str(ch?.realPerson).trim();
      if (!name) { skipped++; continue; }
      people.push({ name, aliases: [], relationship: "", notes: "", entryKeys: [] });
    }
  } else {
    throw new Error("This file doesn't look like a Dream Journal or Lanternwood export.");
  }

  const threads: NThread[] = [];
  for (const t of data.threads ?? []) {
    if (!t?.summary) { skipped++; continue; }
    threads.push({ summary: t.summary, follow_up_hint: str(t.follow_up_hint ?? t.followUpHint), resolved: !!t.resolved,
      created_at: isDate(t.created_at ?? t.createdAt) ? (t.created_at ?? t.createdAt) : undefined });
  }

  let settings: Partial<Settings> | null = null;
  const s = data.settings;
  if (s && typeof s === "object") {
    settings = {
      literalness: typeof s.literalness === "number" ? s.literalness : undefined,
      hard_topics: (s.hard_topics ?? s.hardTopics) === "soften" ? "soften" : "reflect",
      default_tone: fixTone(s.default_tone ?? s.defaultTone) as any,
      default_length: LENGTHS.includes(s.default_length ?? s.defaultLength) ? (s.default_length ?? s.defaultLength) : "medium",
      default_mode: fixMode(s.default_mode ?? s.defaultMode),
      waking_thought: (s.waking_thought ?? s.showReflection) !== false,
      daily_limit: typeof s.daily_limit === "number" ? s.daily_limit : undefined,
    };
    Object.keys(settings).forEach((k) => (settings as any)[k] === undefined && delete (settings as any)[k]);
  }
  return { entries, people, threads, settings, rituals: extraRituals, skipped };
}

export async function importAll(data: any): Promise<ImportSummary> {
  const db = supabase();
  const n = normalize(data);
  const sum: ImportSummary = { entries: 0, people: 0, threads: 0, fragments: 0, rituals: 0, settings: false, skipped: n.skipped, duplicates: 0 };

  // Skip entries already in the journal (same creation time and title).
  const { data: existing } = await db.from("entries").select("id, created_at, title");
  const seen = new Set((existing ?? []).map((e: any) => `${new Date(e.created_at).getTime()}|${e.title}`));
  const keyToId = new Map<string, string>();

  for (const e of n.entries) {
    const sig = `${new Date(e.created_at).getTime()}|${e.title}`;
    if (seen.has(sig)) { sum.duplicates++; continue; }
    const { data: row, error } = await db.from("entries").insert({
      created_at: e.created_at, entry_date: e.entry_date, check_in: e.check_in, mood: e.mood, tone: e.tone,
      length: e.length, mode: e.mode, title: e.title, story: e.story, waking_thought: e.waking_thought,
    }).select("id").single();
    if (error || !row) { sum.skipped++; continue; }
    seen.add(sig);
    keyToId.set(e.key, row.id);
    sum.entries++;
    if (e.fragment?.name) {
      await db.from("fragments").insert({ entry_id: row.id, name: e.fragment.name, description: e.fragment.description, created_at: e.created_at });
      sum.fragments++;
    }
    if (e.ritual) {
      await db.from("rituals").insert({ entry_id: row.id, kind: e.ritual.kind, text: e.ritual.text, created_at: isDate(e.ritual.at) ? e.ritual.at : e.created_at });
      sum.rituals++;
    }
  }
  for (const r of n.rituals) {
    const id = keyToId.get(r.entryKey);
    if (!id) continue;
    await db.from("rituals").insert({ entry_id: id, kind: r.kind, text: r.text, created_at: r.created_at });
    sum.rituals++;
  }

  // People: merge with anyone already known by the same name.
  const { data: known } = await db.from("people").select("*");
  const people = [...(known ?? [])] as any[];
  const findPerson = (name: string) => people.find((p) => [p.name, ...(p.aliases ?? [])].some((x: string) => x.toLowerCase() === name.toLowerCase()));
  // Entries that list people by name (old format) also count as links.
  for (const e of n.entries) for (const name of e.peopleNames) {
    let p = n.people.find((x) => [x.name, ...x.aliases].some((a) => a.toLowerCase() === name.toLowerCase()));
    if (!p) { p = { name, aliases: [], relationship: "", notes: "", entryKeys: [] }; n.people.push(p); }
    if (!p.entryKeys.includes(e.key)) p.entryKeys.push(e.key);
  }
  for (const p of n.people) {
    let row = findPerson(p.name);
    if (!row) {
      const ins = await db.from("people").insert({
        name: p.name, aliases: p.aliases, relationship: p.relationship, notes: p.notes,
        first_mentioned: isDate(p.first) ? p.first : null, last_mentioned: isDate(p.last) ? p.last : null,
      }).select("*").single();
      if (!ins.data) { sum.skipped++; continue; }
      row = ins.data; people.push(row); sum.people++;
    }
    const links = p.entryKeys.map((k) => keyToId.get(k)).filter(Boolean).map((entry_id) => ({ entry_id, person_id: row.id }));
    if (links.length) await db.from("entry_people").upsert(links, { ignoreDuplicates: true });
  }

  // Threads (skip ones with the same summary).
  const { data: kt } = await db.from("threads").select("summary");
  const ts = new Set((kt ?? []).map((t: any) => t.summary));
  const newThreads = n.threads.filter((t) => !ts.has(t.summary));
  if (newThreads.length) {
    const { error } = await db.from("threads").insert(newThreads);
    if (!error) sum.threads = newThreads.length;
  }

  if (n.settings && Object.keys(n.settings).length) {
    const { data: { user } } = await db.auth.getUser();
    const { data: cur } = await db.from("settings").select("*").maybeSingle();
    await db.from("settings").upsert({ ...DEFAULT_SETTINGS, ...(cur ?? {}), ...n.settings, user_id: user!.id });
    sum.settings = true;
  }
  clearCache();
  return sum;
}

/** Delete everything you've stored. (The daily-limit counter is kept on purpose.) */
export async function deleteAll() {
  const db = supabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Not logged in");
  // Deleting entries also removes their fragments, rituals and people links.
  for (const t of ["entries", "fragments", "rituals", "people", "threads", "settings"]) {
    const { error } = await db.from(t).delete().eq("user_id", user.id);
    if (error) throw error;
  }
  clearCache();
}
