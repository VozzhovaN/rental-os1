import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import { getDashboardTodayEvents } from "@/lib/dashboard-sidebar";
import { redactSecrets } from "@/lib/integrations/crypto";

export const dynamic = "force-dynamic";

export const GET = withApiAuth(async () => {
  try {
    const data = await getDashboardTodayEvents();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/dashboard/today-events", redactSecrets(message));
    return NextResponse.json(
      { error: "Не удалось загрузить события сегодня." },
      { status: 500 },
    );
  }
});
