import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { createTemplateSlides, demoPresentations, templates } from "../src/lib/demo-data";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL before running the seed script.");

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

async function main() {
  for (const name of templates) {
    await prisma.template.upsert({
      where: { name },
      update: {},
      create: {
        name,
        category: name === "Blank canvas" ? "Blank" : "Business",
        description: `Reusable template for ${name.toLowerCase()}.`,
        theme: { accent: "#bce86d", background: "#f5f6f2" },
        slides: createTemplateSlides(name),
      },
    });
  }

  const email = process.env.SEED_OWNER_EMAIL;
  const clerkId = process.env.SEED_OWNER_CLERK_ID;
  if (!email || !clerkId) {
    console.info("Templates seeded. Set SEED_OWNER_EMAIL and SEED_OWNER_CLERK_ID to seed a demo account.");
    return;
  }

  const owner = await prisma.user.upsert({
    where: { clerkId },
    update: { email },
    create: { clerkId, email },
  });
  for (const presentation of demoPresentations) {
    const existing = await prisma.presentation.findFirst({ where: { ownerId: owner.id, title: presentation.title } });
    if (existing) continue;
    await prisma.presentation.create({
      data: {
        ownerId: owner.id,
        title: presentation.title,
        description: presentation.description,
        category: presentation.category,
        language: presentation.language,
        translationNeedsReview: presentation.translationNeedsReview,
        status: presentation.status,
        slides: {
          create: presentation.slides.map((slide, position) => ({
            position,
            title: slide.title,
            subtitle: slide.subtitle,
            layout: slide.layout,
            content: slide.content,
            speakerNotes: { create: { body: slide.notes } },
          })),
        },
      },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error("Database seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
