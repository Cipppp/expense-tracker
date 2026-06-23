import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { putPhoto, deletePhoto, presignGet, photosConfigured } from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 6 * 1024 * 1024; // 6MB — the client downscales before upload

// Upload (or replace) the photo on a gratitude entry. The browser sends an
// already-downscaled JPEG (EXIF/GPS stripped client-side via canvas).
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!photosConfigured) {
    return NextResponse.json(
      { error: "Stocarea pozelor nu e configurată." },
      { status: 503 },
    );
  }
  const { id } = await ctx.params;
  const item = await db.gratitudeItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Lipsește poza" }, { status: 400 });
  }
  const type = file.type || "image/jpeg";
  if (!type.startsWith("image/")) {
    return NextResponse.json({ error: "Trebuie o imagine" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Poza e prea mare" }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  // Random, unguessable key under the entry's folder.
  const key = `gratitude/${id}/${crypto.randomUUID()}.${ext}`;

  await putPhoto(key, buf, type);

  // Replace any previous photo for this entry.
  if (item.photoKey && item.photoKey !== key) {
    await deletePhoto(item.photoKey);
  }
  await db.gratitudeItem.update({ where: { id }, data: { photoKey: key } });

  const url = await presignGet(key);
  return NextResponse.json({ ok: true, photoUrl: url });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const item = await db.gratitudeItem.findUnique({ where: { id } });
  if (item?.photoKey) {
    await deletePhoto(item.photoKey);
    await db.gratitudeItem.update({ where: { id }, data: { photoKey: null } });
  }
  return NextResponse.json({ ok: true });
}
