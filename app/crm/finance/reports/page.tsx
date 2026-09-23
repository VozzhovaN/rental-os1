import Link from "next/link";
import { financeDashboardQuerySchema, getFinanceDashboard } from "@/lib/finance";
import { formatMoney } from "@/lib/property-labels";

export const dynamic = "force-dynamic";

export default async function FinanceReportsPage({
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
  const dashboard = await getFinanceDashboard(query);

  const { summary, reconciliation, commissionSummary, filters } = dashboard;

  return (
      <div className="space-y-6">
        <header className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Отчёты</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Управленческий отчёт за {filters.dateFrom} — {filters.dateTo}
          </p>
          <Link href="/crm/finance" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            ← Интерактивный обзор
          </Link>
        </header>

        <article className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm print:shadow-none">
          <h2 className="text-lg font-semibold">Отчёт о прибылях и убытках (упрощённый)</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Период: {filters.dateFrom} — {filters.dateTo}
          </p>

          <dl className="mt-6 space-y-3 text-sm">
            <ReportRow label="Оборот объектов (валовая аренда)" value={summary.grossRent} />
            <ReportRow label="Выручка бизнеса" value={summary.businessRevenue} bold />
            <ReportRow label="Расходы оператора" value={-summary.totalExpenses} negative />
            <ReportRow label="Чистая прибыль" value={summary.netProfit} bold highlight />
          </dl>

          <h3 className="mt-8 text-sm font-semibold text-zinc-800">Сверка</h3>
          <dl className="mt-3 space-y-2 text-sm text-zinc-700">
            <ReportRow label="Прибыль объектов" value={reconciliation.propertiesNetProfit} />
            <ReportRow label="Общие расходы" value={-reconciliation.generalExpenses} negative />
            <ReportRow label="Чистая прибыль бизнеса" value={reconciliation.businessNetProfit} bold />
          </dl>

          <h3 className="mt-8 text-sm font-semibold text-zinc-800">Комиссии</h3>
          <dl className="mt-3 space-y-2 text-sm text-zinc-700">
            <ReportRow label="Начислено" value={commissionSummary.accrued} />
            <ReportRow label="Получено" value={commissionSummary.received} />
            <ReportRow label="Дебиторка" value={commissionSummary.receivable} />
          </dl>

          {dashboard.lossMakingItems.length > 0 ? (
            <>
              <h3 className="mt-8 text-sm font-semibold text-red-800">Убыточные позиции</h3>
              <ul className="mt-2 space-y-1 text-sm text-red-700">
                {dashboard.lossMakingItems.map((item) => (
                  <li key={item.id} className="flex justify-between">
                    <span>{item.label}</span>
                    <span className="tabular-nums">{formatMoney(item.netProfit)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {!dashboard.salesFinanceStatus.ready ? (
            <p className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {dashboard.salesFinanceStatus.message}
            </p>
          ) : null}

          <p className="mt-8 text-xs text-zinc-400">
            Сформировано автоматически из данных rental-os. Не является бухгалтерской отчётностью.
          </p>
        </article>
      </div>
  );
}

function ReportRow({
  label,
  value,
  bold,
  negative,
  highlight,
}: {
  label: string;
  value: number;
  bold?: boolean;
  negative?: boolean;
  highlight?: boolean;
}) {
  const display = negative ? -Math.abs(value) : value;
  return (
    <div
      className={`flex justify-between gap-4 border-b border-zinc-100 pb-2 ${
        highlight ? "rounded-lg bg-emerald-50/50 px-2 py-2" : ""
      }`}
    >
      <dt className={bold ? "font-medium text-zinc-900" : "text-zinc-600"}>{label}</dt>
      <dd
        className={`tabular-nums ${bold ? "font-semibold" : ""} ${
          display < 0 ? "text-red-700" : highlight ? "text-emerald-700" : "text-zinc-900"
        }`}
      >
        {display < 0 ? "−" : ""}
        {formatMoney(Math.abs(display))}
      </dd>
    </div>
  );
}
