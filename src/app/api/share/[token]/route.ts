import { timingSafeEqual, scryptSync } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ token: string }> };
const passwordSchema = z.object({ password: z.string().min(1).max(128) });

async function sharedPresentation(token: string) {
  return prisma.presentation.findFirst({
    where: { shareToken: token, visibility: { in: ["UNLISTED", "PUBLIC"] } },
    select: {
      id: true, title: true, description: true, status: true, theme: true, language: true, translationNeedsReview: true, narrationSettings: true,
      passwordHash: true,
      slides: {
        orderBy: { position: "asc" },
        select: { id: true, position: true, title: true, subtitle: true, layout: true, content: true, narrationText: true },
      },
    },
  });
}

function passwordMatches(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function publicPresentation(presentation: NonNullable<Awaited<ReturnType<typeof sharedPresentation>>>) {
  return {
    id: presentation.id,
    title: presentation.title,
    description: presentation.description,
    status: presentation.status,
    theme: presentation.theme,
    language: presentation.language,
    translationNeedsReview: presentation.translationNeedsReview,
    narrationSettings: presentation.narrationSettings,
    slides: presentation.slides,
  };
}

export async function GET(_request: Request, { params }: Context) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Shared presentations are unavailable until Neon is configured." }, { status: 503 });
  const { token } = await params;
  const presentation = await sharedPresentation(token);
  if (!presentation) return NextResponse.json({ error: "This share link is invalid or has been revoked." }, { status: 404 });
  if (presentation.passwordHash) return NextResponse.json({ passwordRequired: true }, { status: 401 });
  return NextResponse.json(publicPresentation(presentation));
}

export async function POST(request: Request, { params }: Context) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Shared presentations are unavailable until Neon is configured." }, { status: 503 });
  const parsed = passwordSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid password." }, { status: 400 });
  const { token } = await params;
  const presentation = await sharedPresentation(token);
  if (!presentation) return NextResponse.json({ error: "This share link is invalid or has been revoked." }, { status: 404 });
  const stored = presentation.passwordHash ?? "";
  if (!stored || !passwordMatches(parsed.data.password, stored)) return NextResponse.json({ error: "The password is incorrect." }, { status: 401 });
  return NextResponse.json(publicPresentation(presentation));
}
