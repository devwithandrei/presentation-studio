import { NextResponse } from "next/server";
import { getAuthenticatedStudioUser, hasAuthConfiguration } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { presentationInputSchema } from "@/lib/validation";
import { demoPresentations } from "@/lib/demo-data";

export async function GET() {
  if (!hasAuthConfiguration() || !process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Configure Clerk and Neon to access persistent presentations." }, { status: 503 });
  }
  const user = await getAuthenticatedStudioUser();
  if (!user) return NextResponse.json({ error: "Sign in to access presentations." }, { status: 401 });

  let rows = await prisma.presentation.findMany({
    where: { ownerId: user.id },
    include: { slides: { include: { speakerNotes: true }, orderBy: { position: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
  if (rows.length === 0) {
    const sample = demoPresentations[0];
    await prisma.presentation.create({
      data: {
        ownerId: user.id,
        title: sample.title,
        description: sample.description,
        category: sample.category,
        language: sample.language,
        translationNeedsReview: sample.translationNeedsReview,
        status: sample.status,
        theme: sample.theme,
        narrationSettings: sample.narrationSettings,
        slides: {
          create: sample.slides.map((slide, position) => ({
            position,
            title: slide.title,
            subtitle: slide.subtitle,
            layout: slide.layout,
            content: slide.content,
            narrationText: slide.narrationText ?? "",
            speakerNotes: { create: { body: slide.notes } },
          })),
        },
      },
    });
    rows = await prisma.presentation.findMany({
      where: { ownerId: user.id },
      include: { slides: { include: { speakerNotes: true }, orderBy: { position: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });
  }
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  if (!hasAuthConfiguration() || !process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Configure Clerk and Neon before creating persistent presentations." }, { status: 503 });
  }
  const user = await getAuthenticatedStudioUser();
  if (!user) return NextResponse.json({ error: "Sign in to create a presentation." }, { status: 401 });

  const parsed = presentationInputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid presentation data.", details: parsed.error.flatten() }, { status: 400 });
  const created = await prisma.presentation.create({
    data: {
      ownerId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      language: parsed.data.language,
      translationNeedsReview: parsed.data.translationNeedsReview,
      theme: parsed.data.theme,
      narrationSettings: parsed.data.narrationSettings,
      slides: {
        create: (parsed.data.slides ?? []).map((slide, position) => ({
          position,
          title: slide.title,
          subtitle: slide.subtitle,
          layout: slide.layout,
          content: slide.content,
          speakerNotes: { create: { body: slide.notes } },
          narrationText: slide.narrationText,
        })),
      },
    },
    include: { slides: { include: { speakerNotes: true }, orderBy: { position: "asc" } } },
  });
  return NextResponse.json(created, { status: 201 });
}
