"use client";

import { ArrowLeft, ArrowRight, Maximize2, Pause, Play, Printer, Square, Volume2, VolumeX, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { speechLocaleForLanguage, type NarrationSettings, type StudioPresentation, type StudioSlide } from "@/lib/demo-data";
import { mapServerPresentation, readLocalPresentations, toServerPayload, writeLocalPresentations } from "@/lib/client-store";
import { BrowserSpeechDriver, type AvailableVoice } from "@/lib/browser-speech";
import { narrationForSlide, PresentationPlayback, type PlayerMode, type PlayerStatus } from "@/lib/narration";
import { ThemeToggle } from "@/components/theme-toggle";

function Slide({ slide, index, total, theme }: { slide: StudioSlide; index: number; total: number; theme: StudioPresentation["theme"] }) {
  const colors = slide.content.textColors ?? {};
  return (
    <div className={`present-canvas ${slide.layout}`} style={{ backgroundColor: theme.background }}>
      {slide.content.image && <Image src={slide.content.image} alt="" fill sizes="100vw" priority={index === 0} unoptimized />}
      <div className="slide-canvas-copy">
        {slide.content.eyebrow && <span className="eyebrow" style={{ color: colors.eyebrow ?? theme.accent }}>{slide.content.eyebrow}</span>}
        <h1 style={{ fontFamily: theme.font, color: colors.title ?? "#30372c" }}>{slide.title}</h1>
        {slide.subtitle && <h2 style={{ color: colors.subtitle ?? "#818c79" }}>{slide.subtitle}</h2>}
        {slide.content.body && <p style={{ color: colors.body ?? "#697265" }}>{slide.content.body}</p>}
        {!!slide.content.bullets?.length && <ul>{slide.content.bullets.map((item, bulletIndex) => <li key={`${bulletIndex}-${item}`} style={{ color: colors.bullets ?? "#4e594b" }}>{item}</li>)}</ul>}
        {!!slide.content.stats?.length && <div className="stats-row">{slide.content.stats.map((stat) => <div className="stat-box" key={stat.label}><strong style={{ color: colors.stats ?? "#627a4d" }}>{stat.value}</strong><span style={{ color: colors.stats ?? "#7a8474" }}>{stat.label}</span></div>)}</div>}
      </div>
      <span className="slide-canvas-number">{String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
    </div>
  );
}

export function AudiencePlayer({ id, shareToken }: { id?: string; shareToken?: string }) {
  const [presentation, setPresentation] = useState<StudioPresentation | null>(null);
  const [index, setIndex] = useState(0);
  const [notesVisible, setNotesVisible] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<PlayerMode>("manual");
  const [playbackStatus, setPlaybackStatus] = useState<PlayerStatus>("idle");
  const [narrationError, setNarrationError] = useState("");
  const [finishMessage, setFinishMessage] = useState("");
  const [voices, setVoices] = useState<AvailableVoice[]>([]);
  const [highlight, setHighlight] = useState<[number, number]>([0, 0]);
  const [narrationSettings, setNarrationSettings] = useState<NarrationSettings>({ rate: 1 });
  const playbackRef = useRef<PresentationPlayback | null>(null);
  const presentationRef = useRef<StudioPresentation | null>(null);
  const narrationSettingsRef = useRef(narrationSettings);
  const touchStartX = useRef<number | null>(null);
  const settingsSaveTimer = useRef<number | undefined>(undefined);
  const slide = presentation?.slides[index];
  const autoPrint = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("print") === "1";

  useEffect(() => { presentationRef.current = presentation; }, [presentation]);
  useEffect(() => { narrationSettingsRef.current = narrationSettings; }, [narrationSettings]);
  useEffect(() => { playbackRef.current?.setMuted(narrationSettings.muted ?? false); }, [narrationSettings.muted]);
  useEffect(() => {
    const speech = new BrowserSpeechDriver();
    const playback = new PresentationPlayback(
      () => presentationRef.current?.slides ?? [],
      () => narrationSettingsRef.current,
      () => speechLocaleForLanguage[presentationRef.current?.language ?? "nl"],
      speech,
      {
        onIndex: setIndex,
        onStatus: setPlaybackStatus,
        onHighlight: (start, length) => setHighlight([start, length]),
        onFinished: () => setFinishMessage("Presentation finished"),
        onError: setNarrationError,
      },
    );
    speech.setMuted(narrationSettingsRef.current.muted ?? false);
    playbackRef.current = playback;
    const refreshVoices = () => setVoices(BrowserSpeechDriver.voices());
    const voiceTimer = window.setTimeout(refreshVoices, 0);
    if (BrowserSpeechDriver.available()) {
      window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
    }
    return () => {
      playback.dispose();
      playbackRef.current = null;
      window.clearTimeout(voiceTimer);
      if (BrowserSpeechDriver.available()) window.speechSynthesis.removeEventListener("voiceschanged", refreshVoices);
    };
  }, []);

  useEffect(() => () => {
    if (settingsSaveTimer.current !== undefined) window.clearTimeout(settingsSaveTimer.current);
  }, []);

  useEffect(() => {
    if (shareToken) {
      fetch(`/api/share/${shareToken}`).then(async (response) => {
        const data = await response.json() as Record<string, unknown>;
        if (response.status === 401 && data.passwordRequired) setPasswordRequired(true);
        else if (!response.ok) setError(String(data.error ?? "Presentation unavailable."));
        else {
          const mapped = mapServerPresentation(data);
          setPresentation(mapped);
          setNarrationSettings(mapped.narrationSettings);
        }
      }).catch(() => setError("The presentation link could not be loaded."));
      return;
    }
    if (!id) return;
    void Promise.resolve().then(() => {
      const local = readLocalPresentations().find((item) => item.id === id);
      if (local) {
        setPresentation(local);
        setNarrationSettings(local.narrationSettings);
      }
      return fetch("/api/presentations");
    }).then(async (response) => {
      if (!response.ok) return;
      const rows = await response.json() as Record<string, unknown>[];
      const match = rows.map(mapServerPresentation).find((item) => item.id === id);
      if (match) {
        setPresentation(match);
        setNarrationSettings(match.narrationSettings);
      }
    }).catch(() => undefined);
  }, [id, shareToken]);

  useEffect(() => {
    if (!presentation || !autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 700);
    return () => window.clearTimeout(timer);
  }, [presentation, autoPrint]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(event.target.tagName) || event.target.isContentEditable)) return;
      if (event.key === "ArrowRight" || event.key === " " || event.key === "PageDown") { event.preventDefault(); playbackRef.current?.navigate(index + 1); }
      if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); playbackRef.current?.navigate(index - 1); }
      if (event.key.toLowerCase() === "n" && !shareToken) setNotesVisible((value) => !value);
      if (event.key.toLowerCase() === "f") document.documentElement.requestFullscreen?.();
      if (event.key === "Escape" && document.fullscreenElement) document.exitFullscreen?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, shareToken]);

  function switchMode(nextMode: PlayerMode) {
    setFinishMessage("");
    setNarrationError("");
    if (nextMode === "manual") playbackRef.current?.setManualMode();
    else playbackRef.current?.setAutomaticMode();
    setMode(nextMode);
  }

  function navigate(delta: number) {
    setFinishMessage("");
    playbackRef.current?.navigate(index + delta);
  }

  const updateNarrationSettings = useCallback((changes: Partial<NarrationSettings>) => {
    const nextSettings = { ...narrationSettings, ...changes };
    setNarrationSettings(nextSettings);
    narrationSettingsRef.current = nextSettings;
    if (!presentation || shareToken) return;
    const updated = { ...presentation, narrationSettings: nextSettings };
    setPresentation(updated);
    const saved = readLocalPresentations().map((item) => item.id === updated.id ? updated : item);
    writeLocalPresentations(saved);
    if (settingsSaveTimer.current !== undefined) window.clearTimeout(settingsSaveTimer.current);
    settingsSaveTimer.current = window.setTimeout(() => {
      fetch(`/api/presentations/${updated.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toServerPayload(updated)),
      }).then((response) => {
        if (!response.ok && response.status !== 503) setNarrationError("This setting was saved locally but could not be synchronized.");
      }).catch(() => setNarrationError("This setting was saved locally; the server could not be reached."));
    }, 500);
  }, [narrationSettings, presentation, shareToken]);

  async function unlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shareToken) return;
    setError("");
    try {
      const response = await fetch(`/api/share/${shareToken}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const data = await response.json() as Record<string, unknown>;
      if (!response.ok) { setError(String(data.error ?? "The link could not be opened.")); return; }
      const mapped = mapServerPresentation(data);
      setPresentation(mapped);
      setNarrationSettings(mapped.narrationSettings);
      setPasswordRequired(false);
    } catch {
      setError("The link could not be opened. Check your connection.");
    }
  }

  if (passwordRequired) return <main className="share-password-page"><form onSubmit={unlock}><div className="brand-mark"><Maximize2 size={17} /></div><h1>Private presentation</h1><p>Enter the password you received.</p><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button className="button button-primary">Open presentation</button>{error && <span className="share-error">{error}</span>}</form></main>;
  if (error || !presentation || !slide) return <main className="share-error-page"><p>{error || "Loading presentation…"}</p><Link href="/">Back to Studio</Link></main>;

  return (
    <main className="present-shell">
      <header className="present-topbar">{shareToken ? <strong>{presentation.title}</strong> : <><Link href="/" aria-label="Close"><X size={17} /></Link><strong>{presentation.title}</strong></>}<span>{shareToken ? "Presentation" : "Presentation mode · ← → to navigate"}</span><ThemeToggle /></header>
      <section className="present-stage" onTouchStart={(event) => { touchStartX.current = event.changedTouches[0]?.clientX ?? null; }} onTouchEnd={(event) => {
        const start = touchStartX.current;
        const end = event.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (start !== null && end !== undefined && Math.abs(end - start) > 45) navigate(end < start ? 1 : -1);
      }}><Slide slide={slide} index={index} total={presentation.slides.length} theme={presentation.theme} /></section>
      <section className="print-deck" aria-hidden="true">{presentation.slides.map((item, slideIndex) => <Slide key={item.id} slide={item} index={slideIndex} total={presentation.slides.length} theme={presentation.theme} />)}</section>
      {!shareToken && notesVisible && slide.notes && <aside className="speaker-note-bar"><strong>SPREKERSNOTITIES — ALLEEN VOOR JOU</strong>{slide.notes}</aside>}
      {!shareToken && (
        <section className="narration-panel" aria-label="Narration and playback settings">
          <div className="narration-mode-switch" role="group" aria-label="Presentation mode">
            <button className={mode === "manual" ? "active" : ""} aria-pressed={mode === "manual"} onClick={() => switchMode("manual")}>Manual mode</button>
            <button className={mode === "automatic" ? "active" : ""} aria-pressed={mode === "automatic"} onClick={() => switchMode("automatic")}>Automatic voice mode</button>
          </div>
          <div className="narration-controls">
            {mode === "automatic" && playbackStatus === "idle" && <button className="narration-primary" onClick={() => { setFinishMessage(""); setNarrationError(""); playbackRef.current?.startAutomatic(index); }}><Play size={13} /> Start automatic presentation</button>}
            {mode === "automatic" && playbackStatus === "finished" && <button className="narration-primary" onClick={() => { setFinishMessage(""); playbackRef.current?.startAutomatic(0); }}><Play size={13} /> Play again</button>}
            {mode === "manual" && playbackStatus === "idle" && <button onClick={() => { setNarrationError(""); playbackRef.current?.startManualNarration(index); }}><Volume2 size={13} /> Narrate this slide</button>}
            {playbackStatus === "playing" && <button onClick={() => playbackRef.current?.pause()}><Pause size={13} /> Pause</button>}
            {playbackStatus === "paused" && <button onClick={() => playbackRef.current?.resume()}><Play size={13} /> Resume</button>}
            {(playbackStatus === "playing" || playbackStatus === "paused") && <button onClick={() => { playbackRef.current?.stop(); setFinishMessage(""); }}><Square size={12} /> Stop</button>}
            {playbackStatus === "playing" && <span className="playing-indicator" role="status"><i /> {mode === "automatic" ? "Presenting automatically" : "Narrating this slide"}</span>}
            {playbackStatus === "paused" && <span className="playing-indicator paused" role="status">Paused</span>}
            {playbackStatus === "finished" && <strong className="finished-message" role="status">{finishMessage || "Presentation finished"}</strong>}
          </div>
          <span className="narration-setting">Language: {presentation.language === "nl" ? "Dutch" : presentation.language === "ro" ? "Romanian" : "Spanish"}</span>
          <label className="narration-setting">Voice
            <select value={narrationSettings.voiceURI ?? ""} onChange={(event) => updateNarrationSettings({ voiceURI: event.target.value || undefined })}>
              <option value="">Automatic ({presentation.language})</option>
              {voices.filter((voice) => voice.lang.toLowerCase().startsWith(speechLocaleForLanguage[presentation.language].slice(0, 2))).map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}
            </select>
          </label>
          {narrationSettings.voiceURI && !voices.some((voice) => voice.voiceURI === narrationSettings.voiceURI && voice.lang.toLowerCase().startsWith(speechLocaleForLanguage[presentation.language].slice(0, 2))) && <span className="field-hint">The saved voice is unavailable for this language. Choose Automatic or another compatible voice.</span>}
          <label className="narration-setting">Speed
            <select aria-label="Narration speed" value={narrationSettings.rate} onChange={(event) => updateNarrationSettings({ rate: Number(event.target.value) })}>
              <option value="0.8">Slow</option><option value="1">Normal</option><option value="1.2">Fast</option>
            </select>
          </label>
          <button aria-pressed={narrationSettings.muted ?? false} aria-label={narrationSettings.muted ? "Unmute narration" : "Mute narration"} onClick={() => {
            const muted = !(narrationSettings.muted ?? false);
            playbackRef.current?.setMuted(muted);
            updateNarrationSettings({ muted });
          }}>{narrationSettings.muted ? <VolumeX size={15} /> : <Volume2 size={15} />} {narrationSettings.muted ? "Unmute" : "Mute"}</button>
          {playbackStatus === "playing" && (
            <div className="narrated-text" aria-live="polite"><span>NOW SPEAKING</span><p>{(() => {
              const text = narrationForSlide(slide);
              const [start, length] = highlight;
              if (!length || start >= text.length) return text;
              return <>{text.slice(0, start)}<mark>{text.slice(start, start + length)}</mark>{text.slice(start + length)}</>;
            })()}</p></div>
          )}
          {narrationError && <p className="narration-error" role="alert">{narrationError}</p>}
        </section>
      )}
      <footer className="present-controls">
        <button disabled={index === 0} onClick={() => navigate(-1)}><ArrowLeft size={14} /> Previous</button>
        <span>{index + 1} / {presentation.slides.length}</span>
        <div className="progress-track"><span style={{ width: `${((index + 1) / presentation.slides.length) * 100}%` }} /></div>
        {!shareToken && <button onClick={() => setNotesVisible((value) => !value)}>Notes: {notesVisible ? "on" : "off"}</button>}
        <button aria-label="Print or save as PDF" onClick={() => window.print()}><Printer size={14} /> PDF</button>
        <button onClick={() => navigate(1)}>Next <ArrowRight size={14} /></button>
        <button aria-label="Full screen" onClick={() => document.documentElement.requestFullscreen?.()}><Maximize2 size={14} /></button>
      </footer>
    </main>
  );
}

export default function PresentPage() {
  const { id } = useParams<{ id: string }>();
  return <AudiencePlayer id={id} />;
}
