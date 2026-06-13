import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@dsk/db";
import { FacebookPageAdapter } from "@dsk/integrations";

/**
 * Meta webhook endpoint (shared by Facebook, Instagram, WhatsApp surfaces).
 * GET: subscription verification challenge.
 * POST: signature-verified event ingestion -> persisted as WebhookEvent for
 * async processing by the worker. Always responds 200 fast (Meta retries).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

const signatureVerifier = new FacebookPageAdapter();

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!signatureVerifier.verifyWebhookSignature(rawBody, signature)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as { object?: string; entry?: Array<{ id?: string }> };
    const provider =
      payload.object === "whatsapp_business_account"
        ? "META_WHATSAPP_BUSINESS"
        : payload.object === "instagram"
          ? "META_INSTAGRAM_PROFESSIONAL"
          : "META_FACEBOOK_PAGE";

    await prisma.webhookEvent.create({
      data: {
        provider,
        eventType: payload.object ?? "unknown",
        externalId: payload.entry?.[0]?.id ?? null,
        payload: JSON.parse(rawBody),
      },
    });
  } catch (error) {
    // Never fail the webhook response; log and move on (Meta retries on non-200).
    console.error("[webhook:meta]", error);
  }

  return new NextResponse("OK", { status: 200 });
}
