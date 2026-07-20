import { NextRequest, NextResponse } from "next/server";
import { resolveProvider, ProviderId } from "@/lib/providers";

export async function POST(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const providerId = params.provider as ProviderId;

  try {
    const body = await request.json().catch(() => ({}));
    const key = body.key;
    const provider = resolveProvider(providerId, body.apiUrl);

    if (!provider) {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }

    const valid = await provider.validateKey(key || "");
    let models: Awaited<ReturnType<typeof provider.fetchModels>> = [];

    if (valid) {
      models = await provider.fetchModels(key);
    }

    return NextResponse.json({ valid, modelCount: models.length, models });
  } catch (error) {
    return NextResponse.json({ valid: false, error: String(error) });
  }
}
