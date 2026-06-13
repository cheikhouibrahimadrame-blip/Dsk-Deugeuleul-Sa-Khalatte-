import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dsk/db";
import { TikTokAdapter } from "@dsk/integrations";

const adapter = new TikTokAdapter();

/**
 * TikTok webhook endpoint - fully separate from Meta.
 * Receives publish status updates and account events; persisted as
 * WebhookEvent rows for the worker to process.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-tiktok-signature");

  if (!adapter.verifyWebhookSignature(rawBody, signature)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as { event?: string; client_key?: string };
    await prisma.webhookEvent.create({
      data: {
        provider: "TIKTOK",
        eventType: payload.event ?? "unknown",
        payload: JSON.parse(rawBody),
      },
    });
  } catch (error) {
    console.error("[webhook:tiktok]", error);
  }

  return new NextResponse("OK", { status: 200 });
}
