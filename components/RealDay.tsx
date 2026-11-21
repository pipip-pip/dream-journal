// Shows your original check-in for a day.
import { EXTRA_PROMPTS, MODE_LABEL, MOOD_EMOJI, TONE_LABEL, type Entry } from "@/lib/types";

export default function RealDay({ entry }: { entry: Entry }) {
  const c = entry.check_in ?? {};
  return (
    <div className="card fade-in">
      <span className="label">Your real day</span>
      {c.surprise ? (
        <p className="muted">You didn't share anything this day. It was a “Surprise me” dream.</p>
      ) : (
        <>
          {c.text && <p style={{ whiteSpace: "pre-wrap" }}>{c.text}</p>}
          {EXTRA_PROMPTS.map((p) => (c as any)[p.key] ? (
            <p key={p.key}><span className="muted small">{p.label}:</span><br />{(c as any)[p.key]}</p>
          ) : null)}
          {!c.text && !EXTRA_PROMPTS.some((p) => (c as any)[p.key]) && <p className="muted">No words this day.</p>}
        </>
      )}
      <p className="muted small">
        {entry.mood && <>{MOOD_EMOJI[entry.mood]} {entry.mood} · </>}{TONE_LABEL[entry.tone]} · {MODE_LABEL[entry.mode]}
      </p>
    </div>
  );
}
