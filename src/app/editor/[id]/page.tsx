"use client";

import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, Copy, Eye, ImagePlus,
  LoaderCircle, Minus, Move, Palette, Plus, RotateCcw, Save, Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createTemplateSlides, type PresentationLanguage, type SlideMediaElement, type StudioPresentation, type StudioSlide } from "@/lib/demo-data";
import { mapServerPresentation, preferLocalPresentations, readLocalPresentations, toServerPayload, writeLocalPresentations } from "@/lib/client-store";
import { ThemeToggle } from "@/components/theme-toggle";
import { SlideMediaVisual, slideMediaIconChoices } from "@/components/slide-media-visual";
import { SlideArtwork, SlideArtworkCopy } from "@/components/slide-artwork";

type TextColorKey = keyof NonNullable<StudioSlide["content"]["textColors"]>;
type TextPosition = { x: number; y: number };
type MediaBounds = Pick<SlideMediaElement, "x" | "y" | "width" | "height">;

const textPalette = ["#30372c", "#718b55", "#9aba70", "#d26948", "#4c78a8", "#ffffff"];
function SlideTextSection({ id, label, color, position, size, selected, onSelect, onColorChange, onPositionChange, onSizeChange, children }: {
  id: string;
  label: string;
  color: string;
  position?: TextPosition;
  size: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onColorChange: (color: string) => void;
  onPositionChange: (position: TextPosition) => void;
  onSizeChange: (size: number) => void;
  children: React.ReactNode;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState<TextPosition>(position ?? { x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const drag = useRef<{ pointerId: number; startX: number; startY: number; x: number; y: number; finalX: number; finalY: number; width: number; height: number } | null>(null);
  const resize = useRef<{ pointerId: number; startX: number; startY: number; startSize: number; width: number } | null>(null);
  const [resizingSize, setResizingSize] = useState<number | null>(null);

  function startDrag(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const canvas = event.currentTarget.closest(".slide-canvas");
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const current = position ?? { x: 0, y: 0 };
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: current.x, y: current.y, finalX: current.x, finalY: current.y, width: bounds.width, height: bounds.height };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect(id);
  }

  function moveDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const next = {
      x: Math.max(-100, Math.min(100, start.x + (event.clientX - start.startX) / start.width * 100)),
      y: Math.max(-100, Math.min(100, start.y + (event.clientY - start.startY) / start.height * 100)),
    };
    start.finalX = next.x;
    start.finalY = next.y;
    setDragOffset(next);
  }

  function endDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const final = { x: start.finalX, y: start.finalY };
    drag.current = null;
    setIsDragging(false);
    setDragOffset(final);
    onPositionChange(final);
  }

  function cancelDrag() {
    drag.current = null;
    setIsDragging(false);
    setDragOffset(position ?? { x: 0, y: 0 });
  }

  function startResize(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const canvas = event.currentTarget.closest(".slide-canvas");
    if (!canvas) return;
    resize.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startSize: size,
      width: canvas.getBoundingClientRect().width,
    };
    setResizingSize(size);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveResize(event: React.PointerEvent<HTMLButtonElement>) {
    const start = resize.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const diagonalDelta = (event.clientX - start.startX + event.clientY - start.startY) / start.width * 100;
    setResizingSize(Math.max(25, Math.min(300, Math.round(start.startSize + diagonalDelta))));
  }

  function endResize(event: React.PointerEvent<HTMLButtonElement>) {
    const start = resize.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const diagonalDelta = (event.clientX - start.startX + event.clientY - start.startY) / start.width * 100;
    const finalSize = Math.max(25, Math.min(300, Math.round(start.startSize + diagonalDelta)));
    resize.current = null;
    setResizingSize(null);
    if (finalSize !== null && finalSize !== size) onSizeChange(finalSize);
  }

  function nudgePosition(event: React.KeyboardEvent<HTMLButtonElement>) {
    const movement: Record<string, TextPosition> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const step = event.shiftKey ? 5 : 1;
    const delta = movement[event.key];
    if (!delta) return;
    event.preventDefault();
    const current = position ?? { x: 0, y: 0 };
    const next = {
      x: Math.max(-100, Math.min(100, current.x + delta.x * step)),
      y: Math.max(-100, Math.min(100, current.y + delta.y * step)),
    };
    onPositionChange(next);
  }

  const offset = isDragging ? dragOffset : position;
  return (
    <div
      className={`slide-text-section ${selected ? "is-selected" : ""}`}
      data-text-section={id}
      style={offset ? { translate: `${offset.x}cqw ${offset.y}cqh` } : undefined}
      onClick={() => onSelect(id)}
    >
      {selected && <button className="text-move-handle" type="button" aria-label={`Drag to move ${label}`} title={`Drag to move ${label}. Use arrow keys to nudge it.`} onKeyDown={nudgePosition} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={cancelDrag}><Move size={12} /></button>}
      {selected && <div className="text-color-popover">
        <button className="text-color-trigger" type="button" aria-label={`Choose ${label} text color`} aria-expanded={paletteOpen} onClick={(event) => { event.stopPropagation(); setPaletteOpen((open) => !open); }}><Palette size={13} /></button>
        {paletteOpen && <div className="text-color-menu" role="group" aria-label={`${label} color palette`}>
          <div className="text-color-swatches">{textPalette.map((swatch) => <button key={swatch} type="button" aria-label={`Set color ${swatch}`} title={swatch} style={{ backgroundColor: swatch }} onClick={(event) => { event.stopPropagation(); onColorChange(swatch); }} />)}</div>
          <label className="custom-color-control"><span>Custom</span><input type="color" aria-label={`Custom ${label} text color`} value={color} onChange={(event) => onColorChange(event.target.value)} /></label>
        </div>}
      </div>}
      <div className="slide-text-content" style={{ zoom: (resizingSize ?? size) / 100 }}>{children}</div>
      {selected && <button className="text-resize-handle" type="button" aria-label={`Resize ${label} text group`} title="Drag to resize text" onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={() => { resize.current = null; setResizingSize(null); }} />}
    </div>
  );
}

function SlideMediaObject({ element, selected, onSelect, onChange }: {
  element: SlideMediaElement;
  selected: boolean;
  onSelect: () => void;
  onChange: (bounds: MediaBounds) => void;
}) {
  const [previewBounds, setPreviewBounds] = useState<MediaBounds | null>(null);
  const gesture = useRef<{ pointerId: number; startX: number; startY: number; bounds: MediaBounds; width: number; height: number; mode: "move" | "resize" } | null>(null);
  const bounds = previewBounds ?? element;

  function beginGesture(event: React.PointerEvent<HTMLElement>, mode: "move" | "resize") {
    if (event.button !== 0) return;
    if (element.type === "video" && (event.target as HTMLElement).closest("video")) return;
    event.preventDefault();
    event.stopPropagation();
    const canvas = event.currentTarget.closest(".slide-canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      bounds: element,
      width: rect.width,
      height: rect.height,
      mode,
    };
    setPreviewBounds(element);
    onSelect();
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateGesture(event: React.PointerEvent<HTMLElement>) {
    const start = gesture.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const dx = (event.clientX - start.startX) / start.width * 100;
    const dy = (event.clientY - start.startY) / start.height * 100;
    if (start.mode === "move") {
      setPreviewBounds({
        ...start.bounds,
        x: Math.max(0, Math.min(100 - start.bounds.width, start.bounds.x + dx)),
        y: Math.max(0, Math.min(100 - start.bounds.height, start.bounds.y + dy)),
      });
    } else {
      setPreviewBounds({
        ...start.bounds,
        width: Math.max(5, Math.min(100 - start.bounds.x, start.bounds.width + dx)),
        height: Math.max(5, Math.min(100 - start.bounds.y, start.bounds.height + dy)),
      });
    }
  }

  function endGesture(event: React.PointerEvent<HTMLElement>) {
    const start = gesture.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const next = previewBounds ?? start.bounds;
    gesture.current = null;
    setPreviewBounds(null);
    if (next.x !== element.x || next.y !== element.y || next.width !== element.width || next.height !== element.height) onChange(next);
  }

  return (
    <div
      className={`slide-media-object ${selected ? "is-selected" : ""} ${element.type === "icon" ? "is-icon" : ""}`}
      data-media-element={element.id}
      style={{ left: `${bounds.x}%`, top: `${bounds.y}%`, width: `${bounds.width}%`, height: `${bounds.height}%` }}
      onPointerDown={(event) => beginGesture(event, "move")}
      onPointerMove={updateGesture}
      onPointerUp={endGesture}
      onPointerCancel={() => { gesture.current = null; setPreviewBounds(null); }}
      onClick={(event) => { event.stopPropagation(); onSelect(); }}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(); } }}
      role="button"
      tabIndex={0}
      aria-label={`Select ${element.type} element`}
    >
      <SlideMediaVisual element={element} />
      {selected && <button className="media-resize-handle" type="button" aria-label="Resize media element" title="Drag to resize" onPointerDown={(event) => beginGesture(event, "resize")} onPointerMove={updateGesture} onPointerUp={endGesture} onPointerCancel={() => { gesture.current = null; setPreviewBounds(null); }} />}
    </div>
  );
}

function SlideCanvas({ slide, index, total, theme, selectedText, selectedMediaId, onSelectText, onSelectMedia, onMediaChange, onTextChange, onTextColorChange, onTextPositionChange, onTextSizeChange }: {
  slide: StudioSlide;
  index: number;
  total: number;
  theme: StudioPresentation["theme"];
  selectedText: string | null;
  selectedMediaId: string | null;
  onSelectText: (id: string) => void;
  onSelectMedia: (id: string) => void;
  onMediaChange: (id: string, bounds: MediaBounds) => void;
  onTextChange: (change: Partial<StudioSlide>) => void;
  onTextColorChange: (textId: string, color: string) => void;
  onTextPositionChange: (id: string, position: TextPosition) => void;
  onTextSizeChange: (id: string, size: number) => void;
}) {
  const colors = slide.content.textColors ?? {};
  const textColor = (id: string, key: TextColorKey, fallback: string) => slide.content.textStyleColors?.[id] ?? colors[key] ?? fallback;
  const editable = (label: string, value: string, commit: (value: string) => void, multiline = false) => ({
    contentEditable: true,
    suppressContentEditableWarning: true,
    role: "textbox" as const,
    "aria-label": `Edit ${label} directly on the slide`,
    "aria-multiline": multiline,
    spellCheck: true,
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      const nextValue = event.currentTarget.innerText;
      if (nextValue !== value) commit(nextValue);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === "Enter" && !multiline) {
        event.preventDefault();
        event.currentTarget.blur();
      }
    },
  });
  const section = (id: string, label: string, colorKey: TextColorKey, color: string, children: React.ReactNode) => (
    <SlideTextSection
      id={id}
      label={label}
      color={textColor(id, colorKey, color)}
      position={slide.content.textPositions?.[id]}
      size={slide.content.textSizes?.[id] ?? 100}
      selected={selectedText === id}
      onSelect={onSelectText}
      onColorChange={(nextColor) => onTextColorChange(id, nextColor)}
      onPositionChange={(position) => onTextPositionChange(id, position)}
      onSizeChange={(size) => onTextSizeChange(id, size)}
      key={id}
    >{children}</SlideTextSection>
  );
  return (
    <SlideArtwork slide={slide} index={index} total={total} theme={theme} renderMedia={(element) => <SlideMediaObject element={element} selected={selectedMediaId === element.id} onSelect={() => onSelectMedia(element.id)} onChange={(bounds) => onMediaChange(element.id, bounds)} />}>
        {slide.content.eyebrow && section("eyebrow", "eyebrow", "eyebrow", theme.accent, <span className="eyebrow inline-editable" style={{ color: textColor("eyebrow", "eyebrow", theme.accent) }} {...editable("eyebrow", slide.content.eyebrow, (eyebrow) => onTextChange({ content: { eyebrow } }))}>{slide.content.eyebrow}</span>)}
        {section("title", "title", "title", "#30372c", <h1 className="inline-editable" style={{ fontFamily: theme.font, color: textColor("title", "title", "#30372c") }} {...editable("title", slide.title, (title) => { if (title.trim()) onTextChange({ title }); })}>{slide.title}</h1>)}
        {(slide.subtitle || selectedText === "subtitle") && section("subtitle", "subtitle", "subtitle", "#818c79", <h2 className="inline-editable" style={{ color: textColor("subtitle", "subtitle", "#818c79") }} {...editable("subtitle", slide.subtitle ?? "", (subtitle) => onTextChange({ subtitle }))}>{slide.subtitle}</h2>)}
        {(slide.content.body || selectedText === "body") && section("body", "body text", "body", "#697265", <p className="inline-editable" style={{ color: textColor("body", "body", "#697265") }} {...editable("body", slide.content.body ?? "", (body) => onTextChange({ content: { body } }), true)}>{slide.content.body}</p>)}
        {!!slide.content.bullets?.length || selectedText === "bullet-0" ? <ul>{(slide.content.bullets?.length ? slide.content.bullets : [""]).map((bullet, itemIndex) => {
          const id = `bullet-${itemIndex}`;
          return <li key={id}>{section(id, `bullet ${itemIndex + 1}`, "bullets", "#4e594b", <span className="inline-editable" style={{ color: textColor(id, "bullets", "#4e594b") }} {...editable(`bullet ${itemIndex + 1}`, bullet, (value) => {
          const bullets = [...(slide.content.bullets ?? [])];
          bullets[itemIndex] = value;
          onTextChange({ content: { bullets } });
        }, true)}>{bullet}</span>)}</li>;
        })}</ul> : null}
        {!!slide.content.stats?.length && <div className="stats-row">{slide.content.stats.map((stat, statIndex) => <div className="stat-box" key={statIndex}>
          {section(`stat-${statIndex}-value`, `statistic ${statIndex + 1} value`, "stats", "#627a4d", <strong className="inline-editable" style={{ color: textColor(`stat-${statIndex}-value`, "stats", "#627a4d") }} {...editable(`statistic ${statIndex + 1} value`, stat.value, (value) => {
            const stats = [...(slide.content.stats ?? [])];
            stats[statIndex] = { ...stats[statIndex], value };
            onTextChange({ content: { stats } });
          })}>{stat.value}</strong>)}
          {section(`stat-${statIndex}-label`, `statistic ${statIndex + 1} label`, "stats", "#7a8474", <span className="inline-editable" style={{ color: textColor(`stat-${statIndex}-label`, "stats", "#7a8474") }} {...editable(`statistic ${statIndex + 1} label`, stat.label, (label) => {
            const stats = [...(slide.content.stats ?? [])];
            stats[statIndex] = { ...stats[statIndex], label };
            onTextChange({ content: { stats } });
          })}>{stat.label}</span>)}
        </div>)}</div>}
    </SlideArtwork>
  );
}

function parseStats(value: string) {
  return value.split("\n").slice(0, 6).flatMap((line) => {
    const separator = line.indexOf("|");
    if (separator < 1) return [];
    const statValue = line.slice(0, separator).trim();
    const label = line.slice(separator + 1).trim();
    return statValue && label ? [{ value: statValue, label }] : [];
  });
}

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [presentation, setPresentation] = useState<StudioPresentation | null>(null);
  const [selected, setSelected] = useState(0);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [deviceOnlySave, setDeviceOnlySave] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [sharePassword, setSharePassword] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [shareVisibility, setShareVisibility] = useState<"PUBLIC" | "UNLISTED">("UNLISTED");
  const [targetLanguage, setTargetLanguage] = useState<PresentationLanguage>("en");
  const [translationConfirmed, setTranslationConfirmed] = useState(false);
  const [translating, setTranslating] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const saveRevision = useRef(0);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const draggedIndex = useRef<number | null>(null);
  const sidebarSelectionRef = useRef(false);
  const selectedTextInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const slide = presentation?.slides[selected];
  const selectedMedia = slide?.content.mediaElements?.find((element) => element.id === selectedMediaId);

  useEffect(() => {
    let local: StudioPresentation | undefined;
    void Promise.resolve().then(() => {
      local = readLocalPresentations().find((item) => item.id === id);
      if (local) setPresentation(local);
      return fetch("/api/presentations");
    }).then(async (response) => {
        if (!response.ok) return;
        const rows = await response.json() as Record<string, unknown>[];
        const merged = preferLocalPresentations(rows.map(mapServerPresentation), readLocalPresentations());
        const match = merged.find((item) => item.id === id);
        if (match) {
          setPresentation(match);
          writeLocalPresentations(merged);
        const shareResponse = await fetch(`/api/presentations/${id}/share`);
        if (shareResponse.ok) {
          const shareState = await shareResponse.json() as { isShared: boolean; visibility: "PRIVATE" | "PUBLIC" | "UNLISTED" };
          setIsShared(shareState.isShared);
          if (shareState.visibility !== "PRIVATE") setShareVisibility(shareState.visibility);
        }
      }
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [id]);

  const saveToServer = useCallback(async (next: StudioPresentation) => {
    setSaving(true);
    const revision = saveRevision.current;
    const write = saveQueue.current.catch(() => undefined).then(async () => {
      try {
        const response = await fetch(`/api/presentations/${next.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toServerPayload(next)),
        });
        if (revision !== saveRevision.current) return;
        if (response.status === 503) {
          setDeviceOnlySave(true);
          return;
        }
        if (!response.ok) {
          setSaveError(`Saved on this device, but server save failed (${response.status}).`);
          return;
        }
        setDeviceOnlySave(false);
        setSaveError("");
      } catch (cause) {
        if (revision === saveRevision.current) {
          setDeviceOnlySave(true);
          setSaveError(cause instanceof Error ? `Saved on this device; server save failed: ${cause.message}` : "Saved on this device, but server save failed.");
        }
      } finally {
        if (revision === saveRevision.current) setSaving(false);
      }
    });
    saveQueue.current = write;
    await write;
  }, []);

  const persist = useCallback((next: StudioPresentation) => {
    const snapshot = { ...next, updatedAt: new Date().toISOString() };
    setPresentation(snapshot);
    saveRevision.current += 1;
    setSaving(true);
    setSaveError("");
    try {
      const local = readLocalPresentations();
      writeLocalPresentations(local.some((item) => item.id === snapshot.id)
        ? local.map((item) => item.id === snapshot.id ? snapshot : item)
        : [snapshot, ...local]);
      setDeviceOnlySave(true);
    } catch {
      setSaveError("Could not save changes in this browser. Free up browser storage and try again.");
    }
    if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void saveToServer(snapshot);
    }, 700);
  }, [saveToServer]);

  function saveNow() {
    if (!presentation) return;
    saveRevision.current += 1;
    if (saveTimer.current !== undefined) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = undefined;
    }
    try {
      const local = readLocalPresentations();
      writeLocalPresentations(local.some((item) => item.id === presentation.id)
        ? local.map((item) => item.id === presentation.id ? presentation : item)
        : [presentation, ...local]);
    } catch {
      setSaveError("Could not save changes in this browser. Free up browser storage and try again.");
      return;
    }
    void saveToServer(presentation);
  }

  useEffect(() => () => {
    if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current);
  }, []);

  useEffect(() => {
    if (!sidebarSelectionRef.current || !selectedText) return;
    sidebarSelectionRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      const container = document.querySelector(".canvas-area");
      const element = Array.from(container?.querySelectorAll<HTMLElement>("[data-text-section]") ?? [])
        .find((item) => item.dataset.textSection === selectedText);
      element?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      selectedTextInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedText]);

  function changeSlide(changes: Partial<StudioSlide>) {
    if (!presentation || !slide) return;
    const slides = presentation.slides.map((item, index) => index === selected ? { ...item, ...changes, content: changes.content ? { ...item.content, ...changes.content } : item.content } : item);
    persist({ ...presentation, slides, updatedAt: new Date().toISOString() });
  }

  function uploadSlideBackground(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      setImageUploadError("Choose a PNG, JPEG, WebP, or GIF image.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setImageUploadError("The image must be 4 MB or smaller.");
      return;
    }

    setImageUploadError("");
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setImageUploadError("The selected image could not be read.");
        return;
      }
      changeSlide({ content: { backgroundImage: reader.result } });
    };
    reader.onerror = () => setImageUploadError("The selected image could not be read.");
    reader.readAsDataURL(file);
  }

  function addMediaElement(element: SlideMediaElement) {
    if (!slide) return;
    changeSlide({ content: { mediaElements: [...(slide.content.mediaElements ?? []), element] } });
    setSelectedText(null);
    setSelectedMediaId(element.id);
  }

  function uploadSlideMedia(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      setImageUploadError("Choose a PNG, JPEG, WebP, or GIF image.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setImageUploadError("The image or GIF must be 4 MB or smaller.");
      return;
    }
    setImageUploadError("");
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setImageUploadError("The selected image could not be read.");
        return;
      }
      addMediaElement({ id: crypto.randomUUID(), type: "image", src: reader.result, x: 35, y: 30, width: 30, height: 35 });
    };
    reader.onerror = () => setImageUploadError("The selected image could not be read.");
    reader.readAsDataURL(file);
  }

  function addVideoElement() {
    if (!slide) return;
    try {
      const url = new URL(videoUrl);
      if (url.protocol !== "https:") throw new Error("Use a secure HTTPS video URL.");
      addMediaElement({ id: crypto.randomUUID(), type: "video", src: url.toString(), x: 30, y: 30, width: 40, height: 40 });
      setVideoUrl("");
      setImageUploadError("");
    } catch (cause) {
      setImageUploadError(cause instanceof Error ? cause.message : "Enter a valid HTTPS video URL.");
    }
  }

  function addIconElement(icon: NonNullable<SlideMediaElement["icon"]>) {
    addMediaElement({ id: crypto.randomUUID(), type: "icon", icon, x: 44, y: 40, width: 12, height: 12 });
  }

  function selectTextElement(textId: string) {
    setSelectedMediaId(null);
    setSelectedText(textId);
  }

  function selectTextFromSidebar(textId: string) {
    sidebarSelectionRef.current = true;
    selectTextElement(textId);
  }

  function selectSlide(index: number) {
    setSelectedText(null);
    setSelectedMediaId(null);
    setSelected(index);
  }

  function changeMediaElement(id: string, changes: Partial<SlideMediaElement>) {
    if (!slide) return;
    const mediaElements = (slide.content.mediaElements ?? []).map((element) => element.id === id ? { ...element, ...changes } : element);
    changeSlide({ content: { mediaElements } });
  }

  function removeMediaElement(id: string) {
    if (!slide) return;
    changeSlide({ content: { mediaElements: (slide.content.mediaElements ?? []).filter((element) => element.id !== id) } });
    setSelectedMediaId(null);
  }

  function changeTextColor(textId: string, color: string) {
    if (!presentation || !slide) return;
    changeSlide({
      content: {
        textStyleColors: {
          ...slide.content.textStyleColors,
          [textId]: color,
        },
      },
    });
  }

  function resetTextColor(textId: string) {
    if (!slide) return;
    const textStyleColors = { ...slide.content.textStyleColors };
    delete textStyleColors[textId];
    changeSlide({ content: { textStyleColors } });
  }

  function changeTextPosition(textId: string, position: TextPosition) {
    if (!slide) return;
    changeSlide({
      content: {
        textPositions: {
          ...slide.content.textPositions,
          [textId]: position,
        },
      },
    });
  }

  function changeTextSize(textId: string, size: number) {
    if (!slide) return;
    changeSlide({
      content: {
        textSizes: {
          ...slide.content.textSizes,
          [textId]: Math.max(25, Math.min(300, size)),
        },
      },
    });
  }

  function resetTextSize(textId: string) {
    if (!slide) return;
    const textSizes = { ...slide.content.textSizes };
    delete textSizes[textId];
    changeSlide({ content: { textSizes } });
  }

  function getSelectedTextValue() {
    if (!slide || !selectedText) return "";
    if (selectedText === "title") return slide.title;
    if (selectedText === "subtitle") return slide.subtitle;
    if (selectedText === "eyebrow") return slide.content.eyebrow ?? "";
    if (selectedText === "body") return slide.content.body ?? "";
    if (selectedText.startsWith("bullet-")) return slide.content.bullets?.[Number(selectedText.slice(7))] ?? "";
    const match = /^stat-(\d+)-(value|label)$/.exec(selectedText);
    if (match) return slide.content.stats?.[Number(match[1])]?.[match[2] as "value" | "label"] ?? "";
    return "";
  }

  function changeSelectedText(value: string) {
    if (!slide || !selectedText) return;
    if (selectedText === "title") {
      if (value.trim()) changeSlide({ title: value });
    } else if (selectedText === "subtitle") {
      changeSlide({ subtitle: value });
    } else if (selectedText === "eyebrow") {
      changeSlide({ content: { eyebrow: value } });
    } else if (selectedText === "body") {
      changeSlide({ content: { body: value } });
    } else if (selectedText.startsWith("bullet-")) {
      const index = Number(selectedText.slice(7));
      const bullets = [...(slide.content.bullets ?? [])];
      if (index >= 0 && index < bullets.length) {
        bullets[index] = value;
        changeSlide({ content: { bullets } });
      }
    } else {
      const match = /^stat-(\d+)-(value|label)$/.exec(selectedText);
      if (match) {
        const index = Number(match[1]);
        const stats = [...(slide.content.stats ?? [])];
        const field = match[2] as "value" | "label";
        if (stats[index]) {
          stats[index] = { ...stats[index], [field]: value };
          changeSlide({ content: { stats } });
        }
      }
    }
  }

  function selectedColorKey(): TextColorKey {
    if (selectedText?.startsWith("bullet-")) return "bullets";
    if (selectedText?.startsWith("stat-")) return "stats";
    return (selectedText ?? "title") as TextColorKey;
  }

  function selectedTextColor() {
    if (!presentation || !slide) return "#30372c";
    const key = selectedColorKey();
    return slide.content.textStyleColors?.[selectedText ?? "title"] ?? slide.content.textColors?.[key] ?? ({
      eyebrow: presentation.theme.accent,
      title: "#30372c",
      subtitle: "#818c79",
      body: "#697265",
      bullets: "#4e594b",
      stats: "#627a4d",
    }[key]);
  }

  const selectedTextLabel = selectedText
    ? selectedText === "title" ? "Title"
      : selectedText === "subtitle" ? "Subtitle"
        : selectedText === "eyebrow" ? "Eyebrow"
          : selectedText === "body" ? "Body text"
            : selectedText.startsWith("bullet-") ? `Bullet ${Number(selectedText.slice(7)) + 1}`
              : /^stat-(\d+)-(value|label)$/.test(selectedText)
                ? `Statistic ${Number(/^stat-(\d+)-/.exec(selectedText)?.[1]) + 1} ${selectedText.endsWith("-value") ? "value" : "label"}`
                : "Text"
    : "";

  const selectedTextMaxLength = selectedText === "title" ? 180
    : selectedText === "eyebrow" ? 80
      : selectedText === "body" ? 2000
        : selectedText?.startsWith("bullet-") ? 240
          : selectedText?.endsWith("-value") ? 32
            : selectedText?.endsWith("-label") ? 100
              : 300;

  function addSlide() {
    if (!presentation) return;
    const newSlide: StudioSlide = { ...createTemplateSlides("Blank canvas", presentation.language)[0], id: crypto.randomUUID(), layout: "content" };
    const slides = [...presentation.slides.slice(0, selected + 1), newSlide, ...presentation.slides.slice(selected + 1)];
    persist({ ...presentation, slides, updatedAt: new Date().toISOString() });
    selectSlide(selected + 1);
  }

  function duplicateSlide() {
    if (!presentation || !slide) return;
    const copy = { ...slide, id: crypto.randomUUID(), title: `${slide.title} (kopie)` };
    const slides = [...presentation.slides.slice(0, selected + 1), copy, ...presentation.slides.slice(selected + 1)];
    persist({ ...presentation, slides, updatedAt: new Date().toISOString() });
    selectSlide(selected + 1);
  }

  function moveSlide(direction: -1 | 1) {
    if (!presentation) return;
    const nextIndex = selected + direction;
    if (nextIndex < 0 || nextIndex >= presentation.slides.length) return;
    const slides = [...presentation.slides];
    [slides[selected], slides[nextIndex]] = [slides[nextIndex], slides[selected]];
    persist({ ...presentation, slides, updatedAt: new Date().toISOString() });
    selectSlide(nextIndex);
  }

  function reorderSlide(destination: number) {
    if (!presentation || draggedIndex.current === null || draggedIndex.current === destination) return;
    const slides = [...presentation.slides];
    const [moved] = slides.splice(draggedIndex.current, 1);
    slides.splice(destination, 0, moved);
    const nextIndex = slides.findIndex((item) => item.id === slide?.id);
    persist({ ...presentation, slides, updatedAt: new Date().toISOString() });
    selectSlide(nextIndex);
    draggedIndex.current = null;
  }

  function deleteSlide() {
    if (!presentation || presentation.slides.length < 2) return;
    const slides = presentation.slides.filter((_, index) => index !== selected);
    persist({ ...presentation, slides, updatedAt: new Date().toISOString() });
    selectSlide(Math.max(0, selected - 1));
  }

  async function sharePresentation() {
    if (!presentation) return;
    if (sharePassword && sharePassword.length < 8) {
      setShareNotice("Use at least 8 characters for a password.");
      return;
    }
    try {
      const response = await fetch(`/api/presentations/${presentation.id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visibility: shareVisibility, ...(sharePassword ? { password: sharePassword } : {}) }) });
      if (!response.ok) {
        setShareNotice(response.status === 503 ? "Sharing requires Clerk and Neon to be configured." : "Could not create a share link. Check that you are signed in.");
        return;
      }
      const result = await response.json() as { url: string };
      await navigator.clipboard.writeText(result.url);
      setIsShared(true);
      setShareNotice("Private notes remain hidden. The link has been copied.");
    } catch {
      setShareNotice("Could not create a share link. Check your connection.");
    }
  }

  async function revokeShare() {
    if (!presentation) return;
    try {
      const response = await fetch(`/api/presentations/${presentation.id}/share`, { method: "DELETE" });
      if (!response.ok) {
        setShareNotice("Could not revoke the share link.");
        return;
      }

      setIsShared(false);
      setSharePassword("");
      setShareNotice("The share link has been revoked.");
    } catch {
      setShareNotice("Could not revoke the share link. Check your connection.");
    }
  }

  async function translateCopy() {
    if (!presentation || !translationConfirmed || targetLanguage === presentation.language) return;
    setTranslating(true);
    setShareNotice("");
    try {
      const response = await fetch(`/api/presentations/${presentation.id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage, confirmed: true }),
      });
      const payload = await response.json() as Record<string, unknown>;
      if (!response.ok) {
        setShareNotice(String(payload.error ?? "The translated copy could not be created."));
        return;
      }

      const translated = mapServerPresentation(payload);
      const saved = [translated, ...readLocalPresentations().filter((item) => item.id !== translated.id)];
      writeLocalPresentations(saved);
      router.push(`/editor/${translated.id}`);
    } catch {
      setShareNotice("The translated copy could not be created. Check your connection and try again.");
    } finally {
      setTranslating(false);
    }
  }

  function markTranslationReviewed() {
    if (!presentation?.translationNeedsReview) return;
    persist({ ...presentation, translationNeedsReview: false, updatedAt: new Date().toISOString() });
  }

  if (!presentation || !slide) {
    return <div className="editor-shell"><div className="loading-editor"><LoaderCircle size={20} />{loaded ? "Presentation not found" : "Loading presentation…"}</div><Link href="/" className="back-link"><ArrowLeft size={15} /> Back to library</Link></div>;
  }

  return (
    <div className="editor-shell">
      <header className="editor-topbar">
        <div className="editor-top-left"><Link className="back-link" href="/"><ArrowLeft size={15} /><span>Library</span></Link><span className="crumb-slash">/</span><input className="editor-title" aria-label="Presentation title" value={presentation.title} onChange={(event) => persist({ ...presentation, title: event.target.value, updatedAt: new Date().toISOString() })} /><ChevronDown size={13} color="#98a096" /></div>
        <div className="editor-top-right"><span className={`saving-state ${saving ? "is-saving" : ""}`} title={deviceOnlySave && !saving ? "Changes are saved in this browser only" : undefined}><span className="saving-indicator-mark" aria-hidden="true" /><span>{saving ? "Saving…" : deviceOnlySave ? "Saved on this device" : "Saved"}</span></span><button className="button button-primary editor-save-button" type="button" onClick={saveNow} aria-label="Save presentation"><Save size={14} /> Save</button><Link className="button button-secondary" href={`/present/${presentation.id}`}><Eye size={14} /> Preview</Link><Link className="button button-secondary" href={`/present/${presentation.id}?print=1`}>PDF / print</Link><button className="button button-primary" onClick={sharePresentation}>Share</button><ThemeToggle /></div>
      </header>
      {saveError && <div className="notice editor-notice">{saveError}<button onClick={() => setSaveError("")} aria-label="Melding sluiten">×</button></div>}
      {shareNotice && <div className="notice editor-notice">{shareNotice}<button onClick={() => setShareNotice("")} aria-label="Melding sluiten">×</button></div>}
      <div className="editor-body">
        <aside className="slide-sidebar">
          <div className="slide-sidebar-heading"><span>SLIDES <span className="muted-count">{presentation.slides.length}</span></span><button aria-label="Add slide" onClick={addSlide}><Plus size={15} /></button></div>
          {presentation.slides.map((item, index) => <button className={`slide-thumb ${index === selected ? "active" : ""}`} key={item.id} draggable onDragStart={() => { draggedIndex.current = index; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); reorderSlide(index); }} onDragEnd={() => { draggedIndex.current = null; }} onClick={() => selectSlide(index)} aria-label={`Select slide ${index + 1}: ${item.title}`}><span className="thumb-number">{String(index + 1).padStart(2, "0")}</span><SlideArtwork slide={item} index={index} total={presentation.slides.length} theme={presentation.theme} className="slide-thumb-artwork" showNumber={false} renderMedia={(element) => <span className={`slide-thumb-media slide-thumb-media-${element.type}`}><SlideMediaVisual element={element} controls={false} /></span>}><SlideArtworkCopy slide={item} theme={presentation.theme} /></SlideArtwork><span className="thumb-title">{item.title}</span></button>)}
          <div className="add-slide-row"><button onClick={addSlide}>+ Add slide</button></div>
        </aside>
        <section className="canvas-area">
          <div className="canvas-toolbar"><span>SLIDE {String(selected + 1).padStart(2, "0")} <span className="crumb-slash">/</span> {presentation.slides.length}</span><div className="canvas-toolbar-actions"><button aria-label="Move slide up" onClick={() => moveSlide(-1)}><ArrowUp size={14} /></button><button aria-label="Move slide down" onClick={() => moveSlide(1)}><ArrowDown size={14} /></button><button aria-label="Duplicate slide" onClick={duplicateSlide}><Copy size={14} /></button><button aria-label="Delete slide" onClick={deleteSlide}><Trash2 size={14} /></button></div></div>
          <SlideCanvas key={slide.id} slide={slide} index={selected} total={presentation.slides.length} theme={presentation.theme} selectedText={selectedText} selectedMediaId={selectedMediaId} onSelectText={selectTextElement} onSelectMedia={(mediaId) => { setSelectedText(null); setSelectedMediaId(mediaId); }} onMediaChange={changeMediaElement} onTextChange={changeSlide} onTextColorChange={changeTextColor} onTextPositionChange={changeTextPosition} onTextSizeChange={changeTextSize} />
          <div className="canvas-nav"><button disabled={selected === 0} onClick={() => selectSlide(Math.max(0, selected - 1))}><ArrowLeft size={13} /> Previous</button><span>Click text to select and edit it · Drag its move handle to reposition</span><button disabled={selected >= presentation.slides.length - 1} onClick={() => selectSlide(Math.min(presentation.slides.length - 1, selected + 1))}>Next <ArrowRight size={13} /></button></div>
        </section>
        <aside className="properties-panel">
          {selectedText ? <>
          <div className="selected-text-panel-heading"><div><h3>Edit {selectedTextLabel}</h3><p>Changes apply only to this text.</p></div><button className="text-panel-close" type="button" aria-label="Back to slide settings" onClick={() => setSelectedText(null)}>×</button></div>
          <label className="field"><span>{selectedTextLabel}</span>{selectedText === "body" || selectedText.startsWith("bullet-") ? <textarea ref={(element) => { selectedTextInputRef.current = element; }} className="large-textarea" value={getSelectedTextValue()} maxLength={selectedTextMaxLength} onChange={(event) => changeSelectedText(event.target.value)} /> : <input ref={(element) => { selectedTextInputRef.current = element; }} value={getSelectedTextValue()} maxLength={selectedTextMaxLength} onChange={(event) => changeSelectedText(event.target.value)} />}</label>
          <label className="field"><span>Text color</span><input type="color" aria-label={`${selectedTextLabel} text color`} value={selectedTextColor()} onChange={(event) => changeTextColor(selectedText, event.target.value)} /></label>
          <button className="button button-secondary reset-text-color" type="button" onClick={() => resetTextColor(selectedText)}>Reset text color</button>
          <div className="text-size-panel">
            <div className="text-size-panel-heading"><span>Text size</span><output>{slide.content.textSizes?.[selectedText] ?? 100}%</output></div>
            <div className="text-size-panel-controls">
              <button type="button" aria-label={`Decrease ${selectedTextLabel} text size`} disabled={(slide.content.textSizes?.[selectedText] ?? 100) <= 25} onClick={() => changeTextSize(selectedText, (slide.content.textSizes?.[selectedText] ?? 100) - 10)}><Minus size={13} /></button>
              <input type="range" aria-label={`${selectedTextLabel} text size`} min="25" max="300" step="5" value={slide.content.textSizes?.[selectedText] ?? 100} onChange={(event) => changeTextSize(selectedText, Number(event.target.value))} />
              <button type="button" aria-label={`Increase ${selectedTextLabel} text size`} disabled={(slide.content.textSizes?.[selectedText] ?? 100) >= 300} onClick={() => changeTextSize(selectedText, (slide.content.textSizes?.[selectedText] ?? 100) + 10)}><Plus size={13} /></button>
            </div>
            <button className="button button-secondary reset-text-color" type="button" onClick={() => resetTextSize(selectedText)}>Reset text size</button>
          </div>
          <h3>Position</h3><p>Drag the move handle on the slide or fine-tune its position.</p>
          <label className="field"><span>Horizontal position</span><input type="range" min="-100" max="100" step="1" value={slide.content.textPositions?.[selectedText]?.x ?? 0} onChange={(event) => changeTextPosition(selectedText, { x: Number(event.target.value), y: slide.content.textPositions?.[selectedText]?.y ?? 0 })} /></label>
          <label className="field"><span>Vertical position</span><input type="range" min="-100" max="100" step="1" value={slide.content.textPositions?.[selectedText]?.y ?? 0} onChange={(event) => changeTextPosition(selectedText, { x: slide.content.textPositions?.[selectedText]?.x ?? 0, y: Number(event.target.value) })} /></label>
          <button className="button button-secondary reset-text-position" type="button" onClick={() => {
            const textPositions = { ...slide.content.textPositions };
            delete textPositions[selectedText];
            changeSlide({ content: { textPositions } });
          }}><RotateCcw size={12} /> Reset position</button>
          <div className="panel-divider" />
          <button className="button button-secondary" type="button" onClick={() => setSelectedText(null)}>Back to slide settings</button>
          </> : selectedMedia ? <>
          <div className="selected-text-panel-heading"><div><h3>Edit {selectedMedia.type}</h3><p>Drag to move; use the corner handle to resize.</p></div><button className="text-panel-close" type="button" aria-label="Back to slide settings" onClick={() => setSelectedMediaId(null)}>×</button></div>
          {selectedMedia.type === "icon" && <div className="media-icon-picker" role="group" aria-label="Choose icon">
            {slideMediaIconChoices.map(({ name, label, Icon }) => <button type="button" key={name} className={selectedMedia.icon === name ? "active" : ""} aria-label={`Set icon to ${label}`} onClick={() => changeMediaElement(selectedMedia.id, { icon: name })}><Icon size={17} /></button>)}
          </div>}
          {selectedMedia.type === "video" && <label className="field"><span>Video URL</span><input value={selectedMedia.src ?? ""} onChange={(event) => changeMediaElement(selectedMedia.id, { src: event.target.value })} /></label>}
          <h3>Position and size</h3>
          <label className="field"><span>Width</span><input type="range" min="5" max={100 - selectedMedia.x} step="1" value={selectedMedia.width} onChange={(event) => changeMediaElement(selectedMedia.id, { width: Number(event.target.value) })} /></label>
          <label className="field"><span>Height</span><input type="range" min="5" max={100 - selectedMedia.y} step="1" value={selectedMedia.height} onChange={(event) => changeMediaElement(selectedMedia.id, { height: Number(event.target.value) })} /></label>
          <button className="button button-secondary reset-text-color" type="button" onClick={() => removeMediaElement(selectedMedia.id)}><Trash2 size={12} /> Remove element</button>
          <button className="button button-secondary" type="button" onClick={() => setSelectedMediaId(null)}>Back to slide settings</button>
          </> : <>
          <h3>Edit slide</h3><p>Update the content on this slide.</p>
          <label className="field"><span>Title</span><input value={slide.title} maxLength={180} onFocus={() => selectTextFromSidebar("title")} onChange={(event) => changeSlide({ title: event.target.value })} /></label>
          <label className="field"><span>Subtitle</span><input value={slide.subtitle} maxLength={300} onFocus={() => selectTextFromSidebar("subtitle")} onChange={(event) => changeSlide({ subtitle: event.target.value })} /></label>
          <label className="field"><span>Layout</span><select value={slide.layout} onChange={(event) => changeSlide({ layout: event.target.value as StudioSlide["layout"] })}><option value="cover">Cover</option><option value="content">Content</option><option value="split">Text and image</option><option value="stats">Statistics</option><option value="quote">Highlight</option><option value="cta">Call to action</option></select></label>
          <label className="field"><span>Eyebrow</span><input value={slide.content.eyebrow ?? ""} maxLength={80} onFocus={() => selectTextFromSidebar("eyebrow")} onChange={(event) => changeSlide({ content: { eyebrow: event.target.value } })} /></label>
          <label className="field"><span>Body</span><textarea className="large-textarea" value={slide.content.body ?? ""} maxLength={2000} onFocus={() => selectTextFromSidebar("body")} onChange={(event) => changeSlide({ content: { body: event.target.value } })} /></label>
          <label className="field"><span>Bullets — one per line</span><textarea value={(slide.content.bullets ?? []).join("\n")} onFocus={() => selectTextFromSidebar("bullet-0")} onChange={(event) => changeSlide({ content: { bullets: event.target.value.split("\n").slice(0, 12) } })} /></label>
          {slide.content.stats && <label className="field"><span>Statistics — value | label</span><textarea value={slide.content.stats.map((stat) => `${stat.value} | ${stat.label}`).join("\n")} onFocus={() => selectTextFromSidebar("stat-0-value")} onChange={(event) => changeSlide({ content: { stats: parseStats(event.target.value) } })} /><span className="field-hint">Use one item per line, for example “Free | provider plans during launch”.</span></label>}
          <label className="field"><span>Slide background image</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Upload slide background image" onChange={uploadSlideBackground} /><span className="field-hint"><ImagePlus size={11} /> Upload PNG, JPEG, WebP, or GIF up to 4 MB. Choose another file to replace it.</span></label>
          {imageUploadError && <p className="narration-error" role="alert">{imageUploadError}</p>}
          {slide.content.backgroundImage && <button className="button button-secondary reset-text-color" type="button" onClick={() => { changeSlide({ content: { backgroundImage: "" } }); setImageUploadError(""); }}>Remove background image</button>}
          <label className="field"><span>Image URL</span><input value={slide.content.image ?? ""} placeholder="https://…" onChange={(event) => changeSlide({ content: { image: event.target.value } })} /><span className="field-hint"><ImagePlus size={11} /> Use a public image URL as a slide image.</span></label>
          <div className="panel-divider" />
          <h3>Add elements</h3><p>Add movable, resizable media to this slide.</p>
          <label className="field"><span>Upload image or GIF</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Add image or GIF to slide" onChange={uploadSlideMedia} /><span className="field-hint">PNG, JPEG, WebP, or animated GIF · up to 4 MB.</span></label>
          <label className="field"><span>Video URL</span><input value={videoUrl} placeholder="https://…" onChange={(event) => setVideoUrl(event.target.value)} /><span className="field-hint">Use a direct HTTPS link to a video file.</span></label>
          <button className="button button-secondary" type="button" disabled={!videoUrl.trim()} onClick={addVideoElement}>Add video</button>
          <div className="media-icon-picker" role="group" aria-label="Add icon to slide">
            {slideMediaIconChoices.map(({ name, label, Icon }) => <button type="button" key={name} aria-label={`Add ${label} icon`} title={`Add ${label}`} onClick={() => addIconElement(name)}><Icon size={17} /></button>)}
          </div>
          {!!slide.content.mediaElements?.length && <div className="media-element-list" aria-label="Slide elements">{slide.content.mediaElements.map((element, elementIndex) => <button type="button" key={element.id} onClick={() => { setSelectedText(null); setSelectedMediaId(element.id); }}>{element.type === "icon" ? `${elementIndex + 1}. ${element.icon} icon` : `${elementIndex + 1}. ${element.type}`}</button>)}</div>}
          <h3>Narration text</h3><p>This is spoken aloud; it does not change the visible slide.</p>
          <label className="field"><span>Custom narration</span><textarea className="large-textarea" value={slide.narrationText ?? ""} placeholder="Leave blank to narrate the subtitle and visible content." maxLength={5000} onChange={(event) => changeSlide({ narrationText: event.target.value })} /></label>
          <label className="field"><span>Presentation language</span><select value={presentation.language} onChange={(event) => persist({ ...presentation, language: event.target.value as PresentationLanguage, narrationSettings: { ...presentation.narrationSettings, voiceURI: undefined } })}><option value="en">English</option><option value="nl">Dutch</option><option value="es">Spanish</option><option value="ro">Romanian</option></select></label>
          <label className="field"><span>Narration speed</span><select value={presentation.narrationSettings.rate} onChange={(event) => persist({ ...presentation, narrationSettings: { ...presentation.narrationSettings, rate: Number(event.target.value) } })}><option value="0.8">Slow</option><option value="1">Normal</option><option value="1.2">Fast</option></select></label>
          {presentation.translationNeedsReview && <div className="notice" role="status"><span>This translated copy needs review before you present it.</span><button onClick={markTranslationReviewed}>Mark reviewed</button></div>}
          <div className="panel-divider" />
          <h3>Translate a copy</h3><p>Create a separate draft. The original presentation will not be changed.</p>
          <label className="field"><span>Target language</span><select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value as PresentationLanguage)}><option value="en" disabled={presentation.language === "en"}>English</option><option value="nl" disabled={presentation.language === "nl"}>Dutch</option><option value="es" disabled={presentation.language === "es"}>Spanish</option><option value="ro" disabled={presentation.language === "ro"}>Romanian</option></select></label>
          <label className="field"><span><input type="checkbox" checked={translationConfirmed} onChange={(event) => setTranslationConfirmed(event.target.checked)} /> I confirm this translation will need human review.</span></label>
          <button className="button button-secondary" disabled={!translationConfirmed || targetLanguage === presentation.language || translating} onClick={translateCopy}>{translating ? "Translating…" : "Create translated copy"}</button>
          <div className="panel-divider" />
          <h3>Presentation style</h3><p>Customize colors and heading font.</p>
          <label className="field"><span>Accent color</span><input type="color" value={presentation.theme.accent} onChange={(event) => persist({ ...presentation, theme: { ...presentation.theme, accent: event.target.value } })} /></label>
          <label className="field"><span>Background color</span><input type="color" value={presentation.theme.background} onChange={(event) => persist({ ...presentation, theme: { ...presentation.theme, background: event.target.value } })} /></label>
          <label className="field"><span>Heading font</span><select value={presentation.theme.font} onChange={(event) => persist({ ...presentation, theme: { ...presentation.theme, font: event.target.value } })}><option value="Georgia, serif">Georgia</option><option value="Arial, sans-serif">Arial</option><option value="Trebuchet MS, sans-serif">Trebuchet</option></select></label>
          <div className="panel-divider" />
          <label className="field"><span>Private speaker notes</span><textarea className="notes-area" value={slide.notes} placeholder="What would you like to say about this slide?" onChange={(event) => changeSlide({ notes: event.target.value })} /><span className="field-hint">Only visible in the editor; never included in shared presentation links.</span></label>
          <div className="panel-divider" />
          <h3>Share link</h3><p>Create a secure, read-only link to this presentation.</p>
          <label className="field"><span>Access</span><select value={shareVisibility} onChange={(event) => setShareVisibility(event.target.value as "PUBLIC" | "UNLISTED")}><option value="UNLISTED">Unlisted — link access only</option><option value="PUBLIC">Public — accessible to everyone</option></select></label>
          <label className="field"><span>Password (optional)</span><input type="password" autoComplete="new-password" minLength={8} value={sharePassword} placeholder="At least 8 characters" onChange={(event) => setSharePassword(event.target.value)} /><span className="field-hint">An existing password is retained. Revoke the link to remove it.</span></label>
          <div className="editor-actions"><button className="button button-primary" onClick={sharePresentation}>Copy share link</button>{isShared && <button className="button button-secondary" onClick={revokeShare}>Revoke</button>}</div>
          <div className="panel-divider" />
          <div className="editor-actions"><button className="button button-secondary" onClick={deleteSlide}><Trash2 size={13} /> Delete</button><button className="button button-primary" onClick={addSlide}><Plus size={13} /> Slide</button></div>
          {shareNotice && <p className="field-hint share-hint">{shareNotice}</p>}
          </>}
        </aside>
      </div>
    </div>
  );
}
