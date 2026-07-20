// Kills the label feedback loop: models sometimes prefix replies with a name
// label ("Moss:", or a trained-in self-identity like "Dolphin:"). Once stored,
// the label gets mirrored back in context and compounds every turn until
// replies open with "Dolphin:Dolphin:Dolphin:...". Strip at the persistence
// boundary — surgically, so ASCII art and legit "Fun fact:" openers survive.
export function stripLeadingLabels(content: string, speakerName: string): string {
  let out = content.trimStart();

  // The speaker's own name as a label, possibly repeated: "Moss:", "Moss: Moss:"
  const esc = speakerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  out = out.replace(new RegExp(`^(?:${esc}\\s*:\\s*)+`, "i"), "");

  // Any identical label repeated 2+ times: "Dolphin:Dolphin:Dolphin: says hello"
  // A single foreign label is left alone — only the compounding chain is a bug.
  out = out.replace(/^([A-Za-z0-9 _'’.\-]{1,24}):\s*(?:\1:\s*)+/, "");

  return out.trimStart();
}
