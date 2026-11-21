"use client";
// Read-aloud using the browser's built-in voices (Web Speech API).

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  const preferred = ["Samantha", "Ava", "Karen", "Moira", "Serena", "Google UK English Female"];
  return preferred.map((n) => voices.find((v) => v.name.includes(n))).find(Boolean) ?? voices[0];
}

export function speak(text: string, onEnd: () => void) {
  speechSynthesis.cancel();
  // Speak paragraph by paragraph: long utterances get cut off on iOS.
  const parts = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  parts.forEach((p, i) => {
    const u = new SpeechSynthesisUtterance(p);
    u.rate = 0.82;
    u.pitch = 0.95;
    const v = pickVoice();
    if (v) u.voice = v;
    if (i === parts.length - 1) u.onend = onEnd;
    speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  if (canSpeak()) speechSynthesis.cancel();
}
