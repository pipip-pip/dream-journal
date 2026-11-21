// Slow drifting specks of light in the background (pure CSS, very light on battery).
const SPECKS = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 53) % 100,
  delay: (i * 3.7) % 30,
  duration: 28 + ((i * 7) % 20),
  size: 2 + (i % 3),
}));

export default function Particles() {
  return (
    <div className="particles" aria-hidden>
      {SPECKS.map((s, i) => (
        <i key={i} style={{ left: `${s.left}%`, width: s.size, height: s.size,
          animationDelay: `-${s.delay}s`, animationDuration: `${s.duration}s` }} />
      ))}
    </div>
  );
}
