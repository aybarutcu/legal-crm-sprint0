import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { handleGoogleWebhookNotification } from "@/lib/events/sync";

export const POST = withApiHandler(
  async (req) => {
    const headersRecord: Record<string, string> = {};
    for (const [key, value] of req.headers.entries()) {
      headersRecord[key.toLowerCase()] = value;
    }

    // Read body for potential future processing, even if unused now.
    await req.text();

    const result = await handleGoogleWebhookNotification({
      headers: headersRecord,
    });

    const statusCode = result.status === "queued" ? 202 : 200;
    return NextResponse.json(result, { status: statusCode });
  },
  {
    requireAuth: false,
    rateLimit: {
      limit: 120,
      windowMs: 60_000,
    },
  },
);
