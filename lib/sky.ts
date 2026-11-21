// Season and moon phase for a date. Used to seed dreams (and "Surprise me").
import { HEMISPHERE } from "./config";

export function season(date: Date): string {
  const m = date.getMonth(); // 0 = January
  const north = m < 2 || m === 11 ? "winter" : m < 5 ? "spring" : m < 8 ? "summer" : "autumn";
  if (HEMISPHERE === "north") return north;
  return { winter: "summer", spring: "autumn", summer: "winter", autumn: "spring" }[north]!;
}

/** Approximate moon phase (accurate to about a day). */
export function moonPhase(date: Date): string {
  const synodic = 29.530588853;
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
  const age = ((((date.getTime() - knownNewMoon) / 86400000) % synodic) + synodic) % synodic;
  const names = ["new moon", "waxing crescent", "first quarter", "waxing gibbous",
                 "full moon", "waning gibbous", "last quarter", "waning crescent"];
  return names[Math.round((age / synodic) * 8) % 8];
}

/** Today's date as YYYY-MM-DD in the device's own timezone. */
export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse YYYY-MM-DD as a local date at noon (avoids timezone off-by-one). */
export function parseLocal(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
