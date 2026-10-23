import type { SpeechDriver, SpeechRequest, SpeechOutcome } from "@/lib/narration";

export type AvailableVoice = {
  name: string;
  lang: string;
  voiceURI: string;
  default: boolean;
};

export function voicesForLanguage(voices: AvailableVoice[], language: string) {
  const base = language.split("-")[0].toLowerCase();
  return voices.filter((voice) => voice.lang.toLowerCase().split("-")[0] === base);
}

type ActiveSpeech = {
  text: string;
  request: SpeechRequest;
  resolve: (outcome: SpeechOutcome) => void;
  reject: (error: Error) => void;
  position: number;
  utteranceId: number;
  pausedAt: number | null;
};

export class BrowserSpeechDriver implements SpeechDriver {
  private active: ActiveSpeech | null = null;
  private utteranceId = 0;
  private muted = false;
  private volume = 1;
  private volumeTimer: number | undefined;

  static available() {
    return typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof window.SpeechSynthesisUtterance !== "undefined";
  }

  static voices(): AvailableVoice[] {
    if (!BrowserSpeechDriver.available()) return [];
    return window.speechSynthesis.getVoices().map((voice) => ({
      name: voice.name,
      lang: voice.lang,
      voiceURI: voice.voiceURI,
      default: voice.default,
    }));
  }

  static compatibleVoices(language: string) {
    return voicesForLanguage(BrowserSpeechDriver.voices(), language);
  }

  speak(text: string, request: SpeechRequest): Promise<SpeechOutcome> {
    if (!BrowserSpeechDriver.available()) {
      return Promise.reject(new Error("Speech synthesis is not supported in this browser."));
    }
    this.cancel();
    const compatible = BrowserSpeechDriver.compatibleVoices(request.language);
    const requestedVoice = request.voiceURI
      ? compatible.find((voice) => voice.voiceURI === request.voiceURI)
      : undefined;
    if (request.voiceURI && !requestedVoice) {
      return Promise.reject(new Error("The selected voice is not available for this presentation language. Choose a compatible voice."));
    }
    const voice = requestedVoice ?? compatible.find((item) => item.lang.toLowerCase() === request.language.toLowerCase());
    if (!voice) {
      return Promise.reject(new Error(`No ${request.language} voice is installed. Install a compatible speech voice or continue without narration.`));
    }

    return new Promise<SpeechOutcome>((resolve, reject) => {
      const active: ActiveSpeech = {
        text,
        request,
        resolve,
        reject,
        position: 0,
        utteranceId: 0,
        pausedAt: null,
      };
      this.active = active;
      this.enqueue(active, voice, 0);
    });
  }

  setMuted(muted: boolean) {
    if (this.muted === muted) return;
    this.muted = muted;
    this.restartActive();
  }

  setVolume(volume: number) {
    const nextVolume = Math.max(0, Math.min(1, volume));
    if (this.volume === nextVolume) return;
    this.volume = nextVolume;
    if (this.volumeTimer !== undefined) window.clearTimeout(this.volumeTimer);
    this.volumeTimer = window.setTimeout(() => {
      this.volumeTimer = undefined;
      this.restartActive();
    }, 150);
  }

  private restartActive() {
    if (this.volumeTimer !== undefined) window.clearTimeout(this.volumeTimer);
    this.volumeTimer = undefined;
    const active = this.active;
    if (!active || !BrowserSpeechDriver.available()) return;

    const wasPaused = active.pausedAt !== null;
    active.utteranceId = ++this.utteranceId;
    window.speechSynthesis.cancel();
    const voice = this.resolveVoice(active.request);
    if (!voice) {
      this.fail(active, new Error(`No ${active.request.language} voice is installed. Install a compatible speech voice or continue without narration.`));
      return;
    }
    window.setTimeout(() => {
      if (this.active !== active) return;
      this.enqueue(active, voice, active.position);
      if (wasPaused && this.active === active) window.speechSynthesis.pause();
    }, 0);
  }

  pause() {
    if (!BrowserSpeechDriver.available()) return;
    if (this.active) this.active.pausedAt = Date.now();
    window.speechSynthesis.pause();
  }

  resume() {
    if (!BrowserSpeechDriver.available()) return;
    if (this.active?.pausedAt !== null && this.active?.pausedAt !== undefined) {
      this.active.pausedAt = null;
    }
    window.speechSynthesis.resume();
  }

  cancel() {
    const active = this.active;
    if (this.volumeTimer !== undefined) window.clearTimeout(this.volumeTimer);
    this.volumeTimer = undefined;
    this.active = null;
    this.utteranceId += 1;
    if (BrowserSpeechDriver.available()) window.speechSynthesis.cancel();
    active?.resolve("cancelled");
  }

  private resolveVoice(request: SpeechRequest) {
    const voices = BrowserSpeechDriver.compatibleVoices(request.language);
    if (request.voiceURI) return voices.find((voice) => voice.voiceURI === request.voiceURI);
    return voices.find((voice) => voice.lang.toLowerCase() === request.language.toLowerCase()) ?? voices[0];
  }

  private enqueue(active: ActiveSpeech, voiceInfo: AvailableVoice, start: number) {
    if (this.active !== active || !BrowserSpeechDriver.available()) return;
    const voice = window.speechSynthesis.getVoices().find((item) => item.voiceURI === voiceInfo.voiceURI);
    if (!voice) {
      this.fail(active, new Error("The selected speech voice is no longer available."));
      return;
    }
    const utterance = new SpeechSynthesisUtterance(active.text.slice(start));
    utterance.lang = active.request.language;
    utterance.voice = voice;
    utterance.rate = active.request.rate;
    utterance.volume = this.muted ? 0 : this.volume;
    const utteranceId = ++this.utteranceId;
    active.utteranceId = utteranceId;

    utterance.onboundary = (event) => {
      if (this.active !== active || active.utteranceId !== utteranceId) return;
      active.position = Math.min(active.text.length, start + event.charIndex);
      active.request.onBoundary?.(start + event.charIndex, event.charLength);
    };
    utterance.onend = () => {
      if (this.active !== active || active.utteranceId !== utteranceId) return;
      this.finish(active, "completed");
    };
    utterance.onerror = (event) => {
      if (this.active !== active || active.utteranceId !== utteranceId) return;
      if (event.error === "canceled" || event.error === "interrupted") {
        this.finish(active, "cancelled");
      } else {
        this.active = null;
        active.reject(new Error(`Speech synthesis stopped: ${event.error}.`));
      }
    };
    window.speechSynthesis.speak(utterance);
  }

  private finish(active: ActiveSpeech, outcome: SpeechOutcome) {
    if (this.active !== active) return;
    this.active = null;
    active.resolve(outcome);
  }

  private fail(active: ActiveSpeech, error: Error) {
    if (this.active !== active) return;
    this.active = null;
    active.reject(error);
  }
}
