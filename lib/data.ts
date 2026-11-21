"use client";
// Small helpers for reading and writing data from the browser.
// Recent entries are also cached on the device so you can read them offline.
import { supabase } from "./supabase/client";
import { DEFAULT_SETTINGS, type Entry, type Settings } from "./types";

const CACHE_KEY = "dj-entries-cache-v1";

/** Remember entries locally for offline reading (most recent 60). */
export function cacheEntries(list: Entry[]) {
  try {
    const old: Entry[] = JSON.parse(localStorage.getItem(CACHE_KEY) || "[]");
    const byId = new Map(old.map((e) => [e.id, e]));
    list.forEach((e) => byId.set(e.id, e));
    const merged = [...byId.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 60);
    localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
  } catch { /* storage full or blocked: fine, offline cache is a bonus */ }
}

export function cachedEntries(): Entry[] {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "[]"); } catch { return []; }
}

export function clearCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}

/** Load one entry; falls back to the offline cache. */
export async function getEntry(id: string): Promise<Entry | null> {
  try {
    const { data, error } = await supabase().from("entries").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (data) cacheEntries([data as Entry]);
    return (data as Entry) ?? null;
  } catch {
    return cachedEntries().find((e) => e.id === id) ?? null;
  }
}

/** Load all entries (newest first); falls back to the offline cache. */
export async function getEntries(): Promise<{ entries: Entry[]; offline: boolean }> {
  try {
    const { data, error } = await supabase().from("entries").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    cacheEntries((data ?? []).slice(0, 60) as Entry[]);
    return { entries: (data ?? []) as Entry[], offline: false };
  } catch {
    return { entries: cachedEntries(), offline: true };
  }
}

export async function getSettings(): Promise<Settings> {
  const { data } = await supabase().from("settings").select("*").maybeSingle();
  return { ...DEFAULT_SETTINGS, ...(data ?? {}) };
}

export async function saveSettings(s: Settings) {
  const { data: { user } } = await supabase().auth.getUser();
  if (!user) throw new Error("Not logged in");
  const { error } = await supabase().from("settings").upsert({ ...s, user_id: user.id, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Names of people who appeared in an entry. */
export async function peopleInEntry(entryId: string): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase().from("entry_people").select("people(id, name)").eq("entry_id", entryId);
  return (data ?? []).map((r: any) => r.people).filter(Boolean);
}
