import { FinanceDashboardView } from "@/components/finance/finance-dashboard-view";
import { financeDashboardQuerySchema, getFinanceDashboard } from "@/lib/finance";
import { prisma } from "@/lib/prisma";
import { getProperties } from "@/lib/properties";

export const dynamic = "force-dynamic";

export default async function FinanceOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = financeDashboardQuerySchema.safeParse({
    period: typeof raw.period === "string" ? raw.period : undefined,
    dateFrom: typeof raw.dateFrom === "string" ? raw.dateFrom : undefined,
    dateTo: typeof raw.dateTo === "string" ? raw.dateTo : undefined,
    propertyId: typeof raw.propertyId === "string" ? raw.propertyId : undefined,
    managementType: typeof raw.managementType === "string" ? raw.managementType : undefined,
    segment: typeof raw.segment === "string" ? raw.segment : undefined,
  });

  const query = parsed.success ? parsed.data : { period: "month" as const };

  const [dashboard, properties] = await Promise.all([
    getFinanceDashboard(query),
    getProperties(),
  ]);

  const propertyIds = [
    ...new Set([
      ...dashboard.propertyEconomics.map((r) => r.propertyId),
      ...dashboard.commissionSummary.byProperty.map((r) => r.propertyId),
    ]),
  ];

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
    <FinanceDashboardView
      initialData={dashboard}
      properties={properties.map((p) => ({ id: p.id, name: p.name }))}
      photoByPropertyId={photoByPropertyId}
    />
  );
}
