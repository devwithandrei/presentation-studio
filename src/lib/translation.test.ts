import assert from "node:assert/strict";
import test from "node:test";
import { translatePresentation, TranslationSizeLimitError } from "./translation";

test("translates slide text, notes, custom narration, stats, and metadata while preserving presentation structure", async () => {
  const source = {
    title: "Source title",
    description: "Description",
    category: "Sales",
    slides: [{
      id: "slide-1",
      title: "Slide title",
      subtitle: "Subtitle",
      layout: "stats" as const,
      content: {
        eyebrow: "Eyebrow",
        body: "Body",
        bullets: ["Bullet"],
        image: "https://example.com/image.png",
        stats: [{ value: "Value", label: "Label" }],
      },
      notes: "Private note",
      narrationText: "Custom narration",
    }],
  };
  const result = await translatePresentation(source, async (texts) => texts.map((text) => `translated:${text}`), "ro");
  assert.equal(result.title, "translated:Source title");
  assert.equal(result.description, "translated:Description");
  assert.equal(result.category, "translated:Sales");
  assert.equal(result.slides[0].title, "translated:Slide title");
  assert.equal(result.slides[0].notes, "translated:Private note");
  assert.equal(result.slides[0].narrationText, "translated:Custom narration");
  assert.deepEqual(result.slides[0].content.stats, [{ value: "translated:Value", label: "translated:Label" }]);
  assert.equal(result.slides[0].content.image, source.slides[0].content.image);
  assert.equal(result.slides[0].layout, source.slides[0].layout);
  assert.equal(source.slides[0].title, "Slide title");
});

test("rejects incomplete translation service output", async () => {
  await assert.rejects(
    translatePresentation({ title: "Title", description: "", category: "", slides: [] }, async () => [], "es"),
    /incomplete response/,
  );
});

test("rejects oversized source content before calling the translation provider", async () => {
  let providerCalled = false;
  await assert.rejects(
    translatePresentation({ title: "x".repeat(100_001), description: "", category: "", slides: [] }, async () => {
      providerCalled = true;
      return [];
    }, "nl"),
    TranslationSizeLimitError,
  );
  assert.equal(providerCalled, false);
});
