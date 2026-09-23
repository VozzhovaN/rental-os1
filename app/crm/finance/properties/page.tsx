import Link from "next/link";
import { PageHeader } from "@/components/crm/page-header";
import { PropertyEconomicsTable } from "@/components/finance/property-economics-table";
import { financeDashboardQuerySchema, getFinanceDashboard } from "@/lib/finance";
import { getProperties } from "@/lib/properties";

export const dynamic = "force-dynamic";

export default async function FinancePropertiesPage({
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

  const filterQuery = buildFilterQuery(dashboard.filters);

  return (
      <div className="space-y-5">
        <PageHeader
          title="Объекты"
          subtitle={`Экономика объектов за ${dashboard.filters.dateFrom} — ${dashboard.filters.dateTo}`}
          actions={
            <Link
              href={`/crm/finance${filterQuery}`}
              className="inline-flex items-center justify-center rounded-xl border border-[var(--finance-border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--finance-text)] hover:bg-[var(--finance-hover)]"
            >
              Обзор финансов
            </Link>
          }
        />

        <form
          method="get"
          action="/crm/finance/properties"
          className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Объект</span>
            <select
              name="propertyId"
              defaultValue={dashboard.filters.propertyId ?? ""}
              className="rounded-lg border border-zinc-300 px-2 py-1.5"
            >
              <option value="">Все</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="period" value={dashboard.filters.period} />
          <input type="hidden" name="dateFrom" value={dashboard.filters.dateFrom} />
          <input type="hidden" name="dateTo" value={dashboard.filters.dateTo} />
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Применить
          </button>
        </form>

        <PropertyEconomicsTable
          rows={dashboard.propertyEconomics}
          dateFrom={dashboard.filters.dateFrom}
          dateTo={dashboard.filters.dateTo}
        />
      </div>
  );
}

function buildFilterQuery(filters: {
  period: string;
  dateFrom: string;
  dateTo: string;
  propertyId: string | null;
  managementType: string;
  segment: string;
}) {
  const params = new URLSearchParams();
  params.set("period", filters.period);
  if (filters.propertyId) params.set("propertyId", filters.propertyId);
  if (filters.managementType !== "ALL") params.set("managementType", filters.managementType);
  if (filters.segment !== "ALL") params.set("segment", filters.segment);
  if (filters.period === "custom") {
    params.set("dateFrom", filters.dateFrom);
    params.set("dateTo", filters.dateTo);
  }
  const q = params.toString();
  return q ? `?${q}` : "";
}
