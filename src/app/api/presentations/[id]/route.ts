import { NextResponse } from "next/server";
import { getAuthenticatedStudioUser, hasAuthConfiguration } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { presentationInputSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteContext) {
  if (!hasAuthConfiguration() || !process.env.DATABASE_URL) return NextResponse.json({ error: "Persistent storage is not configured." }, { status: 503 });
  const user = await getAuthenticatedStudioUser();
  if (!user) return NextResponse.json({ error: "Sign in to update presentations." }, { status: 401 });

  const parsed = presentationInputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid presentation data.", details: parsed.error.flatten() }, { status: 400 });
  const { id } = await params;
  const owned = await prisma.presentation.findFirst({ where: { id, ownerId: user.id }, select: { id: true } });
  if (!owned) return NextResponse.json({ error: "Presentation not found." }, { status: 404 });

  const data = parsed.data;
  const result = await prisma.$transaction(async (tx) => {
    if (data.slides) await tx.slide.deleteMany({ where: { presentationId: id } });
    return tx.presentation.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        language: data.language,
        translationNeedsReview: data.translationNeedsReview,
        theme: data.theme,
        narrationSettings: data.narrationSettings,
        status: data.status,
        visibility: data.visibility,
        ...(data.slides ? {
          slides: {
            create: data.slides.map((slide, position) => ({
              position,
              title: slide.title,
              subtitle: slide.subtitle,
              layout: slide.layout,
              content: slide.content,
              narrationText: slide.narrationText ?? "",
              speakerNotes: { create: { body: slide.notes } },
            })),
          },
        } : {}),
      },
      include: { slides: { include: { speakerNotes: true }, orderBy: { position: "asc" } } },
    });
  });
  return NextResponse.json(result);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  if (!hasAuthConfiguration() || !process.env.DATABASE_URL) return NextResponse.json({ error: "Persistent storage is not configured." }, { status: 503 });
  const user = await getAuthenticatedStudioUser();
  if (!user) return NextResponse.json({ error: "Sign in to delete presentations." }, { status: 401 });
  const { id } = await params;
  const deleted = await prisma.presentation.deleteMany({ where: { id, ownerId: user.id } });
  if (!deleted.count) return NextResponse.json({ error: "Presentation not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}
