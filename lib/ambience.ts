"use client";
// Ambient sounds made in the browser with Web Audio, so there are no audio files.
export type Ambience = "rain" | "night" | "wind";

let ctx: AudioContext | null = null;
let stopFns: (() => void)[] = [];

function noiseBuffer(ac: AudioContext, kind: "white" | "brown") {
  const buf = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "white") d[i] = w;
    else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  }
  return buf;
}

export function startAmbience(kind: Ambience) {
  stopAmbience();
  ctx ??= new AudioContext();
  const ac = ctx;
  ac.resume();
  const master = ac.createGain();
  master.gain.setValueAtTime(0, ac.currentTime);
  master.gain.linearRampToValueAtTime(0.35, ac.currentTime + 2); // gentle fade in
  master.connect(ac.destination);

  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, kind === "rain" ? "white" : "brown");
  src.loop = true;
  const filter = ac.createBiquadFilter();

  if (kind === "rain") { filter.type = "lowpass"; filter.frequency.value = 1400; }
  if (kind === "night") { filter.type = "lowpass"; filter.frequency.value = 500; }
  if (kind === "wind") {
    filter.type = "bandpass"; filter.frequency.value = 400; filter.Q.value = 0.8;
    // slow swells
    const lfo = ac.createOscillator(); const lfoGain = ac.createGain();
    lfo.frequency.value = 0.08; lfoGain.gain.value = 250;
    lfo.connect(lfoGain).connect(filter.frequency); lfo.start();
    stopFns.push(() => lfo.stop());
  }
  src.connect(filter).connect(master);
  src.start();
  stopFns.push(() => src.stop());

  // Night: soft, occasional crickets.
  if (kind === "night") {
    const timer = setInterval(() => {
      if (Math.random() < 0.5) return;
      const o = ac.createOscillator(); const g = ac.createGain();
      o.frequency.value = 4200 + Math.random() * 600;
      const t = ac.currentTime;
      for (let i = 0; i < 3; i++) {
        g.gain.setValueAtTime(0, t + i * 0.08);
        g.gain.linearRampToValueAtTime(0.02, t + i * 0.08 + 0.02);
        g.gain.linearRampToValueAtTime(0, t + i * 0.08 + 0.05);
      }
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.3);
    }, 1800);
    stopFns.push(() => clearInterval(timer));
  }

  stopFns.push(() => {
    master.gain.linearRampToValueAtTime(0, ac.currentTime + 0.5);
    setTimeout(() => master.disconnect(), 600);
  });
}

export function stopAmbience() {
  stopFns.forEach((f) => { try { f(); } catch {} });
  stopFns = [];
}
