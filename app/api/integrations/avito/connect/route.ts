import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { connectAvito } from "@/lib/integrations/avito-service";
import { integrationErrorResponse } from "@/lib/integrations/errors";
import { isAvitoConfigured } from "@/lib/integrations/env";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const POST = withApiAuth(async (request: Request) => {
  if (!isAvitoConfigured()) {
    return NextResponse.json(
      { error: "Не заданы AVITO_CLIENT_ID и AVITO_CLIENT_SECRET." },
      { status: 400 },
    );
  }

  let body: { flow?: "oauth" | "client_credentials" } = {};

  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text) as { flow?: "oauth" | "client_credentials" };
    }
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  try {
    const state = randomBytes(16).toString("hex");
    const result = await connectAvito({
      flow: body.flow,
      state,
    });

    const response = NextResponse.json(result);
    if (result.redirectUrl) {
      response.cookies.set("avito_oauth_state", state, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 600,
      });
    }

    return response;
  } catch (error) {
    return integrationErrorResponse(error);
  }
});
