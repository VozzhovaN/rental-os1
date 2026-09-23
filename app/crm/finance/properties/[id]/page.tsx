import Link from "next/link";
import { notFound } from "next/navigation";
import { DonutChart, expenseSliceColor } from "@/components/finance/charts/donut-chart";
import { CommissionPaymentForm } from "@/components/finance/commission-payment-form";
import { calculatePropertyEconomics, resolveDashboardPeriod } from "@/lib/finance";
import { financialCategoryLabels } from "@/lib/finance/types";
import {
  formatMoney,
  managementTypeLabels,
  rentCollectionModeLabels,
} from "@/lib/property-labels";
import { getPropertyByIdOrSlug } from "@/lib/properties";

export const dynamic = "force-dynamic";

export default async function PropertyEconomicsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const raw = await searchParams;
  const property = await getPropertyByIdOrSlug(id);
  if (!property) notFound();

  const period = typeof raw.period === "string" ? raw.period : "month";
  const range = resolveDashboardPeriod({
    period: period as "month",
    dateFrom: typeof raw.dateFrom === "string" ? raw.dateFrom : undefined,
    dateTo: typeof raw.dateTo === "string" ? raw.dateTo : undefined,
  });

  const filters = { dateFrom: range.dateFrom, dateTo: range.dateTo };
  const economics = await calculatePropertyEconomics(property.id, filters);

  const expenseSlices = Object.entries(economics.expensesByCategory)
    .filter(([, amount]) => amount > 0)
    .map(([cat, amount]) => ({
      id: cat,
      label: financialCategoryLabels[cat as keyof typeof financialCategoryLabels] ?? cat,
      amount,
      percent: economics.totalExpenses
        ? Math.round((amount / economics.totalExpenses) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const querySuffix = `?dateFrom=${range.dateFrom}&dateTo=${range.dateTo}&period=${period}`;

  return (
      <div className="space-y-8">
        <div>
          <Link
            href="/crm/finance/properties"
            className="text-sm text-zinc-500 hover:text-zinc-800"
          >
            ← Объекты
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{property.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Экономика объекта · {managementTypeLabels[property.managementType]} · сбор:{" "}
            {rentCollectionModeLabels[property.rentCollectionMode]}
          </p>
        </div>

        <form
          method="get"
          className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
        >
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">С</span>
            <input
              type="date"
              name="dateFrom"
              defaultValue={range.dateFrom}
              className="rounded-lg border border-zinc-300 px-2 py-1.5"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">По</span>
            <input
              type="date"
              name="dateTo"
              defaultValue={range.dateTo}
              className="rounded-lg border border-zinc-300 px-2 py-1.5"
            />
          </label>
          <input type="hidden" name="period" value="custom" />
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Применить
          </button>
        </form>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Валовая аренда" value={economics.grossRent} />
          <Card label="Выручка бизнеса" value={economics.businessRevenue} />
          <Card label="Расходы оператора" value={economics.totalExpenses} />
          <Card label="Чистая прибыль" value={economics.netProfit} highlight />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <DonutChart
            slices={expenseSlices}
            centerLabel="Расходы"
            centerValue={formatMoney(economics.totalExpenses)}
            title="Структура расходов"
            emptyMessage="Нет расходов за период"
            colorForSlice={expenseSliceColor}
            emptyPlaceholder
          />

          <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Разбивка по категориям</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {expenseSlices.length === 0 ? (
                <li className="text-zinc-500">Нет расходов</li>
              ) : (
                expenseSlices.map((slice) => (
                  <li key={slice.id} className="flex justify-between">
                    <span className="text-zinc-700">{slice.label}</span>
                    <span className="tabular-nums text-zinc-900">{formatMoney(slice.amount)}</span>
                  </li>
                ))
              )}
            </ul>
            <Link
              href={`/crm/finance/expenses${querySuffix}`}
              className="mt-4 inline-block text-sm text-blue-600 hover:underline"
            >
              Все расходы →
            </Link>
          </section>
        </div>

        {property.managementType === "OWN" ? (
          <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Собственный объект</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Арендная выручка: {formatMoney(economics.ownRentalRevenue)}
            </p>
          </section>
        ) : (
          <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Комиссионное управление</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <Metric label="Комиссия начислена" value={economics.commissionAccrued} />
              <Metric label="Комиссия получена" value={economics.commissionReceived} />
              <Metric label="К получению" value={economics.commissionReceivable} />
              <Metric label="Переплата" value={economics.commissionOverpayment} />
            </dl>
            <CommissionPaymentForm
              properties={[{ id: property.id, name: property.name }]}
              defaultPropertyId={property.id}
            />
          </section>
        )}

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Сегменты аренды</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Краткосрочная аренда</dt>
              <dd className="tabular-nums">{formatMoney(economics.shortTerm.grossRent)}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Долгосрочная аренда</dt>
              <dd className="tabular-nums">{formatMoney(economics.longTerm.grossRent)}</dd>
            </div>
          </dl>
        </section>

        <footer className="text-sm">
          <Link href={`/crm/finance/operations${querySuffix}`} className="text-blue-600 hover:underline">
            Операции по объекту →
          </Link>
        </footer>
      </div>
  );
}

function Card({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 shadow-sm ${
        highlight ? "border-emerald-200 bg-emerald-50/60" : "border-zinc-200 bg-white"
      }`}
    >
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{formatMoney(value)}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium tabular-nums">{formatMoney(value)}</dd>
    </div>
  );
}
