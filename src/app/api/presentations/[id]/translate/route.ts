import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthenticatedStudioUser, hasAuthConfiguration } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { presentationLanguageSchema } from "@/lib/validation";
import { translatePresentation, translateWithDeepL, TranslationSizeLimitError } from "@/lib/translation";

type RouteContext = { params: Promise<{ id: string }> };
export const maxDuration = 60;

function jsonInput(value: Prisma.JsonValue): Prisma.JsonNullValueInput | Prisma.InputJsonValue {
  return value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
}

export async function POST(request: Request, { params }: RouteContext) {
  if (!hasAuthConfiguration() || !process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Persistent storage is required to create a translated copy." }, { status: 503 });
  }
  if (!process.env.DEEPL_API_KEY) {
    return NextResponse.json({ error: "Translation is not configured. Add DEEPL_API_KEY to the server environment." }, { status: 503 });
  }
  const user = await getAuthenticatedStudioUser();
  if (!user) return NextResponse.json({ error: "Sign in to translate this presentation." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  const input = body as { targetLanguage?: unknown; confirmed?: unknown };
  const targetResult = presentationLanguageSchema.safeParse(input.targetLanguage);
  if (!targetResult.success || input.confirmed !== true) {
    return NextResponse.json({ error: "Choose a target language and confirm that you want to create a translated copy." }, { status: 400 });
  }

  const { id } = await params;
  const source = await prisma.presentation.findFirst({
    where: { id, ownerId: user.id },
    include: { slides: { include: { speakerNotes: true }, orderBy: { position: "asc" } } },
  });
  if (!source) return NextResponse.json({ error: "Presentation not found." }, { status: 404 });
  if (source.language === targetResult.data) {
    return NextResponse.json({ error: "Choose a language different from the source presentation." }, { status: 400 });
  }

  try {
    const translated = await translatePresentation({
      title: source.title,
      description: source.description ?? "",
      category: source.category,
      slides: source.slides.map((slide) => {
        const content = slide.content && typeof slide.content === "object" && !Array.isArray(slide.content)
          ? slide.content as Record<string, unknown>
          : {};
        return {
          id: slide.id,
          title: slide.title,
          subtitle: slide.subtitle ?? "",
          layout: slide.layout as "cover" | "content" | "split" | "stats" | "quote" | "cta",
          content: {
            eyebrow: typeof content.eyebrow === "string" ? content.eyebrow : undefined,
            body: typeof content.body === "string" ? content.body : undefined,
            bullets: Array.isArray(content.bullets) ? content.bullets.filter((item): item is string => typeof item === "string") : undefined,
            image: typeof content.image === "string" ? content.image : undefined,
            stats: Array.isArray(content.stats) ? content.stats.filter((item): item is { value: string; label: string } =>
              Boolean(item) && typeof item === "object" && "value" in item && "label" in item &&
              typeof item.value === "string" && typeof item.label === "string") : undefined,
          },
          notes: slide.speakerNotes?.body ?? "",
          narrationText: slide.narrationText ?? "",
        };
      }),
    }, translateWithDeepL, targetResult.data);
    const sourceSettings = source.narrationSettings && typeof source.narrationSettings === "object" && !Array.isArray(source.narrationSettings)
      ? source.narrationSettings as Record<string, unknown>
      : {};
    const created = await prisma.presentation.create({
      data: {
        ownerId: user.id,
        title: translated.title,
        description: translated.description,
        category: translated.category,
        language: targetResult.data,
        translationNeedsReview: true,
        status: "DRAFT",
        theme: jsonInput(source.theme),
        narrationSettings: {
          rate: typeof sourceSettings.rate === "number" ? sourceSettings.rate : 1,
          muted: sourceSettings.muted === true,
        },
        slides: {
          create: translated.slides.map((slide, position) => ({
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
      include: { slides: { include: { speakerNotes: true }, orderBy: { position: "asc" } } },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The translation service could not complete the request.";
    return NextResponse.json({ error: message }, { status: error instanceof TranslationSizeLimitError ? 413 : 502 });
  }
}
