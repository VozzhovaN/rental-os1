import { NextResponse } from "next/server";
import { disconnectAvito } from "@/lib/integrations/avito-service";
import { integrationErrorResponse } from "@/lib/integrations/errors";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const POST = withApiAuth(async (_request: Request) => {
  try {
    await disconnectAvito();
    return NextResponse.json({ ok: true, status: "DISCONNECTED" });
  } catch (error) {
    return integrationErrorResponse(error);
  }
});
