import assert from "node:assert/strict";
import test from "node:test";
import type { NarrationSettings, StudioSlide } from "./demo-data";
import { narrationForSlide, PresentationPlayback, type PlaybackCallbacks, type SpeechDriver, type SpeechOutcome, type SpeechRequest } from "./narration";

const settings: NarrationSettings = { rate: 1 };

function slide(id: string, title: string, body = ""): StudioSlide {
  return { id, title, subtitle: "", layout: "content", content: { body }, notes: "Niet voorlezen", narrationText: "" };
}

class ControlledSpeech implements SpeechDriver {
  readonly spoken: string[] = [];
  readonly requests: SpeechRequest[] = [];
  readonly completions: ((outcome: SpeechOutcome) => void)[] = [];
  pauses = 0;
  resumes = 0;
  cancellations = 0;
  muteStates: boolean[] = [];

  speak(text: string, request: SpeechRequest) {
    this.spoken.push(text);
    this.requests.push(request);
    return new Promise<SpeechOutcome>((resolve) => this.completions.push(resolve));
  }
  pause() { this.pauses += 1; }
  resume() { this.resumes += 1; }
  setMuted(muted: boolean) { this.muteStates.push(muted); }
  cancel() {
    this.cancellations += 1;
    this.completions.splice(0).forEach((complete) => complete("cancelled"));
  }
  completeNext(outcome: SpeechOutcome = "completed") { this.completions.shift()?.(outcome); }
}

function fixture(slides: StudioSlide[]) {
  const speech = new ControlledSpeech();
  const indexes: number[] = [];
  const statuses: string[] = [];
  const highlights: [number, number][] = [];
  const errors: string[] = [];
  let finished = 0;
  const callbacks: PlaybackCallbacks = {
    onIndex: (index) => indexes.push(index),
    onStatus: (status) => statuses.push(status),
    onHighlight: (start, length) => highlights.push([start, length]),
    onFinished: () => { finished += 1; },
    onError: (error) => errors.push(error),
  };
  const player = new PresentationPlayback(() => slides, () => settings, () => "nl-NL", speech, callbacks);
  return { player, speech, indexes, statuses, highlights, errors, finished: () => finished };
}

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test("manual mode does not advance after narration finishes", async () => {
  const state = fixture([slide("one", "Titel", "Inhoud"), slide("two", "Volgende")]);
  state.player.startManualNarration(0);
  assert.equal(state.speech.spoken[0], "Titel. Inhoud");
  state.speech.completeNext();
  await flush();
  assert.deepEqual(state.indexes, []);
  assert.equal(state.statuses.at(-1), "idle");
});

test("changing slides while manually narrating cancels speech without starting automatic playback", async () => {
  const state = fixture([slide("one", "Titel"), slide("two", "Volgende")]);
  state.player.startManualNarration(0);
  state.player.navigate(1);
  await flush();
  assert.deepEqual(state.indexes, [1]);
  assert.deepEqual(state.speech.spoken, ["Titel"]);
  assert.equal(state.statuses.at(-1), "idle");
});

test("automatic mode advances only after speech completes and reads slides in order", async () => {
  const state = fixture([slide("one", "Een", "Eerste"), slide("two", "Twee", "Tweede")]);
  state.player.startAutomatic(0);
  assert.deepEqual(state.indexes, [0]);
  assert.deepEqual(state.speech.spoken, ["Een. Eerste"]);
  state.speech.completeNext();
  await flush();
  assert.deepEqual(state.indexes, [0, 1]);
  assert.deepEqual(state.speech.spoken, ["Een. Eerste", "Twee. Tweede"]);
  state.speech.completeNext();
  await flush();
  assert.equal(state.finished(), 1);
  assert.equal(state.statuses.at(-1), "finished");
});

test("pause and resume preserve the current utterance", () => {
  const state = fixture([slide("one", "Titel", "Lange tekst")]);
  state.player.startAutomatic(0);
  state.player.pause();
  state.player.resume();
  assert.equal(state.speech.pauses, 1);
  assert.equal(state.speech.resumes, 1);
  assert.equal(state.speech.spoken.length, 1);
  assert.deepEqual(state.indexes, [0]);
});

test("mute changes do not replace the active narration sequence", () => {
  const state = fixture([slide("one", "Titel", "Lange tekst"), slide("two", "Volgende")]);
  state.player.startAutomatic(0);
  state.player.setMuted(true);
  state.player.setMuted(false);
  assert.deepEqual(state.speech.muteStates, [true, false]);
  assert.equal(state.speech.spoken.length, 1);
  assert.deepEqual(state.indexes, [0]);
});

test("an interrupted utterance does not leave playback stuck or advance slides", async () => {
  const state = fixture([slide("one", "First"), slide("two", "Second")]);
  state.player.startAutomatic(0);
  state.speech.completeNext("cancelled");
  await flush();
  assert.equal(state.statuses.at(-1), "idle");
  assert.deepEqual(state.indexes, [0]);
  assert.deepEqual(state.speech.spoken, ["First"]);
});

test("stop cancels narration and prevents pending slide advancement", async () => {
  const state = fixture([slide("one", "Een"), slide("two", "Twee")]);
  state.player.startAutomatic(0);
  state.player.stop();
  await flush();
  assert.equal(state.speech.cancellations, 2);
  assert.deepEqual(state.indexes, [0]);
  assert.equal(state.statuses.at(-1), "idle");
});

test("switching from automatic to manual cancels speech and future transitions", async () => {
  const state = fixture([slide("one", "Een"), slide("two", "Twee")]);
  state.player.startAutomatic(0);
  state.player.setManualMode();
  await flush();
  assert.equal(state.player.getMode(), "manual");
  assert.deepEqual(state.indexes, [0]);
  assert.equal(state.statuses.at(-1), "idle");
});

test("selecting automatic mode does not start narration until explicitly started", () => {
  const state = fixture([slide("one", "First"), slide("two", "Second")]);
  state.player.setAutomaticMode();
  state.player.navigate(1);
  assert.deepEqual(state.speech.spoken, []);
  assert.deepEqual(state.indexes, [1]);
  assert.equal(state.statuses.at(-1), "idle");
});

test("empty slides are skipped and the final slide finishes without advancing past the deck", async () => {
  const state = fixture([slide("empty", "", ""), slide("one", "Eén"), slide("empty-last", "", "")]);
  state.player.startAutomatic(0);
  assert.deepEqual(state.indexes, [0, 1]);
  assert.deepEqual(state.speech.spoken, ["Eén"]);
  state.speech.completeNext();
  await flush();
  assert.deepEqual(state.indexes, [0, 1, 2]);
  assert.equal(state.finished(), 1);
  assert.equal(state.statuses.at(-1), "finished");
  assert.equal(state.indexes.at(-1), 2);
});

test("rapid navigation cancels the old utterance and only speaks the latest target", async () => {
  const state = fixture([slide("one", "Een"), slide("two", "Twee"), slide("three", "Drie")]);
  state.player.startAutomatic(0);
  state.player.navigate(1);
  state.player.navigate(2);
  await flush();
  assert.deepEqual(state.indexes, [0, 1, 2]);
  assert.deepEqual(state.speech.spoken, ["Een", "Twee", "Drie"]);
  state.speech.completeNext();
  await flush();
  assert.equal(state.finished(), 1);
  assert.deepEqual(state.indexes, [0, 1, 2]);
});

test("automatic navigation at the deck boundary does not narrate the same slide twice", async () => {
  const state = fixture([slide("one", "Een")]);
  state.player.startAutomatic(0);
  state.player.navigate(1);
  assert.deepEqual(state.speech.spoken, ["Een"]);
  state.speech.completeNext();
  await flush();
  state.player.navigate(1);
  assert.deepEqual(state.speech.spoken, ["Een"]);
  assert.equal(state.finished(), 1);
});

test("custom narration is separate from notes and visible fallback text", () => {
  const custom = { ...slide("one", "Titel", "Zichtbare tekst"), narrationText: "Mijn eigen uitleg" };
  assert.equal(narrationForSlide(custom), "Titel. Mijn eigen uitleg");
  assert.equal(narrationForSlide(slide("two", "Tweede", "Inhoud")), "Tweede. Inhoud");
});
