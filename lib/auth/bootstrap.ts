import { prisma } from "@/lib/prisma";
import { assertAdminPasswordPolicy, readAdminBootstrapEnv } from "@/lib/auth/env";
import { hashPassword, normalizeEmail } from "@/lib/auth/password";

/**
 * Idempotent admin bootstrap from ADMIN_EMAIL / ADMIN_PASSWORD.
 * Does not overwrite an existing user's password.
 */
export async function bootstrapAdminUser(): Promise<{ created: boolean; skipped: boolean; email?: string }> {
  const creds = readAdminBootstrapEnv();

  if (!creds) {
    const userCount = await prisma.user.count();
    if (process.env.NODE_ENV === "production" && userCount === 0) {
      throw new Error(
        "ADMIN_EMAIL and ADMIN_PASSWORD are required to bootstrap the first CRM user in production",
      );
    }
    return { created: false, skipped: true };
  }

  assertAdminPasswordPolicy(creds.password);
  const email = normalizeEmail(creds.email);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { created: false, skipped: true, email };
  }

  const passwordHash = await hashPassword(creds.password);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: "Admin",
      isActive: true,
    },
  });

  return { created: true, skipped: false, email };
}
