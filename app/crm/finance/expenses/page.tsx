import Link from "next/link";
import { PageHeader } from "@/components/crm/page-header";
import { DonutChart, expenseSliceColor } from "@/components/finance/charts/donut-chart";
import { ExpenseQuickForm } from "@/components/finance/expense-quick-form";
import {
  financeDashboardQuerySchema,
  financialCategoryLabels,
  getFinanceDashboard,
  listFinancialTransactions,
} from "@/lib/finance";
import { formatMoney } from "@/lib/property-labels";
import { getProperties } from "@/lib/properties";

export const dynamic = "force-dynamic";

export default async function FinanceExpensesPage({
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

  const [dashboard, properties, expenseTransactions] = await Promise.all([
    getFinanceDashboard(query),
    getProperties(),
    listFinancialTransactions({
      type: "EXPENSE",
      propertyId: parsed.success ? parsed.data.propertyId : undefined,
      dateFrom: undefined,
      dateTo: undefined,
    }),
  ]);

  const filteredExpenses = expenseTransactions.filter((tx) => {
    const day = tx.occurredAt.slice(0, 10);
    return day >= dashboard.filters.dateFrom && day <= dashboard.filters.dateTo;
  });

  return (
      <div className="space-y-5">
        <PageHeader
          title="Расходы"
          subtitle={`Структура и учёт расходов оператора за ${dashboard.filters.dateFrom} — ${dashboard.filters.dateTo}`}
          actions={
            <Link
              href="/crm/finance/operations"
              className="inline-flex items-center justify-center rounded-xl border border-[var(--finance-border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--finance-text)] hover:bg-[var(--finance-hover)]"
            >
              Журнал операций
            </Link>
          }
        />

        <section className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Всего расходов" value={dashboard.summary.totalExpenses} />
          <SummaryCard label="Общие расходы" value={dashboard.reconciliation.generalExpenses} />
          <SummaryCard label="Записей в журнале" value={filteredExpenses.length} isCount />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <DonutChart
            slices={dashboard.expenseCategories}
            centerLabel="Категории"
            centerValue={formatMoney(dashboard.summary.totalExpenses)}
            title="Структура по категориям"
            colorForSlice={expenseSliceColor}
            emptyPlaceholder
          />
          <DonutChart
            slices={dashboard.expensesBySegment}
            centerLabel="Сегменты"
            centerValue={formatMoney(dashboard.summary.totalExpenses)}
            title="Расходы по сегментам"
            colorForSlice={expenseSliceColor}
            emptyPlaceholder
          />
        </div>

        <ExpenseQuickForm
          properties={properties.map((p) => ({ id: p.id, name: p.name }))}
          defaultPropertyId={dashboard.filters.propertyId ?? undefined}
        />

        <section className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold">Расходы за период</h2>
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-medium">Дата</th>
                <th className="px-3 py-2 font-medium">Объект</th>
                <th className="px-3 py-2 font-medium">Категория</th>
                <th className="px-3 py-2 font-medium">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                    Нет расходов
                  </td>
                </tr>
              ) : (
                filteredExpenses.slice(0, 50).map((tx) => (
                  <tr key={tx.id} className="border-b border-zinc-100">
                    <td className="px-3 py-2">{tx.occurredAt.slice(0, 10)}</td>
                    <td className="px-3 py-2">{tx.propertyName ?? "Общий"}</td>
                    <td className="px-3 py-2">{financialCategoryLabels[tx.category] ?? tx.category}</td>
                    <td className="px-3 py-2 tabular-nums text-red-700">
                      −{formatMoney(tx.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>
  );
}

function SummaryCard({
  label,
  value,
  isCount,
}: {
  label: string;
  value: number;
  isCount?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">
        {isCount ? value : formatMoney(value)}
      </p>
    </div>
  );
}
