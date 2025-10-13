import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiHandler } from "@/lib/api-handler";
import { createSignedDownloadUrl } from "@/lib/storage";

const DOWNLOAD_URL_TTL = parseInt(
  process.env.SIGNED_URL_TTL_SECONDS ?? "300",
  10,
);

type Params = { params: { id: string } | Promise<{ id: string }> };

export const GET = withApiHandler<Params>(async (_req, context) => {
  const params = await Promise.resolve(context.params);
  const id = params?.id;

  if (!id) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const document = await prisma.document.findUnique({
    where: { id },
    select: { storageKey: true, mime: true },
  });

  if (!document) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const getUrl = await createSignedDownloadUrl({
    key: document.storageKey,
    expiresIn: DOWNLOAD_URL_TTL,
  });

  return NextResponse.json({
    getUrl,
    mime: document.mime,
    expiresAt: new Date(Date.now() + DOWNLOAD_URL_TTL * 1000).toISOString(),
  });
});
