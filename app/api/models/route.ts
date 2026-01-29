import { NextResponse } from "next/server";
import { providers, Model } from "@/lib/providers";

export async function GET() {
  const allModels: Model[] = [];
  
  // For local providers, try to fetch directly
  for (const [id, provider] of Object.entries(providers)) {
    if (!provider.requiresKey) {
      try {
        const models = await provider.fetchModels();
        allModels.push(...models);
      } catch {
        // Provider not available
      }
    }
  }
  
  // For cloud providers, we need to get keys from the request
  // In a real app, you'd fetch from DB or pass keys
  // For now, return hardcoded Anthropic models as they don't need API call
  const anthropicModels = await providers.anthropic.fetchModels();
  allModels.push(...anthropicModels);
  
  return NextResponse.json(allModels);
}
