import type { NarrationSettings, SpeechLocale, StudioSlide } from "@/lib/demo-data";

export type SpeechOutcome = "completed" | "cancelled";
export type PlayerMode = "manual" | "automatic";
export type PlayerStatus = "idle" | "playing" | "paused" | "finished";

export type SpeechRequest = {
  language: SpeechLocale;
  rate: number;
  voiceURI?: string;
  onBoundary?: (start: number, length: number) => void;
};

export interface SpeechDriver {
  speak(text: string, request: SpeechRequest): Promise<SpeechOutcome>;
  setMuted(muted: boolean): void;
  pause(): void;
  resume(): void;
  cancel(): void;
}

export type PlaybackCallbacks = {
  onIndex: (index: number) => void;
  onStatus: (status: PlayerStatus) => void;
  onHighlight: (start: number, length: number) => void;
  onFinished: () => void;
  onError: (message: string) => void;
};

export function narrationForSlide(slide: StudioSlide) {
  const title = slide.title.trim();
  const mainText = slide.narrationText?.trim() ||
    [slide.subtitle, slide.content.body, ...(slide.content.bullets ?? []),
      ...(slide.content.stats ?? []).flatMap(({ value, label }) => [value, label])]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(". ");
  return [title, mainText].filter(Boolean).join(". ").trim();
}

export class PresentationPlayback {
  private generation = 0;
  private mode: PlayerMode = "manual";
  private currentIndex = 0;
  private automaticPlaybackArmed = false;

  constructor(
    private readonly slides: () => readonly StudioSlide[],
    private readonly settings: () => NarrationSettings,
    private readonly language: () => SpeechLocale,
    private readonly speech: SpeechDriver,
    private readonly callbacks: PlaybackCallbacks,
  ) {}

  getMode() {
    return this.mode;
  }

  setManualMode() {
    this.mode = "manual";
    this.automaticPlaybackArmed = false;
    this.stop();
  }

  setAutomaticMode() {
    this.mode = "automatic";
    this.automaticPlaybackArmed = false;
    this.stop();
  }

  startAutomatic(index: number) {
    this.mode = "automatic";
    this.automaticPlaybackArmed = true;
    const generation = this.invalidateSpeech();
    this.currentIndex = index;
    this.callbacks.onStatus("playing");
    void this.playSequence(index, generation);
  }

  startManualNarration(index: number) {
    if (this.mode !== "manual") return;
    const generation = this.invalidateSpeech();
    this.currentIndex = index;
    const slide = this.slides()[index];
    const text = slide ? narrationForSlide(slide) : "";
    if (!text) {
      this.callbacks.onStatus("idle");
      return;
    }
    this.callbacks.onStatus("playing");
    this.callbacks.onHighlight(0, 0);
    void this.speak(text, generation).then((outcome) => {
      if (outcome === "completed" && generation === this.generation && this.mode === "manual") {
        this.callbacks.onStatus("idle");
        this.callbacks.onHighlight(0, 0);
      }
    });
  }

  navigate(index: number) {
    const lastIndex = this.slides().length - 1;
    const nextIndex = Math.max(0, Math.min(lastIndex, index));
    if (nextIndex === this.currentIndex) return;
    if (this.mode === "automatic") {
      if (this.automaticPlaybackArmed) {
        this.startAutomatic(nextIndex);
      } else {
        this.stop();
        this.currentIndex = nextIndex;
        this.callbacks.onIndex(nextIndex);
      }
      return;
    }
    this.stop();
    this.currentIndex = nextIndex;
    this.callbacks.onIndex(nextIndex);
  }

  pause() {
    this.speech.pause();
    this.callbacks.onStatus("paused");
  }

  setMuted(muted: boolean) {
    this.speech.setMuted(muted);
  }

  resume() {
    this.speech.resume();
    this.callbacks.onStatus("playing");
  }

  stop() {
    this.automaticPlaybackArmed = false;
    this.invalidateSpeech();
    this.callbacks.onStatus("idle");
    this.callbacks.onHighlight(0, 0);
  }

  dispose() {
    this.stop();
  }

  private invalidateSpeech() {
    const generation = ++this.generation;
    this.speech.cancel();
    this.callbacks.onHighlight(0, 0);
    return generation;
  }

  private async speak(text: string, generation: number): Promise<SpeechOutcome> {
    try {
      const outcome = await this.speech.speak(text, {
        ...this.settings(),
        language: this.language(),
        onBoundary: (start, length) => {
          if (generation === this.generation) this.callbacks.onHighlight(start, length);
        },
      });
      if (outcome === "cancelled" && generation === this.generation) {
        this.callbacks.onStatus("idle");
        this.callbacks.onHighlight(0, 0);
      }
      return outcome;
    } catch (error) {
      if (generation === this.generation) {
        this.callbacks.onStatus("idle");
        this.callbacks.onError(error instanceof Error ? error.message : "Speech narration is unavailable.");
      }
      return "cancelled";
    }
  }

  private async playSequence(startIndex: number, generation: number) {
    const slides = this.slides();
    for (let index = startIndex; index < slides.length; index += 1) {
      if (generation !== this.generation || this.mode !== "automatic") return;
      this.currentIndex = index;
      this.callbacks.onIndex(index);
      const text = narrationForSlide(slides[index]);
      if (!text) continue;
      const outcome = await this.speak(text, generation);
      if (generation !== this.generation || this.mode !== "automatic" || outcome !== "completed") return;
    }
    if (generation === this.generation && this.mode === "automatic") {
      this.callbacks.onStatus("finished");
      this.callbacks.onHighlight(0, 0);
      this.callbacks.onFinished();
    }
  }
}
