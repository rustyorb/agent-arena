// Pull the first JSON object out of a model response that may include prose or ```json fences
export function extractJson(text: string): any {
  const cleaned = text.replace(/```(?:json)?/g, "");
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Model response contained no JSON");
  return JSON.parse(match[0]);
}
