import Link from "next/link";
import { CommissionPaymentForm } from "@/components/finance/commission-payment-form";
import {
  financeDashboardQuerySchema,
  getFinanceDashboard,
  listCommissionPayments,
} from "@/lib/finance";
import { formatMoney } from "@/lib/property-labels";
import { getProperties } from "@/lib/properties";

export const dynamic = "force-dynamic";

export default async function FinanceCommissionsPage({
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
  });
  const query = parsed.success ? parsed.data : { period: "month" as const };

  const [dashboard, properties, payments] = await Promise.all([
    getFinanceDashboard(query),
    getProperties(),
    listCommissionPayments({
      propertyId: parsed.success ? parsed.data.propertyId : undefined,
      dateFrom: undefined,
      dateTo: undefined,
    }),
  ]);

  const filteredPayments = payments.filter((p) => {
    const day = p.paidAt.toISOString().slice(0, 10);
    return day >= dashboard.filters.dateFrom && day <= dashboard.filters.dateTo;
  });

  const propertyMap = new Map(properties.map((p) => [p.id, p.name]));

  return (
      <div className="space-y-6">
        <header className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Комиссии</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Комиссионное управление за {dashboard.filters.dateFrom} — {dashboard.filters.dateTo}
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Начислено" value={dashboard.commissionSummary.accrued} />
          <MetricCard label="Получено" value={dashboard.commissionSummary.received} />
          <MetricCard label="К получению" value={dashboard.commissionSummary.receivable} />
          <MetricCard label="Переплата" value={dashboard.commissionSummary.overpayment} />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">По объектам</h2>
            <ul className="mt-3 divide-y divide-zinc-100 text-sm">
              {dashboard.commissionSummary.byProperty.length === 0 ? (
                <li className="py-4 text-zinc-500">Нет комиссионных объектов с движением</li>
              ) : (
                dashboard.commissionSummary.byProperty.map((row) => (
                  <li key={row.propertyId} className="flex justify-between py-2">
                    <Link
                      href={`/crm/finance/properties/${row.propertyId}`}
                      className="text-zinc-800 hover:underline"
                    >
                      {row.name}
                    </Link>
                    <span className="tabular-nums text-zinc-600">
                      {formatMoney(row.received)} / {formatMoney(row.accrued)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <CommissionPaymentForm
            properties={properties.map((p) => ({ id: p.id, name: p.name }))}
            defaultPropertyId={dashboard.filters.propertyId ?? undefined}
          />
        </div>

        <section className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold">Платежи комиссии</h2>
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-medium">Дата</th>
                <th className="px-3 py-2 font-medium">Объект</th>
                <th className="px-3 py-2 font-medium">Сумма</th>
                <th className="px-3 py-2 font-medium">Примечание</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                    Нет платежей
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-100">
                    <td className="px-3 py-2">{p.paidAt.toISOString().slice(0, 10)}</td>
                    <td className="px-3 py-2">{propertyMap.get(p.propertyId) ?? p.propertyId}</td>
                    <td className="px-3 py-2 tabular-nums text-emerald-700">
                      {formatMoney(p.amount)}
                    </td>
                    <td className="px-3 py-2 text-zinc-600">{p.note ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{formatMoney(value)}</p>
    </div>
  );
}
