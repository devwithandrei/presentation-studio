"use client";

import {
  Archive, ArrowRight, Bell, BookOpen, Check, ChevronDown, CircleHelp,
  Clock3, Copy, FilePlus2, FolderOpen, Grid2X2, LayoutTemplate, ListFilter, Rows3,
  MoreHorizontal, Play, Plus, Search, Settings2, Share2, Sparkles, Trash2,
} from "lucide-react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createTemplateSlides, demoPresentations, templateName as localizedTemplateName, templates, type PresentationLanguage, type StudioPresentation } from "@/lib/demo-data";
import { mapServerPresentation, readLocalPresentations, toServerPayload, writeLocalPresentations } from "@/lib/client-store";
import { ThemeToggle } from "@/components/theme-toggle";

const dateFormatter = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" });

function statusLabel(status: StudioPresentation["status"]) {
  return status === "READY" ? "Ready to present" : status === "ARCHIVED" ? "Archived" : "Draft";
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="studio-shell">
      <aside className="sidebar">
        <Link className="brand" href="/"><span className="brand-mark"><LayoutTemplate size={17} /></span><span>studio<span className="brand-dot">.</span></span></Link>
        <div className="workspace-switch"><div className="workspace-icon">V</div><div className="workspace-label"><strong>VandR Studio</strong><small>Personal workspace</small></div><ChevronDown size={15} /></div>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav">
          <Link href="/" className="nav-item active"><Grid2X2 size={17} /> Presentations <span className="nav-count">3</span></Link>
          <a className="nav-item" href="#projects"><FolderOpen size={17} /> Projects</a>
          <a className="nav-item" href="#templates"><LayoutTemplate size={17} /> Templates</a>
        </nav>
        <div className="side-label project-label">PROJECTS <button aria-label="Add project"><Plus size={14} /></button></div>
        <a id="projects" className="project-link"><span className="project-dot green" /> ThuisZoek.nl <span>1</span></a>
        <a className="project-link"><span className="project-dot blue" /> General <span>2</span></a>
        <div className="sidebar-spacer" />
        <div className="sidebar-tip"><div className="tip-icon"><Sparkles size={16} /></div><strong>A great conversation starts with a great story.</strong><p>Prepare your presentation for the next conversation.</p><a href="#templates">Explore templates <ArrowRight size={13} /></a></div>
        <div className="sidebar-bottom">
          <a className="nav-item"><CircleHelp size={17} /> Help center</a>
          <a className="nav-item"><Settings2 size={17} /> Settings</a>
          <div className="user-profile"><div className="avatar">V</div><div><strong>VandR</strong><small>Free workspace</small></div><MoreHorizontal size={17} /></div>
        </div>
      </aside>
      <main className="main-area">{children}</main>
    </div>
  );
}

export default function Dashboard() {
  const [items, setItems] = useState<StudioPresentation[]>(demoPresentations);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [notice, setNotice] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [storageMode, setStorageMode] = useState<"local" | "cloud">("local");
  const [newLanguage, setNewLanguage] = useState<PresentationLanguage>("nl");

  useEffect(() => {
    void Promise.resolve()
      .then(() => {
        setItems(readLocalPresentations());
        return fetch("/api/presentations");
      })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 503) setNotice("Demo mode: changes are saved in this browser only. Configure Clerk and Neon for account storage.");
          else if (response.status === 401) setNotice("Sign in to open your account presentations. The sample library remains available locally.");
          return;
        }
        const rows = await response.json() as Record<string, unknown>[];
        const mapped = rows.map(mapServerPresentation);
        setStorageMode("cloud");
        setItems(mapped);
        writeLocalPresentations(mapped);
      })
      .catch(() => setNotice("Offline demo — changes are saved locally in this browser."))
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback((next: StudioPresentation[]) => {
    setItems(next);
    writeLocalPresentations(next);
  }, []);

  const visibleItems = useMemo(() => items.filter((item) => {
    const matches = `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === "All" || (filter === "Archived" ? item.status === "ARCHIVED" : item.status !== "ARCHIVED");
    return matches && matchesFilter;
  }), [items, query, filter]);
  const latestEdited = useMemo(
    () => [...items].sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt))[0],
    [items],
  );
  const categoryCount = new Set(items.map((item) => item.category)).size;

  function createPresentation(templateKey = "Blank canvas", language = newLanguage) {
    const blank = demoPresentations.find((item) => item.id === "blank")!;
    const source = blank;
    const sourceSlides = createTemplateSlides(templateKey, language);
    const languageCopy = {
      nl: { new: "Nieuwe presentatie", suffix: "nieuw", draft: "Concept", description: "Een leeg canvas voor jouw verhaal." },
      ro: { new: "Prezentare nouă", suffix: "nouă", draft: "Proiect", description: "O pagină goală pentru povestea ta." },
      es: { new: "Nueva presentación", suffix: "nueva", draft: "Borrador", description: "Un lienzo en blanco para tu historia." },
    }[language];
    const localizedName = localizedTemplateName(templateKey, language);
    const created: StudioPresentation = {
      ...source,
      id: crypto.randomUUID(),
      title: templateKey === "Blank canvas" ? languageCopy.new : `${localizedName} — ${languageCopy.suffix}`,
      description: languageCopy.description,
      category: templateKey === "Blank canvas" ? languageCopy.draft : localizedName,
      language,
      translationNeedsReview: false,
      status: "DRAFT",
      updatedAt: new Date().toISOString(),
      slides: sourceSlides.map((slide) => ({ ...slide, id: crypto.randomUUID() })),
    };
    update([created, ...items]);
    if (loaded) {
      fetch("/api/presentations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toServerPayload(created)) })
        .then(async (response) => {
          if (response.ok) {
            const saved = mapServerPresentation(await response.json() as Record<string, unknown>);
            update([saved, ...items]);
          } else if (response.status !== 503) setNotice("Sign in to save presentations to your workspace.");
        })
        .catch(() => setNotice("Could not save to the server; your local version is still available."));
    }
  }

  function duplicate(item: StudioPresentation) {
    const copy = { ...item, id: crypto.randomUUID(), title: `${item.title} (kopie)`, status: "DRAFT" as const, updatedAt: new Date().toISOString(), slides: item.slides.map((slide) => ({ ...slide, id: crypto.randomUUID() })) };
    update([copy, ...items]);
    if (loaded) {
      fetch("/api/presentations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toServerPayload(copy)) })
        .then(async (response) => {
          if (!response.ok) {
            if (response.status !== 503) setNotice("The copy is saved locally only; sign in to enable account storage.");
            return;
          }
          const saved = mapServerPresentation(await response.json() as Record<string, unknown>);
          update([saved, ...items]);
        })
        .catch(() => setNotice("Could not save the copy to the server; the local copy is still available."));
    }
    setMenuId(null);
  }

  function changeStatus(item: StudioPresentation, status: StudioPresentation["status"]) {
    const changed = { ...item, status, updatedAt: new Date().toISOString() };
    update(items.map((entry) => entry.id === item.id ? changed : entry));
    if (loaded) fetch(`/api/presentations/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toServerPayload(changed)) })
      .then((response) => { if (!response.ok && response.status !== 503) setNotice("The change was saved locally, but account storage was not updated."); })
      .catch(() => setNotice("The change was saved locally, but could not be synchronized with the server."));
    setMenuId(null);
  }

  function remove(item: StudioPresentation) {
    if (!window.confirm(`Are you sure you want to delete “${item.title}”?`)) return;
    update(items.filter((entry) => entry.id !== item.id));
    fetch(`/api/presentations/${item.id}`, { method: "DELETE" })
      .then((response) => { if (!response.ok && response.status !== 503) setNotice("Deleted locally, but the server could not delete the presentation."); })
      .catch(() => setNotice("Deleted locally, but the server could not be reached."));
    setMenuId(null);
  }

  async function share(item: StudioPresentation) {
    try {
      const response = await fetch(`/api/presentations/${item.id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visibility: "UNLISTED" }) });
      if (!response.ok) {
        setNotice(response.status === 503 ? "Configure Clerk and Neon to create a secure share link." : "Sign in to share this presentation securely.");
        return;
      }
      const result = await response.json() as { url: string };
      await navigator.clipboard.writeText(result.url);
      setNotice("Secure presentation link copied. Speaker notes remain private.");
    } catch {
      setNotice("Could not create the share link. Check your connection.");
    }
  }

  return (
    <AppShell>
      <header className="topbar">
        <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>Presentations</strong></div>
        <div className="top-actions">
          <ThemeToggle />
          <button className="icon-button" aria-label="Notifications"><Bell size={17} /><i /></button>
          {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
            ? <div className="clerk-user"><SignedIn><UserButton /></SignedIn><SignedOut><SignInButton mode="modal"><button className="button button-secondary">Sign in</button></SignInButton></SignedOut></div>
            : <div className="avatar small" aria-label="Demo workspace">V</div>}
        </div>
      </header>
      <div className="dashboard-content">
        <div className="welcome-row">
          <div><div className="eyebrow-label"><span className="eyebrow-line" /> YOUR PERSONAL WORKSPACE</div><h1>Your stories, <em>in motion.</em></h1><p className="page-subtitle">Create, refine, and present your ideas with confidence.</p></div>
          <div className="welcome-actions">
            <label className="field language-create"><span>New presentation language</span><select value={newLanguage} onChange={(event) => setNewLanguage(event.target.value as PresentationLanguage)}><option value="nl">Dutch</option><option value="ro">Romanian</option><option value="es">Spanish</option></select></label>
            <button className="button button-secondary" onClick={() => document.getElementById("templates")?.scrollIntoView({ behavior: "smooth" })}><LayoutTemplate size={15} /> Browse templates</button>
            <button className="button button-primary" onClick={() => createPresentation()}><Plus size={16} /> New presentation</button>
          </div>
        </div>
        {notice && <div className="notice"><span className="notice-dot" />{notice}<button onClick={() => setNotice("")} aria-label="Melding sluiten">×</button></div>}
        <section className="summary-strip">
          <div className="summary-item"><span className="summary-icon pale-green"><Grid2X2 size={17} /></span><div><small>Presentations</small><strong>{items.filter((item) => item.status !== "ARCHIVED").length.toString().padStart(2, "0")}</strong></div></div>
          <div className="summary-divider" />
          <div className="summary-item"><span className="summary-icon pale-purple"><FolderOpen size={17} /></span><div><small>Categories</small><strong>{String(categoryCount).padStart(2, "0")}</strong></div></div>
          <div className="summary-divider" />
          <div className="summary-item"><span className="summary-icon pale-orange"><Clock3 size={17} /></span><div><small>Last edited</small><strong className="summary-date">{latestEdited ? new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(latestEdited.updatedAt)) : "Not yet"}</strong></div></div>
          <div className="summary-spacer" />
          <div className="save-indicator"><span className="save-check"><Check size={12} /></span>{storageMode === "cloud" ? "Saved to Neon" : "Saved in this browser"}</div>
        </section>

        <section className="recent-section">
          <div className="section-heading">
            <div><div className="section-kicker">YOUR LIBRARY</div><h2>Presentations <span>{items.length}</span></h2></div>
            <button className="text-link" onClick={() => setFilter(filter === "Archived" ? "All" : "Archived")}>{filter === "Archived" ? "Back to active" : "View archive"} <ArrowRight size={14} /></button>
          </div>
          <div className="library-toolbar">
            <label className="search-box"><Search size={16} /><input aria-label="Search presentations" placeholder="Search presentations..." value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></label>
            <div className="toolbar-right">
              <button className="filter-button" onClick={() => setFilter(filter === "All" ? "Active" : "All")}><ListFilter size={15} /> {filter === "All" ? "All statuses" : filter}<ChevronDown size={13} /></button>
              <div className="view-toggle"><button aria-label="Grid view" className={view === "grid" ? "selected" : ""} onClick={() => setView("grid")}><Grid2X2 size={15} /></button><button aria-label="List view" className={view === "list" ? "selected" : ""} onClick={() => setView("list")}><Rows3 size={15} /></button></div>
            </div>
          </div>
          <div className={`presentation-grid ${view === "list" ? "list-view" : ""}`}>
            {visibleItems.map((item, index) => (
              <article className={`presentation-card ${index === 0 ? "featured-card" : ""}`} key={item.id}>
                <div className={`card-preview preview-${index % 3}`}>
                  <div className="preview-window">
                    <div className="preview-copy"><span className="preview-eyebrow">{item.slides[0]?.content.eyebrow ?? "PRESENTATION"}</span><strong>{item.title}</strong><span>{item.slides[0]?.subtitle}</span></div>
                    {item.slides[0]?.content.image && <Image src={item.slides[0].content.image} alt="" fill sizes="(max-width: 760px) 100vw, 30vw" unoptimized />}
                    {index === 0 && <span className="preview-logo"><span>t</span> thuiszoek.nl</span>}
                    <span className="slide-badge">{item.slides.length} slides</span>
                  </div>
                  <div className="card-hover-actions"><Link href={`/editor/${item.id}`} className="button button-primary button-small">Open editor <ArrowRight size={13} /></Link></div>
                </div>
                <div className="card-info">
                  <div className="card-title-row"><span className="category-tag">{item.category}</span><div className="card-menu-wrap"><button className="more-button" aria-label="More options" onClick={() => setMenuId(menuId === item.id ? null : item.id)}><MoreHorizontal size={19} /></button>{menuId === item.id && <div className="card-menu"><button onClick={() => duplicate(item)}><Copy size={14} /> Duplicate</button><button onClick={() => changeStatus(item, item.status === "ARCHIVED" ? "DRAFT" : "ARCHIVED")}><Archive size={14} /> {item.status === "ARCHIVED" ? "Restore" : "Archive"}</button><button className="danger-action" onClick={() => remove(item)}><Trash2 size={14} /> Delete</button></div>}</div></div>
                  <Link href={`/editor/${item.id}`} className="card-name">{item.title}</Link>
                  <p className="card-description">{item.description}</p>
                  <div className="card-footer"><span className={`status-label ${item.status.toLowerCase()}`}><i />{statusLabel(item.status)}{item.translationNeedsReview ? " · Review translation" : ""}</span><span className="updated-date">{dateFormatter.format(new Date(item.updatedAt))}</span></div>
                </div>
                <div className="card-bottom-actions"><Link href={`/present/${item.id}`}><Play size={14} /> Present</Link><button onClick={() => share(item)}><Share2 size={14} /> Share</button></div>
              </article>
            ))}
            <button className="new-card" onClick={() => createPresentation()}><span className="new-card-icon"><FilePlus2 size={21} /></span><strong>Start with a blank canvas</strong><span>Your story, built from scratch.</span><span className="new-card-action">New presentation <Plus size={14} /></span></button>
          </div>
          {visibleItems.length === 0 && <div className="empty-state"><Search size={22} /><h3>No results found</h3><p>Try another search or adjust your filters.</p></div>}
        </section>

        <section className="templates-section" id="templates">
          <div className="section-heading template-heading"><div><div className="section-kicker">GET STARTED</div><h2>A great starting point <span>9 templates</span></h2></div><span className="template-caption">Choose a layout to begin</span></div>
          <div className="template-row">{templates.map((template, index) => <button className="template-card" key={template} onClick={() => createPresentation(template)}><span className={`template-art art-${index % 5}`}><span className="art-slide"><i /><i /><i /></span></span><span className="template-card-name">{template}<ArrowRight size={13} /></span></button>)}</div>
        </section>
        <footer className="dashboard-footer"><span>© 2026 Studio. Space for your next story.</span><span><a href="#privacy">Privacy</a><a href="#support"><BookOpen size={13} /> Support</a></span></footer>
      </div>
    </AppShell>
  );
}
