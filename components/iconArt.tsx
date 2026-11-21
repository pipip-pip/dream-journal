// The app icon artwork: a crescent moon and stars on a night gradient.
export function IconArt({ size }: { size: number }) {
  const s = size;
  return (
    <div style={{ width: s, height: s, display: "flex", position: "relative",
      background: "#141a45" }}>
      <div style={{ position: "absolute", left: s * 0.28, top: s * 0.22, width: s * 0.46, height: s * 0.46,
        borderRadius: "50%", background: "#e9e4ff", display: "flex" }} />
      <div style={{ position: "absolute", left: s * 0.4, top: s * 0.16, width: s * 0.44, height: s * 0.44,
        borderRadius: "50%", background: "#141a45", display: "flex" }} />
      {[[0.2, 0.72, 0.03], [0.72, 0.7, 0.022], [0.8, 0.3, 0.018], [0.5, 0.82, 0.015]].map(([x, y, r], i) => (
        <div key={i} style={{ position: "absolute", left: s * x, top: s * y, width: s * r * 2, height: s * r * 2,
          borderRadius: "50%", background: "#cfc4ff", display: "flex" }} />
      ))}
    </div>
  );
}
