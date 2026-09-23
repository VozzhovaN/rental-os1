import { NextResponse } from "next/server";
import { getAvitoPublicStatus } from "@/lib/integrations/avito-service";
import { isAvitoConfigured } from "@/lib/integrations/env";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const GET = withApiAuth(async (_request: Request) => {
  const status = await getAvitoPublicStatus();

  return NextResponse.json({
    ...status,
    configured: isAvitoConfigured(),
  });
});
