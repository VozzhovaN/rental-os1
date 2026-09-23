import { NextResponse } from "next/server";
import { getDashboardData, parseDashboardFilters } from "@/lib/dashboard";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import { redactSecrets } from "@/lib/integrations/crypto";

export const dynamic = "force-dynamic";

export const GET = withApiAuth(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const data = await getDashboardData(parseDashboardFilters(searchParams));
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/dashboard", redactSecrets(message));
    return NextResponse.json(
      { error: "Не удалось загрузить данные календаря. Попробуйте обновить страницу." },
      { status: 500 },
    );
  }
});
