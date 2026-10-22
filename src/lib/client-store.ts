import { demoPresentations, type NarrationSettings, type StudioPresentation, type StudioSlide } from "@/lib/demo-data";

const storageKey = "presentation-studio:v1";

export function readLocalPresentations(): StudioPresentation[] {
  if (typeof window === "undefined") return demoPresentations;
  try {
    const raw = window.localStorage.getItem(storageKey);
    const stored = raw ? JSON.parse(raw) as StudioPresentation[] : demoPresentations;
    return stored.map((presentation) => ({
      ...presentation,
      theme: { ...demoPresentations[0].theme, ...presentation.theme },
      language: presentation.language ?? "nl",
      translationNeedsReview: presentation.translationNeedsReview ?? false,
      narrationSettings: {
        ...presentation.narrationSettings,
        rate: presentation.narrationSettings.rate ?? 1,
        muted: presentation.narrationSettings.muted ?? false,
      },
    }));
  } catch {
    return demoPresentations;
  }
}

export function writeLocalPresentations(presentations: StudioPresentation[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(presentations));
}

export function mapServerPresentation(value: Record<string, unknown>): StudioPresentation {
  const slides = Array.isArray(value.slides) ? value.slides as Record<string, unknown>[] : [];
  return {
    id: String(value.id),
    title: String(value.title),
    description: String(value.description ?? ""),
    category: String(value.category ?? "General"),
    language: value.language === "ro" || value.language === "es" ? value.language : "nl",
    translationNeedsReview: value.translationNeedsReview === true,
    status: value.status === "READY" || value.status === "ARCHIVED" ? value.status : "DRAFT",
    updatedAt: String(value.updatedAt ?? new Date().toISOString()),
    theme: value.theme && typeof value.theme === "object"
      ? { ...demoPresentations[0].theme, ...value.theme as StudioPresentation["theme"] }
      : demoPresentations[0].theme,
    narrationSettings: value.narrationSettings && typeof value.narrationSettings === "object"
      ? (() => {
        const settings = value.narrationSettings as NarrationSettings;
        return { ...settings, rate: settings.rate ?? 1, muted: settings.muted ?? false };
      })()
      : demoPresentations[0].narrationSettings,
    slides: slides.map((item, index) => {
      const content = item.content && typeof item.content === "object" ? item.content as StudioSlide["content"] : {};
      const note = item.speakerNotes && typeof item.speakerNotes === "object" ? String((item.speakerNotes as { body?: string }).body ?? "") : "";
      const layout = ["cover", "content", "split", "stats", "quote", "cta"].includes(String(item.layout))
        ? String(item.layout) as StudioSlide["layout"] : "content";
      return {
        id: String(item.id ?? `slide-${index}`),
        title: String(item.title ?? "New slide"),
        subtitle: String(item.subtitle ?? ""),
        layout,
        content,
        notes: note,
        narrationText: String(item.narrationText ?? ""),
      };
    }),
  };
}

export function toServerPayload(presentation: StudioPresentation) {
  return {
    title: presentation.title,
    description: presentation.description,
    category: presentation.category,
    language: presentation.language,
    translationNeedsReview: presentation.translationNeedsReview,
    status: presentation.status,
    theme: presentation.theme,
    narrationSettings: presentation.narrationSettings,
    slides: presentation.slides.map(({ title, subtitle, layout, content, notes, narrationText }) => ({
      title,
      subtitle,
      layout,
      content,
      notes,
      narrationText: narrationText ?? "",
    })),
  };
}
