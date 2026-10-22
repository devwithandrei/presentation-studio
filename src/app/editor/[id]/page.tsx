"use client";

import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, Copy, Eye, ImagePlus,
  LoaderCircle, Plus, Trash2,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createTemplateSlides, type PresentationLanguage, type StudioPresentation, type StudioSlide } from "@/lib/demo-data";
import { mapServerPresentation, readLocalPresentations, toServerPayload, writeLocalPresentations } from "@/lib/client-store";
import { ThemeToggle } from "@/components/theme-toggle";

function SlideCanvas({ slide, index, total, theme, onTextChange }: {
  slide: StudioSlide;
  index: number;
  total: number;
  theme: StudioPresentation["theme"];
  onTextChange: (change: Partial<StudioSlide>) => void;
}) {
  const className = `slide-canvas ${slide.layout}`;
  const image = slide.content.image;
  const colors = slide.content.textColors ?? {};
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
  return (
    <div className={className} style={{ backgroundColor: theme.background }}>
      {image && <Image src={image} alt="" fill sizes="(max-width: 760px) 100vw, 60vw" priority={index === 0} unoptimized />}
      <div className="slide-canvas-copy">
        {slide.content.eyebrow && <span className="eyebrow inline-editable" style={{ color: colors.eyebrow ?? theme.accent }} {...editable("eyebrow", slide.content.eyebrow, (eyebrow) => onTextChange({ content: { eyebrow } }))}>{slide.content.eyebrow}</span>}
        <h1 className="inline-editable" style={{ fontFamily: theme.font, color: colors.title ?? "#30372c" }} {...editable("title", slide.title, (title) => { if (title.trim()) onTextChange({ title }); })}>{slide.title}</h1>
        {slide.subtitle && <h2 className="inline-editable" style={{ color: colors.subtitle ?? "#818c79" }} {...editable("subtitle", slide.subtitle, (subtitle) => onTextChange({ subtitle }))}>{slide.subtitle}</h2>}
        {slide.content.body && <p className="inline-editable" style={{ color: colors.body ?? "#697265" }} {...editable("body", slide.content.body, (body) => onTextChange({ content: { body } }), true)}>{slide.content.body}</p>}
        {!!slide.content.bullets?.length && <ul>{slide.content.bullets.map((bullet, itemIndex) => <li className="inline-editable" style={{ color: colors.bullets ?? "#4e594b" }} key={`${itemIndex}-${bullet}`} {...editable(`bullet ${itemIndex + 1}`, bullet, (value) => {
          const bullets = [...(slide.content.bullets ?? [])];
          bullets[itemIndex] = value;
          onTextChange({ content: { bullets } });
        }, true)}>{bullet}</li>)}</ul>}
        {!!slide.content.stats?.length && <div className="stats-row">{slide.content.stats.map((stat, statIndex) => <div className="stat-box" key={statIndex}>
          <strong className="inline-editable" style={{ color: colors.stats ?? "#627a4d" }} {...editable(`statistic ${statIndex + 1} value`, stat.value, (value) => {
            const stats = [...(slide.content.stats ?? [])];
            stats[statIndex] = { ...stats[statIndex], value };
            onTextChange({ content: { stats } });
          })}>{stat.value}</strong>
          <span className="inline-editable" style={{ color: colors.stats ?? "#7a8474" }} {...editable(`statistic ${statIndex + 1} label`, stat.label, (label) => {
            const stats = [...(slide.content.stats ?? [])];
            stats[statIndex] = { ...stats[statIndex], label };
            onTextChange({ content: { stats } });
          })}>{stat.label}</span>
        </div>)}</div>}
      </div>
      <span className="slide-canvas-number">{String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
    </div>
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [sharePassword, setSharePassword] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [shareVisibility, setShareVisibility] = useState<"PUBLIC" | "UNLISTED">("UNLISTED");
  const [targetLanguage, setTargetLanguage] = useState<PresentationLanguage>("nl");
  const [translationConfirmed, setTranslationConfirmed] = useState(false);
  const [translating, setTranslating] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const draggedIndex = useRef<number | null>(null);
  const slide = presentation?.slides[selected];

  useEffect(() => {
    void Promise.resolve().then(() => {
      const local = readLocalPresentations().find((item) => item.id === id);
      if (local) setPresentation(local);
      return fetch("/api/presentations");
    }).then(async (response) => {
        if (!response.ok) return;
        const rows = await response.json() as Record<string, unknown>[];
        const match = rows.map(mapServerPresentation).find((item) => item.id === id);
        if (match) {
          setPresentation(match);
          writeLocalPresentations([...rows.map(mapServerPresentation).filter((item) => item.id !== id), match]);
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

  const persist = useCallback((next: StudioPresentation) => {
    setPresentation(next);
    writeLocalPresentations(readLocalPresentations().map((item) => item.id === next.id ? next : item));
    setSaving(true);
    setSaveError("");
    if (saveTimer.current !== undefined) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      fetch(`/api/presentations/${next.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toServerPayload(next)),
      }).then((response) => {
        if (!response.ok && response.status !== 503) setSaveError("Could not save to the server.");
      }).catch(() => setSaveError("Server niet bereikbaar. Je browserversie is wel bijgewerkt."))
        .finally(() => setSaving(false));
    }, 700);
  }, []);

  function changeSlide(changes: Partial<StudioSlide>) {
    if (!presentation || !slide) return;
    const slides = presentation.slides.map((item, index) => index === selected ? { ...item, ...changes, content: changes.content ? { ...item.content, ...changes.content } : item.content } : item);
    persist({ ...presentation, slides, updatedAt: new Date().toISOString() });
  }

  function changeTextColor(key: "eyebrow" | "title" | "subtitle" | "body" | "bullets" | "stats", color: string) {
    if (!presentation || !slide) return;
    changeSlide({
      content: {
        textColors: {
          ...slide.content.textColors,
          [key]: color,
        },
      },
    });
  }

  function addSlide() {
    if (!presentation) return;
    const newSlide: StudioSlide = { ...createTemplateSlides("Blank canvas", presentation.language)[0], id: crypto.randomUUID(), layout: "content" };
    const slides = [...presentation.slides.slice(0, selected + 1), newSlide, ...presentation.slides.slice(selected + 1)];
    persist({ ...presentation, slides, updatedAt: new Date().toISOString() });
    setSelected(selected + 1);
  }

  function duplicateSlide() {
    if (!presentation || !slide) return;
    const copy = { ...slide, id: crypto.randomUUID(), title: `${slide.title} (kopie)` };
    const slides = [...presentation.slides.slice(0, selected + 1), copy, ...presentation.slides.slice(selected + 1)];
    persist({ ...presentation, slides, updatedAt: new Date().toISOString() });
    setSelected(selected + 1);
  }

  function moveSlide(direction: -1 | 1) {
    if (!presentation) return;
    const nextIndex = selected + direction;
    if (nextIndex < 0 || nextIndex >= presentation.slides.length) return;
    const slides = [...presentation.slides];
    [slides[selected], slides[nextIndex]] = [slides[nextIndex], slides[selected]];
    persist({ ...presentation, slides, updatedAt: new Date().toISOString() });
    setSelected(nextIndex);
  }

  function reorderSlide(destination: number) {
    if (!presentation || draggedIndex.current === null || draggedIndex.current === destination) return;
    const slides = [...presentation.slides];
    const [moved] = slides.splice(draggedIndex.current, 1);
    slides.splice(destination, 0, moved);
    const nextIndex = slides.findIndex((item) => item.id === slide?.id);
    persist({ ...presentation, slides, updatedAt: new Date().toISOString() });
    setSelected(nextIndex);
    draggedIndex.current = null;
  }

  function deleteSlide() {
    if (!presentation || presentation.slides.length < 2) return;
    const slides = presentation.slides.filter((_, index) => index !== selected);
    persist({ ...presentation, slides, updatedAt: new Date().toISOString() });
    setSelected(Math.max(0, selected - 1));
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
        <div className="editor-top-right"><span className={`saving-state ${saving ? "is-saving" : ""}`}><span className="saving-indicator-mark" aria-hidden="true" /><span>{saving ? "Saving…" : "Saved"}</span></span><Link className="button button-secondary" href={`/present/${presentation.id}`}><Eye size={14} /> Preview</Link><Link className="button button-secondary" href={`/present/${presentation.id}?print=1`}>PDF / print</Link><button className="button button-primary" onClick={sharePresentation}>Share</button><ThemeToggle /></div>
      </header>
      {saveError && <div className="notice editor-notice">{saveError}<button onClick={() => setSaveError("")} aria-label="Melding sluiten">×</button></div>}
      {shareNotice && <div className="notice editor-notice">{shareNotice}<button onClick={() => setShareNotice("")} aria-label="Melding sluiten">×</button></div>}
      <div className="editor-body">
        <aside className="slide-sidebar">
          <div className="slide-sidebar-heading"><span>SLIDES <span className="muted-count">{presentation.slides.length}</span></span><button aria-label="Add slide" onClick={addSlide}><Plus size={15} /></button></div>
          {presentation.slides.map((item, index) => <button className={`slide-thumb ${index === selected ? "active" : ""}`} key={item.id} draggable onDragStart={() => { draggedIndex.current = index; }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); reorderSlide(index); }} onDragEnd={() => { draggedIndex.current = null; }} onClick={() => setSelected(index)}><span className="thumb-number">{String(index + 1).padStart(2, "0")}</span><span className={`thumb-art ${item.layout}`}><i /><i /><i /></span><span className="thumb-title">{item.title}</span></button>)}
          <div className="add-slide-row"><button onClick={addSlide}>+ Add slide</button></div>
        </aside>
        <section className="canvas-area">
          <div className="canvas-toolbar"><span>SLIDE {String(selected + 1).padStart(2, "0")} <span className="crumb-slash">/</span> {presentation.slides.length}</span><div className="canvas-toolbar-actions"><button aria-label="Move slide up" onClick={() => moveSlide(-1)}><ArrowUp size={14} /></button><button aria-label="Move slide down" onClick={() => moveSlide(1)}><ArrowDown size={14} /></button><button aria-label="Duplicate slide" onClick={duplicateSlide}><Copy size={14} /></button><button aria-label="Delete slide" onClick={deleteSlide}><Trash2 size={14} /></button></div></div>
          <SlideCanvas slide={slide} index={selected} total={presentation.slides.length} theme={presentation.theme} onTextChange={changeSlide} />
          <div className="canvas-nav"><button disabled={selected === 0} onClick={() => setSelected(Math.max(0, selected - 1))}><ArrowLeft size={13} /> Previous</button><span>Click text on the slide to edit it · Drag slides in the sidebar to reorder</span><button disabled={selected >= presentation.slides.length - 1} onClick={() => setSelected(Math.min(presentation.slides.length - 1, selected + 1))}>Next <ArrowRight size={13} /></button></div>
        </section>
        <aside className="properties-panel">
          <h3>Edit slide</h3><p>Update the content on this slide.</p>
          <label className="field"><span>Title</span><input value={slide.title} maxLength={180} onChange={(event) => changeSlide({ title: event.target.value })} /></label>
          <label className="field"><span>Subtitle</span><input value={slide.subtitle} maxLength={300} onChange={(event) => changeSlide({ subtitle: event.target.value })} /></label>
          <label className="field"><span>Layout</span><select value={slide.layout} onChange={(event) => changeSlide({ layout: event.target.value as StudioSlide["layout"] })}><option value="cover">Cover</option><option value="content">Content</option><option value="split">Text and image</option><option value="stats">Statistics</option><option value="quote">Highlight</option><option value="cta">Call to action</option></select></label>
          <label className="field"><span>Eyebrow</span><input value={slide.content.eyebrow ?? ""} maxLength={80} onChange={(event) => changeSlide({ content: { eyebrow: event.target.value } })} /></label>
          <label className="field"><span>Body</span><textarea className="large-textarea" value={slide.content.body ?? ""} maxLength={2000} onChange={(event) => changeSlide({ content: { body: event.target.value } })} /></label>
          <label className="field"><span>Bullets — one per line</span><textarea value={(slide.content.bullets ?? []).join("\n")} onChange={(event) => changeSlide({ content: { bullets: event.target.value.split("\n").slice(0, 12) } })} /></label>
          {slide.content.stats && <label className="field"><span>Statistics — value | label</span><textarea value={slide.content.stats.map((stat) => `${stat.value} | ${stat.label}`).join("\n")} onChange={(event) => changeSlide({ content: { stats: parseStats(event.target.value) } })} /><span className="field-hint">Use one item per line, for example “Free | provider plans during launch”.</span></label>}
          <label className="field"><span>Image URL</span><input value={slide.content.image ?? ""} placeholder="https://…" onChange={(event) => changeSlide({ content: { image: event.target.value } })} /><span className="field-hint"><ImagePlus size={11} /> Use a public image URL.</span></label>
          <div className="panel-divider" />
          <h3>Text colors</h3><p>Choose a text type and set its color. The same color is used for matching text on this slide.</p>
          <div className="text-color-grid">
            {([
              ["title", "Title"],
              ["subtitle", "Subtitle"],
              ["eyebrow", "Eyebrow"],
              ["body", "Body"],
              ["bullets", "Bullets"],
              ["stats", "Statistics"],
            ] as const).map(([key, label]) => (
              <label className="text-color-control" key={key}>
                <span>{label}</span>
                <input
                  type="color"
                  aria-label={`${label} text color`}
                  value={slide.content.textColors?.[key] ?? ({
                    title: "#30372c",
                    subtitle: "#818c79",
                    eyebrow: presentation.theme.accent,
                    body: "#697265",
                    bullets: "#4e594b",
                    stats: "#627a4d",
                  }[key])}
                  onChange={(event) => changeTextColor(key, event.target.value)}
                />
              </label>
            ))}
          </div>
          <div className="panel-divider" />
          <h3>Narration text</h3><p>This is spoken aloud; it does not change the visible slide.</p>
          <label className="field"><span>Custom narration</span><textarea className="large-textarea" value={slide.narrationText ?? ""} placeholder="Leave blank to narrate the subtitle and visible content." maxLength={5000} onChange={(event) => changeSlide({ narrationText: event.target.value })} /></label>
          <label className="field"><span>Presentation language</span><select value={presentation.language} onChange={(event) => persist({ ...presentation, language: event.target.value as PresentationLanguage, narrationSettings: { ...presentation.narrationSettings, voiceURI: undefined } })}><option value="nl">Dutch</option><option value="ro">Romanian</option><option value="es">Spanish</option></select></label>
          <label className="field"><span>Narration speed</span><select value={presentation.narrationSettings.rate} onChange={(event) => persist({ ...presentation, narrationSettings: { ...presentation.narrationSettings, rate: Number(event.target.value) } })}><option value="0.8">Slow</option><option value="1">Normal</option><option value="1.2">Fast</option></select></label>
          {presentation.translationNeedsReview && <div className="notice" role="status"><span>This translated copy needs review before you present it.</span><button onClick={markTranslationReviewed}>Mark reviewed</button></div>}
          <div className="panel-divider" />
          <h3>Translate a copy</h3><p>Create a separate draft. The original presentation will not be changed.</p>
          <label className="field"><span>Target language</span><select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value as PresentationLanguage)}><option value="nl" disabled={presentation.language === "nl"}>Dutch</option><option value="ro" disabled={presentation.language === "ro"}>Romanian</option><option value="es" disabled={presentation.language === "es"}>Spanish</option></select></label>
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
        </aside>
      </div>
    </div>
  );
}
