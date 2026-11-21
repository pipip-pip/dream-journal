"use client";
// Theme follows the time of day ("auto") unless you pick Day or Night.
// The choice is remembered on this device.
import { useEffect, useState } from "react";

type Choice = "auto" | "day" | "night";
const KEY = "dj-theme";

export function resolveTheme(choice: Choice): "day" | "night" {
  if (choice !== "auto") return choice;
  const h = new Date().getHours();
  return h >= 6 && h < 18 ? "day" : "night";
}

export default function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>("auto");

  useEffect(() => {
    try { setChoice((localStorage.getItem(KEY) as Choice) || "auto"); } catch {}
  }, []);

  useEffect(() => {
    const apply = () => document.documentElement.setAttribute("data-theme", resolveTheme(choice));
    apply();
    const t = setInterval(apply, 5 * 60 * 1000); // re-check every 5 minutes in auto mode
    return () => clearInterval(t);
  }, [choice]);

  const next = () => {
    const order: Choice[] = ["auto", "night", "day"];
    const c = order[(order.indexOf(choice) + 1) % 3];
    setChoice(c);
    try { localStorage.setItem(KEY, c); } catch {}
  };

  const label = { auto: "🌗 Auto", night: "🌙 Night", day: "🌅 Day" }[choice];
  return <button className="ghost chip" onClick={next} aria-label="Change theme">{label}</button>;
}

/** Inline script that sets the theme before the page paints (prevents a flash). */
export const themeScript = `(function(){try{var c=localStorage.getItem('${KEY}')||'auto';var h=new Date().getHours();var t=c==='auto'?(h>=6&&h<18?'day':'night'):c;document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;
