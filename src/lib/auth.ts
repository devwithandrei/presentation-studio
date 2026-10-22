import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function getAuthenticatedStudioUser() {
  if (!process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return null;
  }
  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress;
  if (!email) throw new Error("Your Clerk account must have a primary email address.");

  return prisma.user.upsert({
    where: { clerkId: userId },
    update: { email, name: clerkUser.fullName ?? undefined },
    create: { clerkId: userId, email, name: clerkUser.fullName },
  });
}

export function hasAuthConfiguration() {
  return Boolean(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}
