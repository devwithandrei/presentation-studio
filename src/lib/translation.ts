import type { PresentationLanguage, StudioSlide } from "@/lib/demo-data";

export type TranslationPresentation = {
  title: string;
  description: string;
  category: string;
  slides: StudioSlide[];
};

export class TranslationSizeLimitError extends Error {}

export async function translatePresentation(
  presentation: TranslationPresentation,
  translate: (texts: string[], target: PresentationLanguage) => Promise<string[]>,
  target: PresentationLanguage,
): Promise<TranslationPresentation> {
  const texts = [presentation.title, presentation.description, presentation.category];
  for (const slide of presentation.slides) {
    texts.push(slide.title, slide.subtitle, slide.content.eyebrow ?? "", slide.content.body ?? "");
    texts.push(...(slide.content.bullets ?? []));
    for (const stat of slide.content.stats ?? []) texts.push(stat.value, stat.label);
    texts.push(slide.notes, slide.narrationText ?? "");
  }
  if (texts.reduce((total, text) => total + text.length, 0) > 100_000) {
    throw new TranslationSizeLimitError("This presentation contains more than 100,000 characters and cannot be translated in one request.");
  }

  const positions = texts.flatMap((text, index) => text.trim() ? [index] : []);
  const translatedTexts = await translate(positions.map((index) => texts[index]), target);
  if (translatedTexts.length !== positions.length || translatedTexts.some((text) => typeof text !== "string")) {
    throw new Error("The translation service returned an incomplete response.");
  }
  const translated = [...texts];
  positions.forEach((position, index) => { translated[position] = translatedTexts[index]; });

  let cursor = 0;
  const take = () => translated[cursor++];
  const title = take();
  const description = take();
  const category = take();
  const slides = presentation.slides.map((slide) => {
    const slideTitle = take();
    const subtitle = take();
    const eyebrow = take();
    const body = take();
    const bullets = (slide.content.bullets ?? []).map(() => take());
    const stats = (slide.content.stats ?? []).map(() => ({ value: take(), label: take() }));
    const notes = take();
    const narrationText = take();
    return {
      ...slide,
      title: slideTitle,
      subtitle,
      content: {
        ...slide.content,
        ...(slide.content.eyebrow !== undefined ? { eyebrow } : {}),
        ...(slide.content.body !== undefined ? { body } : {}),
        ...(slide.content.bullets !== undefined ? { bullets } : {}),
        ...(slide.content.stats !== undefined ? { stats } : {}),
      },
      notes,
      ...(slide.narrationText !== undefined ? { narrationText } : {}),
    };
  });
  return { title, description, category, slides };
}

export async function translateWithDeepL(texts: string[], target: PresentationLanguage) {
  const key = process.env.DEEPL_API_KEY;
  if (!key) throw new Error("Translation is not configured. Add DEEPL_API_KEY to the server environment.");

  const targetLanguage: Record<PresentationLanguage, string> = { en: "EN-US", nl: "NL", ro: "RO", es: "ES" };
  const configuredUrl = process.env.DEEPL_API_URL ?? "https://api-free.deepl.com";
  const endpoint = new URL(configuredUrl.endsWith("/v2/translate") ? configuredUrl : `${configuredUrl.replace(/\/$/, "")}/v2/translate`);
  if (endpoint.protocol !== "https:" || !["api-free.deepl.com", "api.deepl.com"].includes(endpoint.hostname)) {
    throw new Error("DEEPL_API_URL must use the official DeepL API endpoint.");
  }

  const translations: string[] = [];
  let batch: string[] = [];
  let batchChars = 0;
  const submitBatch = async () => {
    if (batch.length === 0) return;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: batch, target_lang: targetLanguage[target] }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`DeepL translation failed with status ${response.status}.`);
    const payload = await response.json() as { translations?: { text?: string }[] };
    if (!Array.isArray(payload.translations) || payload.translations.length !== batch.length ||
        payload.translations.some((item) => typeof item.text !== "string")) {
      throw new Error("DeepL returned an incomplete translation response.");
    }
    translations.push(...payload.translations.map((item) => item.text!));
    batch = [];
    batchChars = 0;
  };

  for (const text of texts) {
    if (batch.length >= 40 || (batch.length > 0 && batchChars + text.length > 25_000)) await submitBatch();
    batch.push(text);
    batchChars += text.length;
  }
  await submitBatch();
  return translations;
}
