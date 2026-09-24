import { jsonError, jsonUtf8 } from "@/lib/api-json";
import {
  readSessionTokenFromRequest,
  setSessionCookie,
} from "@/lib/auth/cookies";
import { normalizeEmail, verifyPassword } from "@/lib/auth/password";
import { checkLoginRateLimit, clearLoginFailures, recordLoginFailure } from "@/lib/auth/rate-limit";
import { createSession, revokeSessionByRawToken } from "@/lib/auth/session";
import { loginSchema } from "@/lib/auth/validation";
import { withPublicRoute } from "@/lib/auth/with-public-route";
import { prisma } from "@/lib/prisma";

const GENERIC_INVALID = "Неверный email или пароль";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export const POST = withPublicRoute(async (request: Request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Некорректный JSON", 400, { code: "VALIDATION_ERROR" });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(GENERIC_INVALID, 401, { code: "UNAUTHORIZED" });
  }

  const email = normalizeEmail(parsed.data.email);
  const password = parsed.data.password;
  const ip = clientIp(request);
  const rateKeys = [`ip:${ip}`, `email:${email}`];

  const rate = checkLoginRateLimit(rateKeys);
  if (!rate.allowed) {
    return jsonError("Слишком много попыток. Попробуйте позже.", 429, {
      code: "FORBIDDEN",
    });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    recordLoginFailure(rateKeys);
    return jsonError(GENERIC_INVALID, 401, { code: "UNAUTHORIZED" });
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    recordLoginFailure(rateKeys);
    return jsonError(GENERIC_INVALID, 401, { code: "UNAUTHORIZED" });
  }

  clearLoginFailures(rateKeys);

  // Session fixation: never reuse client-supplied token; revoke prior cookie session.
  const priorToken = readSessionTokenFromRequest(request);
  if (priorToken) {
    await revokeSessionByRawToken(priorToken);
  }

  const { rawToken } = await createSession({
    userId: user.id,
    userAgent: request.headers.get("user-agent"),
    ip,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const response = jsonUtf8({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  });
  response.headers.set("Cache-Control", "no-store");
  setSessionCookie(response, rawToken);
  return response;
});
