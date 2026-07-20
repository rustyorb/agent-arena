// Detects messages that are (mostly) ASCII art so the UI can render them in
// monospace with preserved spacing instead of proportional prose. Personas
// that communicate in ASCII art are a first-class arena citizen.
export function looksLikeAsciiArt(content: string): boolean {
  const lines = content.split("\n");
  if (lines.length < 3) return false;

  let artLines = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 4) continue;
    const symbols = trimmed.replace(/[a-zA-Z0-9\s.,'"!?;:]/g, "").length;
    if (symbols / trimmed.length > 0.3) artLines++;
  }
  return artLines >= 3;
}
