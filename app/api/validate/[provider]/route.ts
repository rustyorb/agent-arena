import { NextRequest, NextResponse } from "next/server";
import { providers, ProviderId } from "@/lib/providers";

export async function POST(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const providerId = params.provider as ProviderId;
  const provider = providers[providerId];

  if (!provider) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const key = body.key;

    const valid = await provider.validateKey(key || "");
    let modelCount = 0;

    if (valid) {
      const models = await provider.fetchModels(key);
      modelCount = models.length;
    }

    return NextResponse.json({ valid, modelCount });
  } catch (error) {
    return NextResponse.json({ valid: false, error: String(error) });
  }
}
