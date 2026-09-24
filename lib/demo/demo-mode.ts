/**
 * Course Demo support (Stage 14).
 *
 * DEMO_MODE is a *presentation/safety* flag only. It MUST NOT be used to bypass
 * auth, CSRF, validation, security headers, FSM, or finance rules — the demo
 * runs with the exact same security model as production (NODE_ENV=production).
 */

/** Minimal structural view of the environment (avoids augmented ProcessEnv). */
export type EnvLike = {
  DEMO_MODE?: string;
  DATABASE_URL?: string;
  [key: string]: string | undefined;
};

export function isDemoMode(env: EnvLike = process.env): boolean {
  return env.DEMO_MODE === "true";
}

/**
 * Fail-closed guard for destructive demo operations (reset/reseed).
 * Returns a reason string when the operation must be refused, or null when it
 * is safe. Kept as a pure function so it can be unit-tested without touching
 * any database.
 *
 * Requirements to allow a destructive demo reset:
 *  1. DEMO_MODE === "true"
 *  2. DATABASE_URL is a SQLite file: URL (no server DB target)
 *  3. The database file name clearly identifies a demo DB (contains "demo"),
 *     so the command can never wipe dev.db or a production-like database.
 */
export function demoResetRefusalReason(env: EnvLike = process.env): string | null {
  if (env.DEMO_MODE !== "true") {
    return "DEMO_MODE must be exactly 'true' to run a demo reset";
  }

  const url = env.DATABASE_URL?.trim();
  if (!url) {
    return "DATABASE_URL is not set";
  }

  if (!url.startsWith("file:")) {
    return "Demo reset only operates on a SQLite file: database";
  }

  const filePart = url.slice("file:".length).split("?")[0]!.toLowerCase();
  const fileName = filePart.replace(/\\/g, "/").split("/").pop() ?? "";

  if (fileName.includes("dev.db")) {
    return "Refusing to reset the development database (dev.db)";
  }

  if (!fileName.includes("demo")) {
    return "DATABASE_URL file name must contain 'demo' (e.g. file:./demo.db) to be reset";
  }

  return null;
}

export function assertDemoResetAllowed(env: EnvLike = process.env): void {
  const reason = demoResetRefusalReason(env);
  if (reason) {
    throw new Error(`Demo reset refused: ${reason}`);
  }
}
