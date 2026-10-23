import { randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createLiveRoomToken } from "@/lib/livekit-token";
import { prisma } from "@/lib/prisma";

const participantSchema = z.object({
  name: z.string().trim().min(1).max(48),
  password: z.string().min(1).max(128).optional(),
});
type Context = { params: Promise<{ token: string }> };

function passwordMatches(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function POST(request: Request, { params }: Context) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Shared live video requires Neon configuration." }, { status: 503 });
  }
  const parsed = participantSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid display name." }, { status: 400 });

  const { token } = await params;
  const presentation = await prisma.presentation.findFirst({
    where: { shareToken: token, visibility: { in: ["UNLISTED", "PUBLIC"] } },
    select: { id: true, passwordHash: true },
  });
  if (!presentation) return NextResponse.json({ error: "This share link is invalid or has been revoked." }, { status: 404 });
  if (presentation.passwordHash && (!parsed.data.password || !passwordMatches(parsed.data.password, presentation.passwordHash))) {
    return NextResponse.json({ error: "Enter the share-link password to join live video." }, { status: 401 });
  }

  try {
    const room = await createLiveRoomToken(`presentation-${presentation.id}`, randomUUID(), parsed.data.name);
    if (!room) return NextResponse.json({ error: "LiveKit is not configured. Add LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET." }, { status: 503 });
    return NextResponse.json(room);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create a live-room token.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
