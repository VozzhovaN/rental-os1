import { withApiAuth } from "@/lib/auth/with-api-auth";
import { jsonUtf8 } from "@/lib/api-json";
import { clearSessionCookie, readSessionTokenFromRequest } from "@/lib/auth/cookies";
import { revokeSessionByRawToken } from "@/lib/auth/session";

export const POST = withApiAuth(async (request: Request) => {
  const token = readSessionTokenFromRequest(request);
  if (token) {
    await revokeSessionByRawToken(token);
  }

  const response = jsonUtf8({ ok: true });
  clearSessionCookie(response);
  return response;
});
