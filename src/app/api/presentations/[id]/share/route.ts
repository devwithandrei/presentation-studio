import { randomBytes, scryptSync } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedStudioUser, hasAuthConfiguration } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const shareSchema = z.object({
  visibility: z.enum(["PUBLIC", "UNLISTED"]).default("UNLISTED"),
  password: z.string().min(8).max(128).optional(),
});
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  if (!hasAuthConfiguration() || !process.env.DATABASE_URL) return NextResponse.json({ error: "Sharing requires Clerk and Neon configuration." }, { status: 503 });
  const user = await getAuthenticatedStudioUser();
  if (!user) return NextResponse.json({ error: "Sign in to inspect sharing settings." }, { status: 401 });
  const { id } = await params;
  const presentation = await prisma.presentation.findFirst({
    where: { id, ownerId: user.id },
    select: { visibility: true, shareToken: true },
  });
  if (!presentation) return NextResponse.json({ error: "Presentation not found." }, { status: 404 });
  return NextResponse.json({ isShared: presentation.visibility !== "PRIVATE" && Boolean(presentation.shareToken), visibility: presentation.visibility });
}

export async function POST(request: Request, { params }: Context) {
  if (!hasAuthConfiguration() || !process.env.DATABASE_URL) return NextResponse.json({ error: "Sharing requires Clerk and Neon configuration." }, { status: 503 });
  const user = await getAuthenticatedStudioUser();
  if (!user) return NextResponse.json({ error: "Sign in to share this presentation." }, { status: 401 });
  const parsed = shareSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid share settings.", details: parsed.error.flatten() }, { status: 400 });

  const { id } = await params;
  const owned = await prisma.presentation.findFirst({ where: { id, ownerId: user.id }, select: { id: true, shareToken: true } });
  if (!owned) return NextResponse.json({ error: "Presentation not found." }, { status: 404 });
  const token = owned.shareToken ?? randomBytes(24).toString("base64url");
  const salt = parsed.data.password ? randomBytes(16).toString("hex") : null;
  const passwordHash = parsed.data.password && salt
    ? `${salt}:${scryptSync(parsed.data.password, salt, 64).toString("hex")}`
    : null;
  await prisma.presentation.update({
    where: { id },
    data: { visibility: parsed.data.visibility, shareToken: token, ...(passwordHash ? { passwordHash } : {}) },
  });
  return NextResponse.json({ url: new URL(`/share/${token}`, request.url).toString(), visibility: parsed.data.visibility });
}

export async function DELETE(_request: Request, { params }: Context) {
  if (!hasAuthConfiguration() || !process.env.DATABASE_URL) return NextResponse.json({ error: "Sharing requires Clerk and Neon configuration." }, { status: 503 });
  const user = await getAuthenticatedStudioUser();
  if (!user) return NextResponse.json({ error: "Sign in to revoke this link." }, { status: 401 });
  const { id } = await params;
  const result = await prisma.presentation.updateMany({
    where: { id, ownerId: user.id },
    data: { visibility: "PRIVATE", shareToken: null, passwordHash: null },
  });
  if (!result.count) return NextResponse.json({ error: "Presentation not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}
