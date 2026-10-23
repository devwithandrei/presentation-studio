import assert from "node:assert/strict";
import test from "node:test";
import { presentationInputSchema, slideInputSchema } from "./validation";
import { createTemplateSlides, speechLocaleForLanguage, templates, thuiszoekSlides } from "./demo-data";
import { voicesForLanguage } from "./browser-speech";

test("accepts all twelve ThuisZoek slides and their speaker notes", () => {
  assert.equal(thuiszoekSlides.length, 12);
  for (const slide of thuiszoekSlides) {
    const result = slideInputSchema.safeParse(slide);
    assert.equal(result.success, true, result.success ? "" : result.error.message);
  }
});

test("accepts narration text and persistent presentation language, speed, mute, and voice settings", () => {
  const result = presentationInputSchema.safeParse({
    title: "Pitch",
    language: "nl",
    narrationSettings: { rate: 1.2, volume: 0.65, voiceURI: "Dutch Voice", muted: true },
    slides: [{ title: "Hallo", content: {}, narrationText: "Aangepaste verteltekst" }],
  });
  assert.equal(result.success, true, result.success ? "" : result.error.message);
  assert.equal(presentationInputSchema.safeParse({ title: "Pitch", language: "en" }).success, true);
  const defaultLanguage = presentationInputSchema.safeParse({ title: "Pitch" });
  assert.equal(defaultLanguage.success ? defaultLanguage.data.language : undefined, "en");
  assert.equal(presentationInputSchema.safeParse({ title: "Pitch", language: "fr" }).success, false);
  assert.equal(presentationInputSchema.safeParse({ title: "Pitch", narrationSettings: { rate: 2.1 } }).success, false);
  assert.equal(presentationInputSchema.safeParse({ title: "Pitch", narrationSettings: { volume: 1.1 } }).success, false);
  assert.equal(presentationInputSchema.safeParse({ title: "Pitch", narrationSettings: { volume: -0.1 } }).success, false);
});

test("accepts per-type slide text colors and rejects invalid colors", () => {
  const valid = slideInputSchema.safeParse({
    title: "Colored slide",
    content: {
      textColors: { title: "#102030", body: "#abcdef", bullets: "#445566" },
      textStyleColors: { title: "#102030", "bullet-0": "#445566" },
    },
  });
  assert.equal(valid.success, true, valid.success ? "" : valid.error.message);
  assert.equal(slideInputSchema.safeParse({
    title: "Invalid color",
    content: { textColors: { title: "red" } },
  }).success, false);
  assert.equal(slideInputSchema.safeParse({
    title: "Invalid text color",
    content: { textStyleColors: { "bullet-0": "red" } },
  }).success, false);
});

test("accepts supported uploaded slide images and rejects unsupported data images", () => {
  const uploadedImage = slideInputSchema.safeParse({
    title: "Image slide",
    content: { backgroundImage: "data:image/png;base64,aGVsbG8=" },
  });
  assert.equal(uploadedImage.success, true, uploadedImage.success ? "" : uploadedImage.error.message);
  assert.equal(slideInputSchema.safeParse({
    title: "Unsafe image",
    content: { backgroundImage: "data:image/svg+xml;base64,aGVsbG8=" },
  }).success, false);
});

test("accepts movable slide media and rejects non-HTTPS video sources", () => {
  const valid = slideInputSchema.safeParse({
    title: "Media slide",
    content: {
      mediaElements: [
        { id: "gif-1", type: "image", src: "data:image/gif;base64,aGVsbG8=", x: 10, y: 10, width: 30, height: 25 },
        { id: "icon-1", type: "icon", icon: "sparkles", x: 55, y: 15, width: 12, height: 12 },
        { id: "video-1", type: "video", src: "https://example.com/video.mp4", x: 20, y: 45, width: 50, height: 40 },
      ],
    },
  });
  assert.equal(valid.success, true, valid.success ? "" : valid.error.message);
  assert.equal(slideInputSchema.safeParse({
    title: "Insecure video",
    content: { mediaElements: [{ id: "video-1", type: "video", src: "http://example.com/video.mp4", x: 0, y: 0, width: 50, height: 40 }] },
  }).success, false);
  assert.equal(slideInputSchema.safeParse({
    title: "Out of bounds",
    content: { mediaElements: [{ id: "icon-1", type: "icon", icon: "star", x: 80, y: 0, width: 30, height: 10 }] },
  }).success, false);
  assert.equal(slideInputSchema.safeParse({
    title: "Missing image",
    content: { mediaElements: [{ id: "image-1", type: "image", x: 0, y: 0, width: 25, height: 25 }] },
  }).success, false);
});

test("accepts bounded persisted text positions and rejects out-of-range offsets", () => {
  const valid = slideInputSchema.safeParse({
    title: "Positioned slide",
    content: { textPositions: { title: { x: -25.5, y: 14 }, "bullet-0": { x: 100, y: -100 } } },
  });
  assert.equal(valid.success, true, valid.success ? "" : valid.error.message);
  assert.equal(slideInputSchema.safeParse({
    title: "Invalid position",
    content: { textPositions: { title: { x: 101, y: 0 } } },
  }).success, false);
});

test("accepts bounded persisted text sizes and rejects out-of-range sizes", () => {
  const valid = slideInputSchema.safeParse({
    title: "Resized slide",
    content: { textSizes: { title: 125, body: 75, "bullet-0": 200 } },
  });
  assert.equal(valid.success, true, valid.success ? "" : valid.error.message);
  assert.equal(slideInputSchema.safeParse({
    title: "Too small",
    content: { textSizes: { title: 24 } },
  }).success, false);
  assert.equal(slideInputSchema.safeParse({
    title: "Too large",
    content: { textSizes: { title: 301 } },
  }).success, false);
});

test("rejects a slide with missing title and oversized notes", () => {
  assert.equal(slideInputSchema.safeParse({ title: "", content: {} }).success, false);
  assert.equal(slideInputSchema.safeParse({ title: "Ok", content: {}, notes: "x".repeat(5001) }).success, false);
});

test("rejects malformed presentation data and caps slide count", () => {
  assert.equal(presentationInputSchema.safeParse({ title: "  ", slides: [] }).success, false);
  assert.equal(presentationInputSchema.safeParse({ title: "Pitch", slides: Array.from({ length: 101 }, () => ({ title: "x", content: {} })) }).success, false);
});

test("provides editable placeholder slides for every reusable template", () => {
  for (const template of templates) {
    const slides = createTemplateSlides(template, "nl");
    assert.ok(slides.length >= 1, `${template} should include at least one slide`);
    assert.ok(slides.every((slide) => slide.notes.length > 0), `${template} should include speaker guidance`);
  }
});

test("creates localized English, Dutch, Romanian, and Spanish template slides", () => {
  for (const language of ["en", "nl", "ro", "es"] as const) {
    for (const template of templates) {
      const slides = createTemplateSlides(template, language);
      assert.ok(slides.every((slide) => slide.title.length > 0 && slide.notes.length > 0));
    }
    assert.equal(createTemplateSlides("Blank canvas", language).length, 1);
  }
});

test("maps presentation language to speech locale and only offers compatible voices", () => {
  assert.deepEqual(speechLocaleForLanguage, { en: "en-US", nl: "nl-NL", ro: "ro-RO", es: "es-ES" });
  const voices = [
    { name: "Dutch", lang: "nl-NL", voiceURI: "nl", default: false },
    { name: "Romanian", lang: "ro-RO", voiceURI: "ro", default: false },
    { name: "English", lang: "en-US", voiceURI: "en", default: true },
  ];
  assert.deepEqual(voicesForLanguage(voices, "nl-NL").map((voice) => voice.voiceURI), ["nl"]);
  assert.deepEqual(voicesForLanguage(voices, "ro-RO").map((voice) => voice.voiceURI), ["ro"]);
  assert.deepEqual(voicesForLanguage(voices, "en-US").map((voice) => voice.voiceURI), ["en"]);
});
