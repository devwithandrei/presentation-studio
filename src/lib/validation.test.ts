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
    narrationSettings: { rate: 1.2, voiceURI: "Dutch Voice", muted: true },
    slides: [{ title: "Hallo", content: {}, narrationText: "Aangepaste verteltekst" }],
  });
  assert.equal(result.success, true, result.success ? "" : result.error.message);
  assert.equal(presentationInputSchema.safeParse({ title: "Pitch", language: "en" }).success, false);
  assert.equal(presentationInputSchema.safeParse({ title: "Pitch", narrationSettings: { rate: 2.1 } }).success, false);
});

test("accepts per-type slide text colors and rejects invalid colors", () => {
  const valid = slideInputSchema.safeParse({
    title: "Colored slide",
    content: { textColors: { title: "#102030", body: "#abcdef", bullets: "#445566" } },
  });
  assert.equal(valid.success, true, valid.success ? "" : valid.error.message);
  assert.equal(slideInputSchema.safeParse({
    title: "Invalid color",
    content: { textColors: { title: "red" } },
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

test("creates localized Dutch, Romanian, and Spanish template slides", () => {
  for (const language of ["nl", "ro", "es"] as const) {
    for (const template of templates) {
      const slides = createTemplateSlides(template, language);
      assert.ok(slides.every((slide) => slide.title.length > 0 && slide.notes.length > 0));
    }
    assert.equal(createTemplateSlides("Blank canvas", language).length, 1);
  }
});

test("maps presentation language to speech locale and only offers compatible voices", () => {
  assert.deepEqual(speechLocaleForLanguage, { nl: "nl-NL", ro: "ro-RO", es: "es-ES" });
  const voices = [
    { name: "Dutch", lang: "nl-NL", voiceURI: "nl", default: false },
    { name: "Romanian", lang: "ro-RO", voiceURI: "ro", default: false },
    { name: "English", lang: "en-US", voiceURI: "en", default: true },
  ];
  assert.deepEqual(voicesForLanguage(voices, "nl-NL").map((voice) => voice.voiceURI), ["nl"]);
  assert.deepEqual(voicesForLanguage(voices, "ro-RO").map((voice) => voice.voiceURI), ["ro"]);
});
