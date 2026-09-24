/**
 * Course Demo reset (Stage 14) — OPERATOR-ONLY, fail-closed.
 *
 * Restores the demo dataset after a teacher has explored / modified the demo.
 * It refuses to run unless BOTH:
 *   - DEMO_MODE === "true"
 *   - DATABASE_URL points at a SQLite demo file (name contains "demo", not dev.db)
 * so it can never wipe the development or a production-like database.
 *
 * There is intentionally NO public /reset-demo endpoint. This runs only from a
 * shell the operator controls: `npm run demo:reset`.
 *
 * Steps: guard → ensure schema (migrate deploy) → wipe demo data → reseed.
 */
import { execSync } from "node:child_process";
import { prisma } from "@/lib/prisma";
import { assertDemoResetAllowed } from "@/lib/demo/demo-mode";
import { resetDemoData, seedDemo } from "@/prisma/seed-demo";

async function main(): Promise<void> {
  // Fail closed: throws before touching anything if the environment is unsafe.
  assertDemoResetAllowed(process.env);
  console.log(`Demo reset: DATABASE_URL=${process.env.DATABASE_URL}`);

  // Ensure the schema is present on the demo DB (safe, non-destructive).
  console.log("> npx prisma migrate deploy");
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });

  // Controlled wipe of demo business data (preserves admin user/session).
  console.log("> wiping demo data");
  await resetDemoData();

  // Reload the deterministic demo dataset.
  console.log("> reseeding demo data");
  await seedDemo();

  console.log("Demo reset complete.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
