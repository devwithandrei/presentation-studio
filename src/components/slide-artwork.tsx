import Image from "next/image";
import { Fragment, type ReactNode } from "react";
import type { SlideMediaElement, StudioPresentation, StudioSlide } from "@/lib/demo-data";
import { SlideMediaVisual } from "@/components/slide-media-visual";

type SlideArtworkProps = {
  slide: StudioSlide;
  index: number;
  total: number;
  theme: StudioPresentation["theme"];
  className?: string;
  slideRef?: React.Ref<HTMLDivElement>;
  children: ReactNode;
  renderMedia?: (element: SlideMediaElement) => ReactNode;
  showNumber?: boolean;
};

export function SlideArtwork({
  slide,
  index,
  total,
  theme,
  className = "",
  slideRef,
  children,
  renderMedia,
  showNumber = true,
}: SlideArtworkProps) {
  return (
    <div
      ref={slideRef}
      className={`slide-canvas ${slide.layout} ${slide.content.backgroundImage ? "has-background-image" : ""} ${className}`.trim()}
      style={{ backgroundColor: theme.background }}
    >
      {slide.content.backgroundImage && <Image className="slide-background-image" src={slide.content.backgroundImage} alt="" width={1600} height={900} sizes="100vw" priority={index === 0} unoptimized />}
      {slide.content.image && <Image className="slide-decoration-image" src={slide.content.image} alt="" width={1600} height={900} sizes="100vw" priority={index === 0} unoptimized />}
      {slide.content.mediaElements?.map((element) => renderMedia
        ? <Fragment key={element.id}>{renderMedia(element)}</Fragment>
        : <div key={element.id} className="slide-media-object" style={{ left: `${element.x}%`, top: `${element.y}%`, width: `${element.width}%`, height: `${element.height}%` }}><SlideMediaVisual element={element} /></div>)}
      <div className="slide-canvas-copy">{children}</div>
      {showNumber && <span className="slide-canvas-number">{String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>}
    </div>
  );
}

function PositionedText({ id, slide, children }: { id: string; slide: StudioSlide; children: ReactNode }) {
  const position = slide.content.textPositions?.[id];
  const size = slide.content.textSizes?.[id] ?? 100;
  return (
    <div className="slide-text-section" data-text-section={id} style={position ? { translate: `${position.x}cqw ${position.y}cqh` } : undefined}>
      <div className="slide-text-content" style={{ zoom: size / 100 }}>{children}</div>
    </div>
  );
}

export function SlideArtworkCopy({ slide, theme }: { slide: StudioSlide; theme: StudioPresentation["theme"] }) {
  const colors = slide.content.textColors ?? {};
  const color = (id: string, key: keyof NonNullable<StudioSlide["content"]["textColors"]>, fallback: string) =>
    slide.content.textStyleColors?.[id] ?? colors[key] ?? fallback;

  return (
    <>
      {slide.content.eyebrow && <PositionedText id="eyebrow" slide={slide}><span className="eyebrow" style={{ display: "block", width: "100%", color: color("eyebrow", "eyebrow", theme.accent) }}>{slide.content.eyebrow}</span></PositionedText>}
      <PositionedText id="title" slide={slide}><h1 style={{ fontFamily: theme.font, color: color("title", "title", "#30372c") }}>{slide.title}</h1></PositionedText>
      {slide.subtitle && <PositionedText id="subtitle" slide={slide}><h2 style={{ color: color("subtitle", "subtitle", "#818c79") }}>{slide.subtitle}</h2></PositionedText>}
      {slide.content.body && <PositionedText id="body" slide={slide}><p style={{ color: color("body", "body", "#697265") }}>{slide.content.body}</p></PositionedText>}
      {!!slide.content.bullets?.length && <ul>{slide.content.bullets.map((item, bulletIndex) => {
        const id = `bullet-${bulletIndex}`;
        return <li key={id}><PositionedText id={id} slide={slide}><span style={{ display: "block", width: "100%", color: color(id, "bullets", "#4e594b") }}>{item}</span></PositionedText></li>;
      })}</ul>}
      {!!slide.content.stats?.length && <div className="stats-row">{slide.content.stats.map((stat, statIndex) => {
        const valueId = `stat-${statIndex}-value`;
        const labelId = `stat-${statIndex}-label`;
        return (
          <div className="stat-box" key={valueId}>
            <PositionedText id={valueId} slide={slide}><strong style={{ display: "block", width: "100%", color: color(valueId, "stats", "#627a4d") }}>{stat.value}</strong></PositionedText>
            <PositionedText id={labelId} slide={slide}><span style={{ display: "block", width: "100%", color: color(labelId, "stats", "#7a8474") }}>{stat.label}</span></PositionedText>
          </div>
        );
      })}</div>}
    </>
  );
}
