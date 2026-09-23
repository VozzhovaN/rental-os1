import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  getSalesCalendarEvents,
  parseSalesCalendarMonth,
} from "@/lib/dashboard-sidebar";
import { redactSecrets } from "@/lib/integrations/crypto";

export const dynamic = "force-dynamic";

export const GET = withApiAuth(async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const { year, month } = parseSalesCalendarMonth(searchParams);

    if (
      searchParams.has("year") &&
      !Number.isInteger(Number(searchParams.get("year")))
    ) {
      return NextResponse.json({ error: "Некорректный year" }, { status: 400 });
    }
    if (
      searchParams.has("month") &&
      !Number.isInteger(Number(searchParams.get("month")))
    ) {
      return NextResponse.json({ error: "Некорректный month" }, { status: 400 });
    }

    const data = await getSalesCalendarEvents({ year, month });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /api/dashboard/sales-calendar", redactSecrets(message));
    return NextResponse.json(
      { error: "Не удалось загрузить календарь продаж." },
      { status: 500 },
    );
  }
});
