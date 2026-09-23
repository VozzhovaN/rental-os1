import { NextResponse } from "next/server";
import { syncAvito } from "@/lib/integrations/avito-service";
import { integrationErrorResponse } from "@/lib/integrations/errors";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const POST = withApiAuth(async (_request: Request) => {
  try {
    const result = await syncAvito();
    return NextResponse.json({
      ok: true,
      message: "Синхронизация завершена",
      result,
    });
  } catch (error) {
    return integrationErrorResponse(error);
  }
});
