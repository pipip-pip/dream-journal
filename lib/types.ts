// Shared data shapes, matching the tables in supabase/schema.sql.

export type Mood = "tired" | "anxious" | "sad" | "content" | "happy" | "restless" | "grateful";
export type Tone = "peaceful" | "mystical" | "eerie";
export type Length = "short" | "medium" | "long";
export type Mode = "tonight" | "morning";

export const MOODS: Mood[] = ["tired", "anxious", "sad", "content", "happy", "restless", "grateful"];
export const TONES: Tone[] = ["peaceful", "mystical", "eerie"];
export const LENGTHS: Length[] = ["short", "medium", "long"];
export const MODES: Mode[] = ["tonight", "morning"];

export const TONE_LABEL: Record<Tone, string> = { peaceful: "Peaceful", mystical: "Mystical", eerie: "Gently eerie" };
export const LENGTH_LABEL: Record<Length, string> = { short: "Short · 1 min", medium: "Medium · 3 min", long: "Long · 5 min" };
export const MODE_LABEL: Record<Mode, string> = { tonight: "Tonight's dream", morning: "Morning dream" };
export const MOOD_EMOJI: Record<Mood, string> = {
  tired: "😴", anxious: "😟", sad: "😢", content: "🙂", happy: "😊", restless: "🌀", grateful: "🙏",
};

/** The optional extra prompts on the check-in screen. */
export const EXTRA_PROMPTS = [
  { key: "good", label: "One good thing" },
  { key: "bothered", label: "One thing that bothered me" },
  { key: "noticed", label: "Something I noticed" },
  { key: "ate", label: "What I ate" },
  { key: "body", label: "How my body feels" },
] as const;

export interface CheckIn {
  text?: string;
  good?: string;
  bothered?: string;
  noticed?: string;
  ate?: string;
  body?: string;
  surprise?: boolean;
}

/** What the browser sends to /api/dream. */
export interface DreamRequest {
  checkIn: CheckIn;
  mood: Mood | null;
  tone: Tone;
  length: Length;
  mode: Mode;
  date: string; // YYYY-MM-DD in your local time
}

export interface Entry {
  id: string;
  entry_date: string;
  created_at: string;
  check_in: CheckIn;
  mood: Mood | null;
  tone: Tone;
  length: Length;
  mode: Mode;
  title: string;
  story: string;
  waking_thought: string;
}

export interface Person {
  id: string;
  name: string;
  aliases: string[];
  relationship: string;
  notes: string;
  first_mentioned: string | null;
  last_mentioned: string | null;
}

export interface Thread {
  id: string;
  summary: string;
  follow_up_hint: string;
  resolved: boolean;
  created_at: string;
}

export interface Fragment {
  id: string;
  entry_id: string | null;
  name: string;
  description: string;
  created_at: string;
}

export interface Ritual {
  id: string;
  entry_id: string | null;
  kind: "intention" | "worry";
  text: string;
  created_at: string;
}

export interface Settings {
  literalness: number;
  hard_topics: "reflect" | "soften";
  default_tone: Tone;
  default_length: Length;
  default_mode: Mode;
  waking_thought: boolean;
  daily_limit: number;
}

export const DEFAULT_SETTINGS: Settings = {
  literalness: 50,
  hard_topics: "reflect",
  default_tone: "peaceful",
  default_length: "medium",
  default_mode: "tonight",
  waking_thought: true,
  daily_limit: 20,
};

/** What Claude returns (see the system prompt). */
export interface DreamResult {
  title: string;
  story: string;
  wakingThought: string;
  fragment: { name: string; description: string };
  peopleMentioned: { name: string; relationship: string; newNotes: string }[];
  newThreads: { summary: string; followUpHint: string }[];
}

/** Calendar icon: heavy days get a cloud, happy days a sun, otherwise it follows the tone. */
export function entryIcon(e: Pick<Entry, "mood" | "tone">): string {
  if (e.mood === "sad" || e.mood === "anxious") return "☁️";
  if (e.mood === "happy" || e.mood === "grateful") return "☀️";
  if (e.tone === "mystical") return "✨";
  if (e.tone === "eerie") return "🌫️";
  return "🌙";
}
