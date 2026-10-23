"use client";

import { ArrowLeft, ArrowRight, Circle, Maximize2, Pause, Play, Printer, Settings2, Square, Volume2, VolumeX, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { speechLocaleForLanguage, type NarrationSettings, type StudioPresentation, type StudioSlide } from "@/lib/demo-data";
import { mapServerPresentation, preferLocalPresentations, readLocalPresentations, toServerPayload, writeLocalPresentations } from "@/lib/client-store";
import { BrowserSpeechDriver, type AvailableVoice } from "@/lib/browser-speech";
import { narrationForSlide, PresentationPlayback, type PlayerMode, type PlayerStatus } from "@/lib/narration";
import { ThemeToggle } from "@/components/theme-toggle";
import { LivePresentationRoom } from "@/components/live-presentation-room";
import { SlideArtwork, SlideArtworkCopy } from "@/components/slide-artwork";

function Slide({ slide, index, total, theme, slideRef }: { slide: StudioSlide; index: number; total: number; theme: StudioPresentation["theme"]; slideRef?: React.Ref<HTMLDivElement> }) {
  return (
    <SlideArtwork slide={slide} index={index} total={total} theme={theme} className="present-canvas" slideRef={slideRef}>
      <SlideArtworkCopy slide={slide} theme={theme} />
    </SlideArtwork>
  );
}

export function AudiencePlayer({ id, shareToken }: { id?: string; shareToken?: string }) {
  const [presentation, setPresentation] = useState<StudioPresentation | null>(null);
  const [index, setIndex] = useState(0);
  const [notesVisible, setNotesVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<PlayerMode>("manual");
  const [playbackStatus, setPlaybackStatus] = useState<PlayerStatus>("idle");
  const [narrationError, setNarrationError] = useState("");
  const [finishMessage, setFinishMessage] = useState("");
  const [voices, setVoices] = useState<AvailableVoice[]>([]);
  const [highlight, setHighlight] = useState<[number, number]>([0, 0]);
  const [narrationSettings, setNarrationSettings] = useState<NarrationSettings>({ rate: 1, volume: 1 });
  const playbackRef = useRef<PresentationPlayback | null>(null);
  const presentationRef = useRef<StudioPresentation | null>(null);
  const narrationSettingsRef = useRef(narrationSettings);
  const touchStartX = useRef<number | null>(null);
  const settingsSaveTimer = useRef<number | undefined>(undefined);
  const slideElementRef = useRef<HTMLDivElement | null>(null);
  const captureVideoRef = useRef<HTMLVideoElement | null>(null);
  const recordingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);
  const recordedStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingFrameRef = useRef<number | null>(null);
  const shouldDownloadRecordingRef = useRef(true);
  const microphoneTrackRef = useRef<MediaStreamTrack | null>(null);
  const onMicrophoneTrack = useCallback((track: MediaStreamTrack | null) => {
    microphoneTrackRef.current = track;
  }, []);
  const [recording, setRecording] = useState(false);
  const [recordingError, setRecordingError] = useState("");
  const [recordingNotice, setRecordingNotice] = useState("");
  const [cameraControlsHost, setCameraControlsHost] = useState<HTMLDivElement | null>(null);
  const slide = presentation?.slides[index];
  const autoPrint = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("print") === "1";

  useEffect(() => { presentationRef.current = presentation; }, [presentation]);
  useEffect(() => { narrationSettingsRef.current = narrationSettings; }, [narrationSettings]);
  useEffect(() => { playbackRef.current?.setMuted(narrationSettings.muted ?? false); }, [narrationSettings.muted]);
  useEffect(() => { playbackRef.current?.setVolume(narrationSettings.volume ?? 1); }, [narrationSettings.volume]);
  useEffect(() => {
    const speech = new BrowserSpeechDriver();
    const playback = new PresentationPlayback(
      () => presentationRef.current?.slides ?? [],
      () => narrationSettingsRef.current,
      () => speechLocaleForLanguage[presentationRef.current?.language ?? "en"],
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
    speech.setVolume(narrationSettingsRef.current.volume ?? 1);
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

  useEffect(() => () => {
    shouldDownloadRecordingRef.current = false;
    if (recordingFrameRef.current !== null) cancelAnimationFrame(recordingFrameRef.current);
    mediaRecorderRef.current?.stop();
    captureStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordedStreamRef.current?.getTracks().forEach((track) => track.stop());
    void recordingAudioContextRef.current?.close();
    recordingAudioContextRef.current = null;
    captureStreamRef.current = null;
    recordedStreamRef.current = null;
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
      const merged = preferLocalPresentations(rows.map(mapServerPresentation), readLocalPresentations());
      const match = merged.find((item) => item.id === id);
      if (match) {
        setPresentation(match);
        setNarrationSettings(match.narrationSettings);
        writeLocalPresentations(merged);
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
      if (event.key === "Escape") {
        setSettingsOpen(false);
        if (document.fullscreenElement) document.exitFullscreen?.();
        return;
      }
      if (event.target instanceof HTMLElement && (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(event.target.tagName) || event.target.isContentEditable)) return;
      if (event.key === "ArrowRight" || event.key === " " || event.key === "PageDown") { event.preventDefault(); playbackRef.current?.navigate(index + 1); }
      if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); playbackRef.current?.navigate(index - 1); }
      if (event.key.toLowerCase() === "n" && !shareToken) setNotesVisible((value) => !value);
      if (event.key.toLowerCase() === "f") document.documentElement.requestFullscreen?.();
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

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") {
      setRecordingError("Screen recording is not supported in this browser. Try the latest version of Chrome or Edge.");
      return;
    }
    if (mediaRecorderRef.current) return;
    setRecordingError("");
    setRecordingNotice("");
    shouldDownloadRecordingRef.current = true;

    let capture: MediaStream | null = null;
    let audioContext: AudioContext | null = null;
    try {
      audioContext = new AudioContext();
      recordingAudioContextRef.current = audioContext;
      await audioContext.resume();
      const screenCapture = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      capture = screenCapture;
      captureStreamRef.current = screenCapture;
      const displayTrack = screenCapture.getVideoTracks()[0];
      if (!displayTrack || displayTrack.getSettings().displaySurface !== "browser") {
        throw new Error("Choose the presentation's browser tab in the sharing dialog so the recording can exclude the controls.");
      }

      const video = captureVideoRef.current;
      const canvas = recordingCanvasRef.current;
      if (!video || !canvas || !slideElementRef.current) throw new Error("The presentation slide is not ready to record.");
      video.srcObject = screenCapture;
      await video.play();
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        await new Promise<void>((resolve, reject) => {
          video.addEventListener("loadeddata", () => resolve(), { once: true });
          video.addEventListener("error", () => reject(new Error("The shared browser tab could not be captured.")), { once: true });
        });
      }

      canvas.width = 1920;
      canvas.height = 1080;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not prepare the slide recording canvas.");
      const drawSlide = () => {
        const bounds = slideElementRef.current?.getBoundingClientRect();
        if (bounds && video.videoWidth > 0 && video.videoHeight > 0) {
          const scaleX = video.videoWidth / window.innerWidth;
          const scaleY = video.videoHeight / window.innerHeight;
          context.drawImage(
            video,
            bounds.left * scaleX,
            bounds.top * scaleY,
            bounds.width * scaleX,
            bounds.height * scaleY,
            0,
            0,
            canvas.width,
            canvas.height,
          );
        }
        recordingFrameRef.current = requestAnimationFrame(drawSlide);
      };
      drawSlide();

      const canvasStream = canvas.captureStream(30);
      const audioInputs = [
        ...screenCapture.getAudioTracks(),
        ...(microphoneTrackRef.current?.readyState === "live" ? [microphoneTrackRef.current] : []),
      ];
      let audioTracks: MediaStreamTrack[] = [];
      if (audioInputs.length > 0) {
        const destination = audioContext.createMediaStreamDestination();
        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.knee.value = 18;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.005;
        compressor.release.value = 0.25;
        for (const track of audioInputs) {
          audioContext.createMediaStreamSource(new MediaStream([track])).connect(compressor);
        }
        compressor.connect(destination);
        audioTracks = destination.stream.getAudioTracks();
      }
      const recordedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioTracks,
      ]);
      recordedStreamRef.current = recordedStream;
      const mimeType = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(recordedStream, mimeType ? { mimeType } : undefined);
      const parts: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) parts.push(event.data);
      };
      recorder.onstop = () => {
        if (shouldDownloadRecordingRef.current) setRecording(false);
        if (shouldDownloadRecordingRef.current && parts.length > 0) {
          const blob = new Blob(parts, { type: recorder.mimeType || "video/webm" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          const title = presentation?.title.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").replace(/\s+/g, "-") || "presentation";
          const extension = recorder.mimeType.includes("mp4") ? "mp4" : "webm";
          link.href = url;
          link.download = `${title}-presentation.${extension}`;
          link.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
          setRecordingNotice("Recording downloaded to your device. It was not saved to the presentation or database.");
        }
        if (recordingFrameRef.current !== null) cancelAnimationFrame(recordingFrameRef.current);
        recordingFrameRef.current = null;
        screenCapture.getTracks().forEach((track) => track.stop());
        recordedStream.getTracks().forEach((track) => track.stop());
        captureStreamRef.current = null;
        recordedStreamRef.current = null;
        if (video) video.srcObject = null;
        mediaRecorderRef.current = null;
        void audioContext?.close();
        if (recordingAudioContextRef.current === audioContext) recordingAudioContextRef.current = null;
      };
      recorder.onerror = () => {
        shouldDownloadRecordingRef.current = false;
        setRecordingError("The recording stopped because the browser reported an error.");
        stopRecording();
      };
      displayTrack.addEventListener("ended", stopRecording, { once: true });
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setRecording(true);
      setRecordingNotice("Recording the slide only. Choose this tab and enable tab audio to include narration.");
    } catch (cause) {
      shouldDownloadRecordingRef.current = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      capture?.getTracks().forEach((track) => track.stop());
      recordedStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordedStreamRef.current = null;
      void audioContext?.close();
      recordingAudioContextRef.current = null;
      captureStreamRef.current = null;
      if (captureVideoRef.current) captureVideoRef.current.srcObject = null;
      if (recordingFrameRef.current !== null) cancelAnimationFrame(recordingFrameRef.current);
      recordingFrameRef.current = null;
      const message = cause instanceof Error ? cause.message : "The recording could not be started.";
      setRecordingError(message);
    }
  }

  useEffect(() => {
    if (recording && playbackStatus === "finished") stopRecording();
  }, [recording, playbackStatus]);

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
      <header className="present-topbar">
        <div className="present-heading">
          {!shareToken && <Link href="/" className="present-exit" aria-label="Exit presentation"><X size={17} /></Link>}
          <div className="present-title-group"><strong>{presentation.title}</strong><span>{shareToken ? "Presentation" : "Presentation mode · ← → to navigate"}</span></div>
        </div>
        <div className="present-header-actions">
          {!shareToken && <button className={`present-settings-toggle ${settingsOpen ? "active" : ""}`} type="button" aria-label="Presentation settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((open) => !open)}><Settings2 size={16} /><span>Settings</span></button>}
          <ThemeToggle />
        </div>
        {!shareToken && <div className="present-settings-popover" hidden={!settingsOpen} aria-label="Presentation settings">
          <div className="present-settings-heading"><div><strong>Presentation settings</strong><span>Voice, volume, camera and microphone</span></div><button type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={15} /></button></div>
          <div className="present-settings-content">
            <span className="narration-setting">Language: {{ en: "English", nl: "Dutch", ro: "Romanian", es: "Spanish" }[presentation.language]}</span>
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
            <label className="narration-setting volume-setting"><Volume2 size={14} /><span>Voice volume</span><input type="range" min="0" max="100" step="1" aria-label="Narration volume" value={Math.round((narrationSettings.volume ?? 1) * 100)} onChange={(event) => {
              const volume = Number(event.target.value) / 100;
              playbackRef.current?.setVolume(volume);
              updateNarrationSettings({ volume });
            }} /><output>{Math.round((narrationSettings.volume ?? 1) * 100)}%</output></label>
            <button className="present-settings-mute" aria-pressed={narrationSettings.muted ?? false} aria-label={narrationSettings.muted ? "Unmute narration" : "Mute narration"} onClick={() => {
              const muted = !(narrationSettings.muted ?? false);
              playbackRef.current?.setMuted(muted);
              updateNarrationSettings({ muted });
            }}>{narrationSettings.muted ? <VolumeX size={15} /> : <Volume2 size={15} />} {narrationSettings.muted ? "Unmute narration" : "Mute narration"}</button>
            <div className="presentation-camera-controls" ref={setCameraControlsHost} aria-label="Camera and microphone settings" />
            {recordingError && <p className="narration-error" role="alert">{recordingError}</p>}
            {narrationError && <p className="narration-error" role="alert">{narrationError}</p>}
          </div>
        </div>}
      </header>
      <section className="present-stage" onTouchStart={(event) => { touchStartX.current = event.changedTouches[0]?.clientX ?? null; }} onTouchEnd={(event) => {
        const start = touchStartX.current;
        const end = event.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (start !== null && end !== undefined && Math.abs(end - start) > 45) navigate(end < start ? 1 : -1);
      }}>
        <button className="present-side-nav present-side-nav-previous" type="button" aria-label="Previous slide" disabled={index === 0} onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
        <div className="present-stage-frame">
          <Slide slide={slide} index={index} total={presentation.slides.length} theme={presentation.theme} slideRef={slideElementRef} />
          {!autoPrint && <LivePresentationRoom
            tokenEndpoint={shareToken ? `/api/share/${shareToken}/room-token` : `/api/presentations/${presentation.id}/room-token`}
            enabled={Boolean(shareToken || id)}
            password={password || undefined}
            isPresenter={!shareToken}
            controlsHost={shareToken ? null : cameraControlsHost}
            onMicrophoneTrack={onMicrophoneTrack}
          />}
        </div>
        <button className="present-side-nav present-side-nav-next" type="button" aria-label="Next slide" disabled={index >= presentation.slides.length - 1} onClick={() => navigate(1)}><ArrowRight size={18} /></button>
        {!shareToken && notesVisible && slide.notes && <aside className="speaker-note-bar"><strong>SPREKERSNOTITIES — ALLEEN VOOR JOU</strong>{slide.notes}</aside>}
      </section>
      <video ref={captureVideoRef} className="recording-capture-source" muted playsInline aria-hidden="true" />
      <canvas ref={recordingCanvasRef} className="recording-capture-source" aria-hidden="true" />
      <section className="print-deck" aria-hidden="true">{presentation.slides.map((item, slideIndex) => <Slide key={item.id} slide={item} index={slideIndex} total={presentation.slides.length} theme={presentation.theme} />)}</section>
      {!shareToken && (
        <section className="present-dock" aria-label="Presentation playback controls">
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
            {!recording
              ? <button className="record-presentation-button" title="Records only the slide. Select this tab and enable tab audio to include narration." onClick={() => void startRecording()}><Circle size={12} /> Record</button>
              : <button className="record-presentation-button is-recording" onClick={stopRecording}><Square size={12} /> Stop &amp; download</button>}
          </div>
          {recordingNotice && <span className={`recording-message ${recording ? "is-recording" : ""}`} role="status">{recording && <i aria-hidden="true" />}{recordingNotice}</span>}
          {narrationError && <p className="narration-error present-dock-error" role="alert">{narrationError}</p>}
          {playbackStatus === "playing" && <div className="present-caption" aria-live="polite"><span>NOW SPEAKING</span><p>{(() => {
            const text = narrationForSlide(slide);
            const [start, length] = highlight;
            if (!length || start >= text.length) return text;
            return <>{text.slice(0, start)}<mark>{text.slice(start, start + length)}</mark>{text.slice(start + length)}</>;
          })()}</p></div>}
        </section>
      )}
      <footer className="present-controls">
        <div className="present-progress"><span>{index + 1} / {presentation.slides.length}</span><div className="progress-track"><span style={{ width: `${((index + 1) / presentation.slides.length) * 100}%` }} /></div><span>{presentation.slides.length} slides</span></div>
        <div className="present-utility-controls">
          {!shareToken && <button className={notesVisible ? "active" : ""} aria-pressed={notesVisible} onClick={() => setNotesVisible((value) => !value)}>Notes</button>}
          <button aria-label="Print or save as PDF" onClick={() => window.print()}><Printer size={14} /><span>PDF</span></button>
          <button aria-label="Full screen" onClick={() => document.documentElement.requestFullscreen?.()}><Maximize2 size={14} /><span>Full screen</span></button>
        </div>
      </footer>
    </main>
  );
}

export default function PresentPage() {
  const { id } = useParams<{ id: string }>();
  return <AudiencePlayer id={id} />;
}
