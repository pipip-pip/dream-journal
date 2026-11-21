"use client";
// Calls /api/dream and streams the text back as it's written.
import type { DreamRequest } from "./types";

export async function streamDream(
  req: DreamRequest,
  onText: (soFar: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch("/api/dream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.body) throw new Error("The dream writer didn't answer.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText(text);
  }
  const err = text.match(/\[\[ERROR:(.*?)\]\]/);
  if (err) throw new Error(err[1]);
  const saved = text.match(/\[\[SAVED:([\w-]+)\]\]/);
  if (!saved) throw new Error("The connection dropped before the dream was saved. Try again.");
  return saved[1];
}

/** Pull title and story out of half-finished JSON so they appear while streaming. */
export function partialDream(raw: string): { title: string; story: string } {
  const grab = (key: string) => {
    const m = raw.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`));
    if (!m) return "";
    try { return JSON.parse(`"${m[1].replace(/\\$/, "")}"`); } catch { return m[1].replace(/\\n/g, "\n"); }
  };
  return { title: grab("title"), story: grab("story") };
}
