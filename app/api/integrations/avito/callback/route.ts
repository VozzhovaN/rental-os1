import { NextResponse } from "next/server";
import { connectAvito } from "@/lib/integrations/avito-service";
import { publicIntegrationMessage } from "@/lib/integrations/errors";

const OAUTH_STATE_COOKIE = "avito_oauth_state";

function clearOAuthState(response: NextResponse) {
  response.cookies.set(OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

function redirectToSettings(request: Request, query: Record<string, string>) {
  const url = new URL("/crm/settings/integrations/avito", request.url);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return clearOAuthState(NextResponse.redirect(url));
}

function readOAuthStateCookie(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const expected = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${OAUTH_STATE_COOKIE}=`))
    ?.slice(OAUTH_STATE_COOKIE.length + 1);
  return expected || null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const expected = readOAuthStateCookie(request);

  if (oauthError) {
    return redirectToSettings(request, { error: "Не удалось подключить Авито." });
  }

  if (!code) {
    return redirectToSettings(request, { error: "Авито не вернул код авторизации." });
  }

  // Validate state before accepting OAuth result; clear cookie (one-time).
  if (!expected || !state || expected !== state) {
    return redirectToSettings(request, {
      error: "Сессия подключения Авито устарела. Повторите попытку.",
    });
  }

  try {
    await connectAvito({ code, flow: "oauth" });
    return redirectToSettings(request, { connected: "1" });
  } catch (error) {
    return redirectToSettings(request, { error: publicIntegrationMessage(error) });
  }
}
