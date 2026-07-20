// Voice Mode: per-persona text-to-speech via the Web Speech API. Zero dependencies.
// Each persona gets a deterministic voice + pitch/rate so combatants sound distinct.

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const all = window.speechSynthesis.getVoices();
  const english = all.filter((v) => v.lang.startsWith("en"));
  return english.length > 0 ? english : all;
}

// Some browsers load voices asynchronously — warm the cache early
export function initVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

export function speak(personaId: string, text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) return;

  const voices = getVoices();
  const hash = hashString(personaId);

  const utterance = new SpeechSynthesisUtterance(text);
  if (voices.length > 0) {
    utterance.voice = voices[hash % voices.length];
  }
  // Deterministic variation so the same persona always sounds the same
  utterance.pitch = 0.75 + (hash % 7) * 0.1; // 0.75 – 1.35
  utterance.rate = 0.9 + ((hash >> 3) % 5) * 0.075; // 0.9 – 1.2

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
