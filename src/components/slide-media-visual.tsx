import {
  ArrowRight, CheckCircle2, Heart, Home, Lightbulb, Sparkles, Star,
  type LucideIcon,
} from "lucide-react";
import type { SlideMediaElement } from "@/lib/demo-data";
import Image from "next/image";

export const slideMediaIconChoices: {
  name: NonNullable<SlideMediaElement["icon"]>;
  label: string;
  Icon: LucideIcon;
}[] = [
  { name: "home", label: "Home", Icon: Home },
  { name: "heart", label: "Heart", Icon: Heart },
  { name: "star", label: "Star", Icon: Star },
  { name: "check", label: "Check", Icon: CheckCircle2 },
  { name: "sparkles", label: "Sparkles", Icon: Sparkles },
  { name: "arrow", label: "Arrow", Icon: ArrowRight },
  { name: "idea", label: "Idea", Icon: Lightbulb },
];

export function SlideMediaVisual({ element, controls = true }: { element: SlideMediaElement; controls?: boolean }) {
  if (element.type === "image") return <Image src={element.src ?? ""} alt="" fill sizes="(max-width: 760px) 100vw, 40vw" unoptimized draggable={false} />;
  if (element.type === "video") return <video src={element.src} controls={controls} muted={!controls} autoPlay={!controls} loop={!controls} playsInline preload="metadata" />;
  const Icon = slideMediaIconChoices.find((item) => item.name === element.icon)?.Icon;
  return Icon ? <Icon aria-hidden="true" /> : null;
}
