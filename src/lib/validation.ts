import { z } from "zod";

export const presentationLanguageSchema = z.enum(["en", "nl", "ro", "es"]);

const slideImageSourceSchema = z.string().url()
  .refine((value) => value.startsWith("http://") || value.startsWith("https://"))
  .or(z.string().max(5_600_000).regex(/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/));
const slideBackgroundImageSchema = slideImageSourceSchema.optional().or(z.literal(""));
const slideMediaElementSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1).max(100),
    type: z.literal("image"),
    src: slideImageSourceSchema,
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    width: z.number().min(5).max(100),
    height: z.number().min(5).max(100),
  }),
  z.object({
    id: z.string().min(1).max(100),
    type: z.literal("video"),
    src: z.string().url().refine((value) => value.startsWith("https://")).max(2048),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    width: z.number().min(5).max(100),
    height: z.number().min(5).max(100),
  }),
  z.object({
    id: z.string().min(1).max(100),
    type: z.literal("icon"),
    icon: z.enum(["home", "heart", "star", "check", "sparkles", "arrow", "idea"]),
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    width: z.number().min(5).max(100),
    height: z.number().min(5).max(100),
  }),
]).refine((element) => element.x + element.width <= 100 && element.y + element.height <= 100);

export const slideInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1).max(180),
  subtitle: z.string().max(300).optional().default(""),
  layout: z.enum(["cover", "content", "split", "stats", "quote", "cta"]).default("content"),
  content: z.object({
    eyebrow: z.string().max(80).optional(),
    body: z.string().max(2000).optional(),
    bullets: z.array(z.string().max(240)).max(12).optional(),
    image: z.string().url().refine((value) => value.startsWith("http://") || value.startsWith("https://")).optional().or(z.literal("")),
    backgroundImage: slideBackgroundImageSchema,
    mediaElements: z.array(slideMediaElementSchema).max(30).optional(),
    stats: z.array(z.object({ value: z.string().max(32), label: z.string().max(100) })).max(6).optional(),
    textColors: z.object({
      eyebrow: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      title: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      subtitle: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      body: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      bullets: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      stats: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    }).optional(),
    textStyleColors: z.record(z.string(), z.string().regex(/^#[0-9a-fA-F]{6}$/)).optional(),
    textPositions: z.record(z.string(), z.object({
      x: z.number().min(-100).max(100),
      y: z.number().min(-100).max(100),
    })).optional(),
    textSizes: z.record(z.string(), z.number().min(25).max(300)).optional(),
  }),
  notes: z.string().max(5000).optional().default(""),
  narrationText: z.string().max(5000).optional().default(""),
});

export const presentationInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional().default(""),
  category: z.string().max(60).optional().default("General"),
  language: presentationLanguageSchema.optional().default("en"),
  translationNeedsReview: z.boolean().optional().default(false),
  status: z.enum(["DRAFT", "READY", "ARCHIVED"]).optional(),
  visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]).optional(),
  theme: z.object({
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    font: z.enum(["Georgia, serif", "Arial, sans-serif", "Trebuchet MS, sans-serif"]).optional(),
  }).optional(),
  narrationSettings: z.object({
    rate: z.number().min(0.5).max(2).optional(),
    volume: z.number().min(0).max(1).optional(),
    voiceURI: z.string().max(512).optional(),
    muted: z.boolean().optional(),
  }).optional(),
  slides: z.array(slideInputSchema).max(100).optional(),
});

export type SlideInput = z.infer<typeof slideInputSchema>;
