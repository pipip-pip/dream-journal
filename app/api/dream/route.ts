// POST /api/dream — writes a dream with Claude and saves it.
//
// Flow: check login → check daily limit → build the prompt from your check-in,
// people, threads and rituals → stream Claude's text back to the browser →
// when finished, parse the JSON and save the entry, people, threads, fragment.
//
// The response is plain text: Claude's raw JSON as it's written, then one final
// marker line: [[SAVED:<entry id>]] on success, or [[ERROR:<friendly message>]].
//
// Privacy: this file never logs the text of your check-ins or dreams.
import Anthropic from "@anthropic-ai/sdk";
import { serverSupabase } from "@/lib/supabase/server";
import { SYSTEM_PROMPT } from "@/lib/prompt";
import { CLAUDE_MODEL, DEFAULT_DAILY_LIMIT } from "@/lib/config";
import { moonPhase, parseLocal, season } from "@/lib/sky";
import { DEFAULT_SETTINGS, LENGTHS, MODES, MOODS, TONES,
         type DreamRequest, type DreamResult, type Person, type Settings } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300; // seconds; long dreams can take a while (Vercel Hobby allows up to 300)

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY

const text = (msg: string, status = 200) =>
  new Response(`[[ERROR:${msg}]]`, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function POST(req: Request) {
  // 1. Must be logged in (and, if ALLOWED_EMAIL is set, be that person).
  const db = await serverSupabase();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return text("Please log in again.", 401);
  const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  if (allowed && user.email?.toLowerCase() !== allowed) return text("This account can't write dreams.", 403);
  if (!process.env.ANTHROPIC_API_KEY) return text("The server has no Anthropic API key yet. Add ANTHROPIC_API_KEY.", 500);

  // 2. Validate input.
  let body: DreamRequest;
  try { body = await req.json(); } catch { return text("That request didn't make sense.", 400); }
  const tone = TONES.includes(body.tone) ? body.tone : "peaceful";
  const length = LENGTHS.includes(body.length) ? body.length : "medium";
  const mode = MODES.includes(body.mode) ? body.mode : "tonight";
  const mood = body.mood && MOODS.includes(body.mood) ? body.mood : null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date ?? "") ? body.date : new Date().toISOString().slice(0, 10);
  const checkIn = cleanCheckIn(body.checkIn);

  // 3. Settings and daily limit (counted over the last 24 hours).
  const { data: s } = await db.from("settings").select("*").maybeSingle();
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(s ?? {}) };
  const limit = settings.daily_limit || DEFAULT_DAILY_LIMIT;
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await db.from("generations").select("id", { count: "exact", head: true }).gte("created_at", since);
  if ((count ?? 0) >= limit) {
    return text(`You've reached today's limit of ${limit} dreams. You can change it in Settings.`, 429);
  }
  await db.from("generations").insert({});

  // 4. Memory: people, open threads, recent rituals.
  const [{ data: people }, { data: threads }, { data: rituals }] = await Promise.all([
    db.from("people").select("*").order("last_mentioned", { ascending: false, nullsFirst: false }).limit(200),
    db.from("threads").select("summary, follow_up_hint").eq("resolved", false).order("created_at", { ascending: false }).limit(5),
    db.from("rituals").select("kind, text").gte("created_at", new Date(Date.now() - 3 * 86400000).toISOString())
      .neq("text", "").order("created_at", { ascending: false }).limit(2),
  ]);
  const prompt = buildPrompt({ checkIn, mood, tone, length, mode, date, settings,
    people: (people ?? []) as Person[], threads: threads ?? [], rituals: rituals ?? [] });

  // 5. Stream from Claude, then save.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const write = (t: string) => controller.enqueue(encoder.encode(t));
      try {
        const claude = anthropic.beta.messages.stream({
          model: CLAUDE_MODEL,
          max_tokens: 8000,
          output_config: { effort: "medium" },
          // If the model declines, the API quietly finishes on a fallback model.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: prompt }],
        } as any);
        req.signal.addEventListener("abort", () => claude.abort());

        let raw = "";
        for await (const event of claude as AsyncIterable<any>) {
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
            raw += event.delta.text;
            write(event.delta.text);
          }
        }
        const final: any = await (claude as any).finalMessage();
        if (final.stop_reason === "refusal") throw new Friendly("This dream couldn't be written. Try changing a few words.");
        if (final.stop_reason === "max_tokens") throw new Friendly("The dream ran too long and was cut off. Try again.");

        const result = parseDream(raw);
        if (!result) throw new Friendly("The dream came out jumbled. Try again.");
        if (!settings.waking_thought) result.wakingThought = "";

        const id = await saveDream(db, { result, checkIn, mood, tone, length, mode, date, people: (people ?? []) as Person[] });
        write(`\n[[SAVED:${id}]]`);
      } catch (err) {
        write(`\n[[ERROR:${friendlyError(err)}]]`);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

// ───────────── helpers ─────────────

class Friendly extends Error {}

function friendlyError(err: unknown): string {
  if (err instanceof Friendly) return err.message;
  // Log only the kind of error, never the content.
  console.error("dream error:", err instanceof Anthropic.APIError ? `API ${err.status}` : (err as Error)?.name);
  if (err instanceof Anthropic.AuthenticationError) return "The Anthropic API key looks invalid.";
  if (err instanceof Anthropic.RateLimitError) return "Too many requests right now. Try again in a minute.";
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach the dream writer. Check your connection.";
  if (err instanceof Anthropic.APIError && (err.status ?? 0) >= 500) return "The dream writer is busy. Try again shortly.";
  return "Something went wrong while dreaming. Try again.";
}

function cleanCheckIn(c: any): DreamRequest["checkIn"] {
  const s = (v: unknown) => (typeof v === "string" ? v.slice(0, 4000).trim() : "");
  return {
    text: s(c?.text), good: s(c?.good), bothered: s(c?.bothered),
    noticed: s(c?.noticed), ate: s(c?.ate), body: s(c?.body), surprise: !!c?.surprise,
  };
}

function buildPrompt(o: {
  checkIn: DreamRequest["checkIn"]; mood: string | null; tone: string; length: string; mode: string; date: string;
  settings: Settings; people: Person[]; threads: { summary: string; follow_up_hint: string }[];
  rituals: { kind: string; text: string }[];
}) {
  const d = parseLocal(o.date);
  const c = o.checkIn;
  const lines = [
    c.text && `What happened: ${c.text}`,
    c.good && `One good thing: ${c.good}`,
    c.bothered && `Something that bothered me: ${c.bothered}`,
    c.noticed && `Something I noticed: ${c.noticed}`,
    c.ate && `What I ate: ${c.ate}`,
    c.body && `How my body feels: ${c.body}`,
  ].filter(Boolean);

  // Send people who are mentioned today, plus a few recent ones, to keep the prompt short.
  const all = (c.text + " " + Object.values(c).join(" ")).toLowerCase();
  const mentioned = o.people.filter((p) => [p.name, ...p.aliases].some((n) => n && all.includes(n.toLowerCase())));
  const recent = o.people.filter((p) => !mentioned.includes(p)).slice(0, 4);
  const peopleText = [...mentioned, ...recent].map((p) =>
    `- ${p.name}${p.relationship ? ` (${p.relationship})` : ""}${p.notes ? `: ${p.notes.split("\n").slice(-3).join("; ")}` : ""}`,
  ).join("\n");

  const lit = o.settings.literalness;
  const literal = lit < 34 ? "Stay fairly close to real life; only a few dreamlike touches."
    : lit > 66 ? "Make it fully dreamlike; real details may transform freely." : "Balance real details with dream logic.";

  return [
    `Date: ${d.toDateString()} · season: ${season(d)} · moon: ${moonPhase(d)}`,
    `Mode: ${o.mode === "morning" ? "Morning dream (hopeful, about the day ahead)" : "Tonight's dream (about today)"}`,
    `Mood: ${o.mood ?? "not given"} · Tone: ${o.tone} · Length: ${o.length}`,
    `How literal: ${literal}`,
    `Hard topics: ${o.settings.hard_topics === "soften" ? "soften heavy things a lot" : "reflect heavy things gently and honestly"}`,
    o.settings.waking_thought ? "" : `Leave "wakingThought" as an empty string.`,
    "",
    peopleText ? `People the reader knows:\n${peopleText}` : "",
    o.threads.length ? `Open threads in the reader's life:\n${o.threads.map((t) => `- ${t.summary}${t.follow_up_hint ? ` (${t.follow_up_hint})` : ""}`).join("\n")}` : "",
    o.rituals.length ? `Before sleep recently, the reader wrote:\n${o.rituals.map((r) => `- ${r.kind === "worry" ? "A worry they let drift away" : "An intention"}: ${r.text}`).join("\n")}\n(You may reflect these very gently.)` : "",
    "",
    c.surprise || lines.length === 0
      ? "The reader shared nothing today. Write a dream seeded only by the date, season and moon. Treat rest as a gift. Return empty peopleMentioned and newThreads."
      : `The reader's check-in:\n${lines.join("\n")}`,
  ].filter((l) => l !== "").join("\n");
}

/** Pull the JSON object out of Claude's reply (tolerates stray text or ``` fences). */
function parseDream(raw: string): DreamResult | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const j = JSON.parse(raw.slice(start, end + 1));
    if (typeof j.story !== "string" || !j.story.trim()) return null;
    return {
      title: String(j.title ?? "Untitled dream"),
      story: j.story,
      wakingThought: String(j.wakingThought ?? ""),
      fragment: { name: String(j.fragment?.name ?? ""), description: String(j.fragment?.description ?? "") },
      peopleMentioned: Array.isArray(j.peopleMentioned) ? j.peopleMentioned.filter((p: any) => p?.name) : [],
      newThreads: Array.isArray(j.newThreads) ? j.newThreads.filter((t: any) => t?.summary) : [],
    };
  } catch {
    return null;
  }
}

async function saveDream(db: Awaited<ReturnType<typeof serverSupabase>>, o: {
  result: DreamResult; checkIn: DreamRequest["checkIn"]; mood: string | null; tone: string;
  length: string; mode: string; date: string; people: Person[];
}): Promise<string> {
  const { result: r } = o;
  const { data: entry, error } = await db.from("entries").insert({
    entry_date: o.date, check_in: o.checkIn, mood: o.mood, tone: o.tone, length: o.length, mode: o.mode,
    title: r.title, story: r.story, waking_thought: r.wakingThought,
  }).select("id").single();
  if (error || !entry) throw new Friendly("The dream was written but couldn't be saved. Try again.");

  // Fragment
  if (r.fragment.name) {
    await db.from("fragments").insert({ entry_id: entry.id, name: r.fragment.name, description: r.fragment.description });
  }

  // People: match by name or alias (case-insensitive); add new ones automatically.
  const known = [...o.people];
  const find = (name: string) => known.find((p) => [p.name, ...p.aliases].some((n) => n.toLowerCase() === name.toLowerCase()));
  const linked = new Set<string>();
  for (const m of r.peopleMentioned.slice(0, 12)) {
    const name = String(m.name).trim().slice(0, 80);
    if (!name) continue;
    const existing = find(name);
    const note = String(m.newNotes ?? "").trim();
    if (existing) {
      const notes = note && !existing.notes.includes(note) ? [existing.notes, note].filter(Boolean).join("\n") : existing.notes;
      await db.from("people").update({
        last_mentioned: o.date, notes,
        relationship: existing.relationship || String(m.relationship ?? ""),
      }).eq("id", existing.id);
      linked.add(existing.id);
    } else {
      const { data: p } = await db.from("people").insert({
        name, relationship: String(m.relationship ?? ""), notes: note,
        first_mentioned: o.date, last_mentioned: o.date,
      }).select("*").single();
      if (p) { known.push(p as Person); linked.add(p.id); }
    }
  }
  if (linked.size) {
    await db.from("entry_people").insert([...linked].map((person_id) => ({ entry_id: entry.id, person_id })));
  }

  // Threads
  if (r.newThreads.length) {
    await db.from("threads").insert(r.newThreads.slice(0, 5).map((t) => ({
      summary: String(t.summary).slice(0, 300), follow_up_hint: String(t.followUpHint ?? "").slice(0, 300),
    })));
  }
  return entry.id;
}
