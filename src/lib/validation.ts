import { z } from "zod";

export const presentationLanguageSchema = z.enum(["nl", "ro", "es"]);

export const slideInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1).max(180),
  subtitle: z.string().max(300).optional().default(""),
  layout: z.enum(["cover", "content", "split", "stats", "quote", "cta"]).default("content"),
  content: z.object({
    eyebrow: z.string().max(80).optional(),
    body: z.string().max(2000).optional(),
    bullets: z.array(z.string().max(240)).max(12).optional(),
    image: z.string().url().optional().or(z.literal("")),
    stats: z.array(z.object({ value: z.string().max(32), label: z.string().max(100) })).max(6).optional(),
    textColors: z.object({
      eyebrow: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      title: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      subtitle: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      body: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      bullets: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      stats: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    }).optional(),
  }),
  notes: z.string().max(5000).optional().default(""),
  narrationText: z.string().max(5000).optional().default(""),
});

export const presentationInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(500).optional().default(""),
  category: z.string().max(60).optional().default("General"),
  language: presentationLanguageSchema.optional().default("nl"),
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
    voiceURI: z.string().max(512).optional(),
    muted: z.boolean().optional(),
  }).optional(),
  slides: z.array(slideInputSchema).max(100).optional(),
});

export type SlideInput = z.infer<typeof slideInputSchema>;
