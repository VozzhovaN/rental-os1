import { DashboardView } from "@/components/dashboard/dashboard-view";
import {
  getDashboardChannelStats,
  getDashboardData,
  parseDashboardFilters,
  searchParamsFromRecord,
} from "@/lib/dashboard";
import {
  getDashboardTodayEvents,
  getSalesCalendarEvents,
} from "@/lib/dashboard-sidebar";
import { redactSecrets } from "@/lib/integrations/crypto";
import { prisma } from "@/lib/prisma";
import { getProperties, serializeProperty } from "@/lib/properties";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const filters = parseDashboardFilters(searchParamsFromRecord(raw));
  const notice = typeof raw.notice === "string" ? raw.notice : undefined;

  let data;
  let todayEvents;
  let salesCalendar;
  let channelStats;

  try {
    const now = new Date();
    [data, todayEvents, salesCalendar, channelStats] = await Promise.all([
      getDashboardData(filters),
      getDashboardTodayEvents(now),
      getSalesCalendarEvents({
        year: now.getUTCFullYear(),
        month: now.getUTCMonth() + 1,
      }),
      getDashboardChannelStats({
        year: filters.year,
        month: filters.month,
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("GET /crm/dashboard", redactSecrets(message));
    return (
      <div className="finance-card px-6 py-10 text-center">
        <p className="font-medium text-[#0F172A]">Не удалось загрузить данные календаря.</p>
        <p className="mt-2 text-sm text-[#64748B]">Попробуйте обновить страницу.</p>
      </div>
    );
  }

  const propertyOptions = (await getProperties()).map(serializeProperty);
  const propertyIds = data.properties.map((p) => p.id);
  const photos =
    propertyIds.length > 0
      ? await prisma.propertyPhoto.findMany({
          where: { propertyId: { in: propertyIds } },
          orderBy: { sortOrder: "asc" },
          select: { propertyId: true, url: true },
        })
      : [];

  const photoByPropertyId: Record<string, string> = {};
  for (const photo of photos) {
    if (!photoByPropertyId[photo.propertyId]) {
      photoByPropertyId[photo.propertyId] = photo.url;
    }
  }

  return (
    <DashboardView
      data={data}
      filters={filters}
      propertyOptions={propertyOptions}
      notice={notice}
      photoByPropertyId={photoByPropertyId}
      todayEvents={todayEvents}
      salesCalendar={salesCalendar}
      channelStats={channelStats}
    />
  );
}
