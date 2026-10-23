import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedStudioUser, hasAuthConfiguration } from "@/lib/auth";
import { createLiveRoomToken } from "@/lib/livekit-token";
import { prisma } from "@/lib/prisma";

const participantSchema = z.object({ name: z.string().trim().min(1).max(48) });
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  if (!hasAuthConfiguration() || !process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Presenter live video requires Clerk and Neon configuration." }, { status: 503 });
  }
  const user = await getAuthenticatedStudioUser();
  if (!user) return NextResponse.json({ error: "Sign in as the presentation owner to start live video." }, { status: 401 });
  const parsed = participantSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid display name." }, { status: 400 });

  const { id } = await params;
  const presentation = await prisma.presentation.findFirst({
    where: { id, ownerId: user.id },
    select: { id: true },
  });
  if (!presentation) return NextResponse.json({ error: "Presentation not found." }, { status: 404 });

  try {
    const room = await createLiveRoomToken(`presentation-${presentation.id}`, randomUUID(), parsed.data.name);
    if (!room) return NextResponse.json({ error: "LiveKit is not configured. Add LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET." }, { status: 503 });
    return NextResponse.json(room);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create a live-room token.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
