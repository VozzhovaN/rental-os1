"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  DonutChart,
  expenseSliceColor,
  profitSliceColor,
  type DonutSlice,
} from "@/components/finance/charts/donut-chart";
import { LineChart } from "@/components/finance/charts/line-chart";
import { ExpenseQuickForm } from "@/components/finance/expense-quick-form";
import { PropertyEconomicsTable } from "@/components/finance/property-economics-table";
import {
  IconCalendar,
  IconChart,
  IconChevronDown,
  IconDownload,
  IconFolder,
  IconPiggy,
  IconPlus,
  IconWallet,
} from "@/components/crm/icons";
import type { FinanceDashboardDto } from "@/lib/finance";
import {
  FINANCE_MANAGEMENT_FILTERS,
  FINANCE_PERIOD_PRESETS,
  FINANCE_SEGMENTS,
} from "@/lib/finance/dashboard-validation";
import { formatMoney } from "@/lib/property-labels";

type PropertyOption = { id: string; name: string };

type Props = {
  initialData: FinanceDashboardDto;
  properties: PropertyOption[];
  photoByPropertyId?: Record<string, string>;
};

type DrillState = {
  kind: "profit" | "expense";
  level: 1 | 2 | 3;
  segment?: "SHORT_TERM" | "LONG_TERM" | "GENERAL";
  propertyId?: string;
  propertyLabel?: string;
};

const SEGMENT_LABELS: Record<string, string> = {
  SHORT_TERM: "Посуточная аренда",
  LONG_TERM: "Долгосрочная аренда",
  GENERAL: "Общие расходы",
};

const PERIOD_LABELS: Record<string, string> = {
  today: "Сегодня",
  week: "Неделя",
  month: "Месяц",
  quarter: "Квартал",
  year: "Год",
  custom: "Произвольный",
};

const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const MONTHS_NOM = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function parseIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y: y!, m: m!, d: d! };
}

function formatPeriodLabel(from: string, to: string, period: string): string {
  const a = parseIso(from);
  const b = parseIso(to);
  if (period === "month" && a.y === b.y && a.m === b.m) {
    return `${MONTHS_NOM[a.m - 1]} ${a.y}`;
  }
  if (from === to) return `${String(a.d).padStart(2, "0")} ${MONTHS_GEN[a.m - 1]} ${a.y}`;
  if (a.y === b.y && a.m === b.m) {
    return `${String(a.d).padStart(2, "0")}–${String(b.d).padStart(2, "0")} ${MONTHS_GEN[a.m - 1]} ${a.y}`;
  }
  return `${String(a.d).padStart(2, "0")} ${MONTHS_GEN[a.m - 1]} — ${String(b.d).padStart(2, "0")} ${MONTHS_GEN[b.m - 1]} ${b.y}`;
}

function formatOpDate(iso: string): string {
  const { d, m, y } = parseIso(iso.slice(0, 10));
  const short = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return `${String(d).padStart(2, "0")} ${short[m - 1]} ${y}`;
}

function operationTitle(tx: FinanceDashboardDto["recentTransactions"][number]): string {
  if (tx.description?.trim()) return tx.description.trim();
  if (tx.category === "OPERATOR_COMMISSION" && tx.signedAmount > 0) return "Получена комиссия";
  return tx.categoryLabel || "Операция";
}

function granularityLabel(g: FinanceDashboardDto["timelineGranularity"]) {
  if (g === "day") return "По дням";
  if (g === "week") return "По неделям";
  return "По месяцам";
}

export function FinanceDashboardView({
  initialData,
  properties,
  photoByPropertyId = {},
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [profitDrill, setProfitDrill] = useState<DrillState>({ kind: "profit", level: 1 });
  const [expenseDrill, setExpenseDrill] = useState<DrillState>({ kind: "expense", level: 1 });
  const [profitSlices, setProfitSlices] = useState<DonutSlice[] | null>(null);
  const [expenseSlices, setExpenseSlices] = useState<DonutSlice[] | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [pendingCustom, setPendingCustom] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  const filters = initialData.filters;
  const periodValue = pendingCustom ? "custom" : filters.period;
  const showCustomDates = pendingCustom || filters.period === "custom";
  const filterQuery = useMemo(() => buildFilterQuery(filters), [filters]);

  const navigateWithFilters = useCallback(
    (next: Record<string, string>) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(next)) {
        if (value) params.set(key, value);
      }
      if (params.get("period") !== "custom") {
        params.delete("dateFrom");
        params.delete("dateTo");
      }
      const q = params.toString();
      startTransition(() => router.push(q ? `/crm/finance?${q}` : "/crm/finance"));
    },
    [router],
  );

  const currentFilterValues = useCallback(
    () => ({
      period: filters.period,
      propertyId: filters.propertyId ?? "",
      managementType: filters.managementType,
      segment: filters.segment,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    }),
    [filters],
  );

  function onFilterChange(name: string, value: string) {
    const base = currentFilterValues();
    if (name === "period") {
      if (value === "custom") {
        setPendingCustom(true);
        return;
      }
      setPendingCustom(false);
      navigateWithFilters({ ...base, period: value, dateFrom: "", dateTo: "" });
      return;
    }
    navigateWithFilters({ ...base, [name]: value });
  }

  function applyCustomDates(dateFrom: string, dateTo: string) {
    setPendingCustom(false);
    navigateWithFilters({ ...currentFilterValues(), period: "custom", dateFrom, dateTo });
  }

  const fetchDrilldown = useCallback(
    async (input: {
      kind: "profit" | "expense";
      segment: "SHORT_TERM" | "LONG_TERM" | "GENERAL";
      propertyId?: string;
      level?: "property" | "category";
    }) => {
      const params = new URLSearchParams({
        kind: input.kind,
        segment: input.segment,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        managementType: filters.managementType,
        level: input.level ?? "property",
      });
      if (filters.propertyId) params.set("propertyId", filters.propertyId);
      if (input.propertyId) params.set("propertyId", input.propertyId);
      const res = await fetch(`/api/finance/dashboard/drilldown?${params.toString()}`);
      if (!res.ok) return null;
      const body = (await res.json()) as { drilldown: { slices: DonutSlice[] } };
      return body.drilldown.slices;
    },
    [filters],
  );

  async function onProfitSliceClick(slice: DonutSlice) {
    if (profitDrill.level === 1) {
      setDrillLoading(true);
      const slices = await fetchDrilldown({
        kind: "profit",
        segment: slice.id as "SHORT_TERM" | "LONG_TERM" | "GENERAL",
      });
      setProfitSlices(slices);
      setProfitDrill({
        kind: "profit",
        level: 2,
        segment: slice.id as "SHORT_TERM" | "LONG_TERM" | "GENERAL",
      });
      setDrillLoading(false);
      return;
    }
    if (profitDrill.level === 2) {
      router.push(`/crm/finance/properties/${slice.id}${filterQuery}`);
    }
  }

  async function onExpenseSliceClick(slice: DonutSlice) {
    if (expenseDrill.level === 1) {
      setDrillLoading(true);
      const slices = await fetchDrilldown({
        kind: "expense",
        segment: slice.id as "SHORT_TERM" | "LONG_TERM" | "GENERAL",
      });
      setExpenseSlices(slices);
      setExpenseDrill({
        kind: "expense",
        level: 2,
        segment: slice.id as "SHORT_TERM" | "LONG_TERM" | "GENERAL",
      });
      setDrillLoading(false);
      return;
    }
    if (expenseDrill.level === 2 && expenseDrill.segment !== "GENERAL") {
      setDrillLoading(true);
      const slices = await fetchDrilldown({
        kind: "expense",
        segment: expenseDrill.segment!,
        propertyId: slice.id,
        level: "category",
      });
      setExpenseSlices(slices);
      setExpenseDrill({
        kind: "expense",
        level: 3,
        segment: expenseDrill.segment,
        propertyId: slice.id,
        propertyLabel: slice.label,
      });
      setDrillLoading(false);
      return;
    }
    if (expenseDrill.level === 3 && expenseDrill.propertyId) {
      router.push(`/crm/finance/properties/${expenseDrill.propertyId}${filterQuery}`);
    }
  }

  const profitChartSlices =
    profitDrill.level === 1 ? initialData.profitBySegment : (profitSlices ?? []);
  const expenseChartSlices =
    expenseDrill.level === 1 ? initialData.expensesBySegment : (expenseSlices ?? []);
  const profitCenterTotal = profitChartSlices.reduce((s, sl) => s + sl.amount, 0);
  const expenseCenterTotal = expenseChartSlices.reduce((s, sl) => s + sl.amount, 0);
  const commission = initialData.commissionSummary;
  const salesGap = !initialData.salesFinanceStatus.ready;

  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-bold leading-[1.15] tracking-tight text-[var(--finance-text)] sm:text-[32px]">
            Финансы
          </h1>
          <p className="mt-1 text-[15px] text-[var(--finance-text-secondary)]">
            Доходы, расходы и прибыль вашего бизнеса
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Экспорт отчёта пока недоступен"
          className="inline-flex h-10 items-center gap-2 rounded-[9px] border border-[#E1E7F0] bg-white px-3.5 text-[13px] font-medium text-[var(--finance-text-secondary)] opacity-60"
        >
          <IconDownload size={16} />
          Экспорт отчета
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FilterControl
          icon={<IconCalendar size={16} className="text-[var(--finance-text-muted)]" />}
          label="Период"
        >
          <select
            aria-label="Период"
            value={periodValue}
            disabled={pending}
            onChange={(e) => onFilterChange("period", e.target.value)}
            className="w-full appearance-none bg-transparent text-[13px] text-[var(--finance-text)] outline-none"
          >
            {FINANCE_PERIOD_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p === "month" && filters.period === "month"
                  ? formatPeriodLabel(filters.dateFrom, filters.dateTo, "month")
                  : PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
        </FilterControl>
        <FilterControl label="Объект">
          <select
            aria-label="Объект"
            value={filters.propertyId ?? ""}
            disabled={pending}
            onChange={(e) => onFilterChange("propertyId", e.target.value)}
            className="w-full appearance-none bg-transparent text-[13px] text-[var(--finance-text)] outline-none"
          >
            <option value="">Все объекты</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </FilterControl>
        <FilterControl label="Модель">
          <select
            aria-label="Модель управления"
            value={filters.managementType}
            disabled={pending}
            onChange={(e) => onFilterChange("managementType", e.target.value)}
            className="w-full appearance-none bg-transparent text-[13px] text-[var(--finance-text)] outline-none"
          >
            {FINANCE_MANAGEMENT_FILTERS.map((m) => (
              <option key={m} value={m}>
                {m === "ALL" ? "Все модели" : m === "OWN" ? "Собственные" : "Комиссия"}
              </option>
            ))}
          </select>
        </FilterControl>
        <FilterControl label="Направление">
          <select
            aria-label="Направление"
            value={filters.segment}
            disabled={pending}
            onChange={(e) => onFilterChange("segment", e.target.value)}
            className="w-full appearance-none bg-transparent text-[13px] text-[var(--finance-text)] outline-none"
          >
            {FINANCE_SEGMENTS.map((s) => (
              <option key={s} value={s}>
                {s === "ALL"
                  ? "Вся аренда и продажи"
                  : s === "SHORT_TERM"
                    ? "Посуточная"
                    : s === "LONG_TERM"
                      ? "Долгосрочная"
                      : "Продажи"}
              </option>
            ))}
          </select>
        </FilterControl>
      </div>

      {showCustomDates ? (
        <CustomDateRange
          key={`${filters.dateFrom}-${filters.dateTo}-${pendingCustom}`}
          defaultFrom={filters.dateFrom}
          defaultTo={filters.dateTo}
          pending={pending}
          onApply={applyCustomDates}
        />
      ) : null}

      {/* KPI */}
      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Оборот объектов"
          value={initialData.summary.grossRent}
          changePct={initialData.comparison.grossRentChangePct}
          available={initialData.comparison.available}
          description="Все поступления от аренды"
          icon={<IconWallet size={16} />}
          iconBg="bg-[#E9FAF4]"
          iconColor="text-[#12A87C]"
        />
        <KpiCard
          label="Моя выручка"
          value={initialData.summary.businessRevenue}
          changePct={initialData.comparison.businessRevenueChangePct}
          available={initialData.comparison.available}
          description="Реальный доход бизнеса"
          icon={<IconFolder size={16} />}
          iconBg="bg-[#EEF3FF]"
          iconColor="text-[#3977F6]"
        />
        <KpiCard
          label="Расходы"
          value={initialData.summary.totalExpenses}
          changePct={initialData.comparison.expensesChangePct}
          available={initialData.comparison.available}
          description="Операционные расходы"
          icon={<IconPiggy size={16} />}
          iconBg="bg-[#FFF0F4]"
          iconColor="text-[#F15179]"
          invertChange
        />
        <KpiCard
          label="Чистая прибыль"
          value={initialData.summary.netProfit}
          changePct={initialData.comparison.netProfitChangePct}
          available={initialData.comparison.available}
          description="После всех расходов"
          icon={<IconChart size={16} />}
          iconBg="bg-[#E9FAF4]"
          iconColor="text-[#119B81]"
          highlighted
        />
      </section>

      {/* Donuts */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AnalyticsDonutCard
          title="Чистая прибыль по направлениям"
          detailsHref={`/crm/finance/reports${filterQuery}`}
          breadcrumb={
            profitDrill.level > 1 ? (
              <DrillTrail
                crumbs={[
                  {
                    label: "Все направления",
                    onClick: () => {
                      setProfitDrill({ kind: "profit", level: 1 });
                      setProfitSlices(null);
                    },
                  },
                  profitDrill.segment
                    ? { label: SEGMENT_LABELS[profitDrill.segment] ?? profitDrill.segment }
                    : null,
                ]}
                onBack={() => {
                  setProfitDrill({ kind: "profit", level: 1 });
                  setProfitSlices(null);
                }}
                loading={drillLoading}
              />
            ) : null
          }
        >
          <DonutChart
            bare
            slices={profitChartSlices}
            centerValue={formatMoney(
              profitDrill.level === 1 ? initialData.summary.netProfit : profitCenterTotal,
            )}
            centerLabel="Чистая прибыль"
            onSliceClick={profitChartSlices.length ? onProfitSliceClick : undefined}
            emptyPlaceholder
            emptyMessage="За выбранный период прибыли нет"
            colorForSlice={profitSliceColor}
            strokeWidth={40}
            mutedLegend={
              salesGap && profitDrill.level === 1
                ? [{ label: "Продажи", detail: "Финансовая модель не подключена" }]
                : undefined
            }
          />
        </AnalyticsDonutCard>

        <AnalyticsDonutCard
          title="Расходы по направлениям"
          detailsHref={`/crm/finance/expenses${filterQuery}`}
          breadcrumb={
            expenseDrill.level > 1 ? (
              <DrillTrail
                crumbs={[
                  {
                    label: "Все направления",
                    onClick: () => {
                      setExpenseDrill({ kind: "expense", level: 1 });
                      setExpenseSlices(null);
                    },
                  },
                  expenseDrill.segment
                    ? { label: SEGMENT_LABELS[expenseDrill.segment] ?? expenseDrill.segment }
                    : null,
                  expenseDrill.propertyLabel ? { label: expenseDrill.propertyLabel } : null,
                ]}
                onBack={() => {
                  if (expenseDrill.level === 3) {
                    setExpenseDrill({
                      kind: "expense",
                      level: 2,
                      segment: expenseDrill.segment,
                    });
                    void fetchDrilldown({
                      kind: "expense",
                      segment: expenseDrill.segment!,
                    }).then((slices) => setExpenseSlices(slices));
                  } else {
                    setExpenseDrill({ kind: "expense", level: 1 });
                    setExpenseSlices(null);
                  }
                }}
                loading={drillLoading}
              />
            ) : null
          }
        >
          <DonutChart
            bare
            slices={expenseChartSlices}
            centerValue={formatMoney(
              expenseDrill.level === 1
                ? initialData.summary.totalExpenses
                : expenseCenterTotal,
            )}
            centerLabel="Всего расходов"
            onSliceClick={expenseChartSlices.length ? onExpenseSliceClick : undefined}
            emptyPlaceholder
            emptyMessage="За выбранный период расходов нет"
            colorForSlice={expenseSliceColor}
            strokeWidth={40}
          />
        </AnalyticsDonutCard>
      </section>

      <LineChart
        points={initialData.timeline}
        granularityLabel={granularityLabel(initialData.timelineGranularity)}
      />

      {/* Economics + Commissions */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <PropertyEconomicsTable
          rows={initialData.propertyEconomics}
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          segmentFilter={filters.segment}
          photoByPropertyId={photoByPropertyId}
          detailsHref={`/crm/finance/properties${filterQuery}`}
        />

        <section className="finance-card flex min-h-[300px] flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-[#EDF1F6] px-4 py-3">
            <h3 className="text-[16px] font-bold text-[var(--finance-text)]">
              Комиссии к получению
            </h3>
            <Link
              href={`/crm/finance/commissions${filterQuery}`}
              className="text-[12px] font-medium text-[var(--finance-blue)] hover:underline"
            >
              Смотреть все →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
            <MiniKpi label="Начислено" value={commission.accrued} tone="neutral" />
            <MiniKpi label="Получено" value={commission.received} tone="green" />
            <MiniKpi label="К получению" value={commission.receivable} tone="amber" />
            <MiniKpi label="Переплата" value={commission.overpayment} tone="neutral" />
          </div>
          <div className="flex-1 overflow-x-auto px-2 pb-2">
            <table className="min-w-full text-left text-[12.5px]">
              <thead className="text-[11px] text-[var(--finance-text-muted)]">
                <tr className="border-b border-[#EDF1F6]">
                  <th className="px-2 py-2 font-medium">Объект</th>
                  <th className="px-2 py-2 font-medium">Ставка</th>
                  <th className="px-2 py-2 font-medium">Начислено</th>
                  <th className="px-2 py-2 font-medium">Получено</th>
                  <th className="px-2 py-2 font-medium">К получению</th>
                </tr>
              </thead>
              <tbody>
                {commission.byProperty.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-8 text-center text-[var(--finance-text-muted)]">
                      Нет комиссий за период
                    </td>
                  </tr>
                ) : (
                  commission.byProperty.slice(0, 6).map((row) => {
                    const photo = photoByPropertyId[row.propertyId];
                    const rate =
                      row.rateDaily != null
                        ? `${Math.round(row.rateDaily)}%`
                        : row.rateMonthly != null
                          ? `${Math.round(row.rateMonthly)}%`
                          : "—";
                    return (
                      <tr key={row.propertyId} className="h-10 border-b border-[#EDF1F6]">
                        <td className="max-w-[140px] px-2 py-1.5">
                          <Link
                            href={`/crm/finance/properties/${row.propertyId}${filterQuery}`}
                            className="flex items-center gap-2 hover:underline"
                          >
                            {photo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={photo} alt="" className="h-6 w-6 rounded-[5px] object-cover" />
                            ) : (
                              <span className="inline-block h-6 w-6 rounded-[5px] bg-[#E8EEF6]" />
                            )}
                            <span className="truncate text-[var(--finance-text)]">{row.name}</span>
                          </Link>
                        </td>
                        <td className="px-2 py-1.5 tabular-nums text-[var(--finance-text-secondary)]">
                          {rate}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums">{formatMoney(row.accrued)}</td>
                        <td className="px-2 py-1.5 tabular-nums">{formatMoney(row.received)}</td>
                        <td
                          className={`px-2 py-1.5 tabular-nums font-medium ${
                            row.receivable > 0 ? "text-[#E35D6A]" : "text-[var(--finance-text-muted)]"
                          }`}
                        >
                          {formatMoney(row.receivable)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      {/* Operations + Expense structure */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="finance-card flex min-h-[300px] flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-[#EDF1F6] px-4 py-3">
            <h3 className="text-[16px] font-bold text-[var(--finance-text)]">
              Последние финансовые операции
            </h3>
            <Link
              href={`/crm/finance/operations${filterQuery}`}
              className="text-[12px] font-medium text-[var(--finance-blue)] hover:underline"
            >
              Смотреть все →
            </Link>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="min-w-full text-left text-[12.5px]">
              <thead className="text-[11px] text-[var(--finance-text-muted)]">
                <tr className="border-b border-[#EDF1F6]">
                  <th className="px-3 py-2 font-medium">Дата</th>
                  <th className="px-3 py-2 font-medium">Описание</th>
                  <th className="px-3 py-2 font-medium">Объект</th>
                  <th className="px-3 py-2 font-medium">Категория</th>
                  <th className="px-3 py-2 font-medium">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {initialData.recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-[var(--finance-text-muted)]">
                      Нет операций
                    </td>
                  </tr>
                ) : (
                  initialData.recentTransactions.slice(0, 8).map((tx) => (
                    <tr key={tx.id} className="h-10 border-b border-[#EDF1F6]">
                      <td className="whitespace-nowrap px-3 py-1.5 text-[var(--finance-text-muted)]">
                        {formatOpDate(tx.occurredAt)}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="text-[var(--finance-text)]">{operationTitle(tx)}</span>
                        {tx.economicRole === "PASS_THROUGH" ? (
                          <span className="ml-1.5 inline-flex rounded-[5px] bg-[#F1F4F9] px-1.5 py-0.5 text-[10px] font-medium text-[var(--finance-text-muted)]">
                            Транзит
                          </span>
                        ) : null}
                      </td>
                      <td className="max-w-[120px] truncate px-3 py-1.5 text-[var(--finance-text-secondary)]">
                        {tx.propertyName ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 text-[var(--finance-text-muted)]">
                        {tx.categoryLabel}
                      </td>
                      <td
                        className={`px-3 py-1.5 font-semibold tabular-nums ${
                          tx.signedAmount < 0
                            ? "text-[#EF4E62]"
                            : tx.signedAmount > 0
                              ? "text-[#079B73]"
                              : "text-[var(--finance-text-muted)]"
                        }`}
                      >
                        {tx.signedAmount < 0 ? "−" : tx.signedAmount > 0 ? "+" : ""}
                        {formatMoney(Math.abs(tx.amount))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[#EDF1F6] px-4 py-3">
            <button
              type="button"
              onClick={() => setShowExpenseForm(true)}
              className="mx-auto flex h-10 w-full max-w-xs items-center justify-center gap-2 rounded-lg border border-[#DCE4EF] bg-white text-[13px] font-medium text-[var(--finance-text)] hover:bg-[var(--finance-hover)]"
            >
              <IconPlus size={16} />
              Добавить расход
            </button>
          </div>
        </section>

        <section className="finance-card flex min-h-[300px] flex-col p-4">
          <h3 className="mb-3 text-[16px] font-bold text-[var(--finance-text)]">
            Структура расходов
          </h3>
          <DonutChart
            bare
            slices={initialData.expenseCategories}
            centerValue={formatMoney(initialData.summary.totalExpenses)}
            centerLabel="Всего расходов"
            emptyPlaceholder
            emptyMessage="Нет расходов за выбранный период"
            colorForSlice={expenseSliceColor}
            strokeWidth={36}
            diameter={180}
            showPercentsInSectors={false}
          />
        </section>
      </section>

      {showExpenseForm ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#101B3A]/30 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expense-form-title"
          onClick={() => setShowExpenseForm(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[var(--finance-border)] bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 id="expense-form-title" className="text-[16px] font-bold text-[var(--finance-text)]">
                Добавить расход
              </h2>
              <button
                type="button"
                onClick={() => setShowExpenseForm(false)}
                className="rounded-md px-2 py-1 text-[13px] text-[var(--finance-text-muted)] hover:bg-[var(--finance-hover)]"
              >
                Закрыть
              </button>
            </div>
            <ExpenseQuickForm
              properties={properties}
              defaultPropertyId={filters.propertyId ?? undefined}
              embedded
              onSuccess={() => setShowExpenseForm(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildFilterQuery(filters: FinanceDashboardDto["filters"]) {
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

function FilterControl({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="relative flex h-11 items-center gap-2 rounded-lg border border-[#DFE6F0] bg-white px-3">
      <span className="sr-only">{label}</span>
      {icon}
      <span className="min-w-0 flex-1">{children}</span>
      <IconChevronDown className="pointer-events-none shrink-0 text-[var(--finance-text-muted)]" />
    </label>
  );
}

function CustomDateRange({
  defaultFrom,
  defaultTo,
  pending,
  onApply,
}: {
  defaultFrom: string;
  defaultTo: string;
  pending: boolean;
  onApply: (from: string, to: string) => void;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-[13px]">
        <span className="mb-1 block text-[11px] text-[var(--finance-text-muted)]">С</span>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-10 rounded-lg border border-[#DFE6F0] bg-white px-2 text-[13px]"
        />
      </label>
      <label className="text-[13px]">
        <span className="mb-1 block text-[11px] text-[var(--finance-text-muted)]">По</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-10 rounded-lg border border-[#DFE6F0] bg-white px-2 text-[13px]"
        />
      </label>
      <button
        type="button"
        disabled={pending || !from || !to}
        onClick={() => onApply(from, to)}
        className="h-10 rounded-lg bg-[var(--finance-text)] px-3 text-[13px] font-medium text-white disabled:opacity-60"
      >
        Применить
      </button>
    </div>
  );
}

function KpiCard({
  label,
  value,
  changePct,
  available,
  description,
  icon,
  iconBg,
  iconColor,
  highlighted,
  invertChange,
}: {
  label: string;
  value: number;
  changePct: number | null;
  available: boolean;
  description: string;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  highlighted?: boolean;
  invertChange?: boolean;
}) {
  const positive = invertChange ? (changePct ?? 0) < 0 : (changePct ?? 0) > 0;
  const negative = invertChange ? (changePct ?? 0) > 0 : (changePct ?? 0) < 0;
  const changeColor = positive
    ? "text-[#079B73]"
    : negative
      ? "text-[#F04452]"
      : "text-[var(--finance-text-muted)]";

  return (
    <div
      className={`finance-card flex h-[134px] flex-col p-4 ${
        highlighted
          ? "border-[#D6F1E5] bg-gradient-to-br from-[#F4FCF8] to-[#EAF9F2]"
          : ""
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}
        >
          {icon}
        </span>
        <span className="text-[13px] font-medium text-[#263653]">{label}</span>
      </div>
      <div className="mt-3.5 flex items-baseline gap-2">
        <span className="text-[28px] font-bold leading-none tabular-nums tracking-tight text-[var(--finance-text)]">
          {formatMoney(value)}
        </span>
        {available && changePct != null ? (
          <span className={`text-[12px] font-semibold ${changeColor}`}>
            {changePct > 0 ? "↑ +" : changePct < 0 ? "↓ " : ""}
            {changePct === 0 ? "0%" : `${Math.abs(changePct)}%`}
          </span>
        ) : null}
      </div>
      <p className="mt-auto pt-2 text-[11px] text-[var(--finance-text-muted)]">{description}</p>
    </div>
  );
}

function MiniKpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "green" | "amber";
}) {
  const bg =
    tone === "green" ? "bg-[#EFFAF5]" : tone === "amber" ? "bg-[#FFF8EA]" : "bg-[#F7F9FC]";
  return (
    <div className={`rounded-lg px-2.5 py-2 ${bg}`}>
      <p className="text-[11px] text-[var(--finance-text-muted)]">{label}</p>
      <p className="mt-0.5 text-[17px] font-bold tabular-nums text-[var(--finance-text)]">
        {formatMoney(value)}
      </p>
    </div>
  );
}

function AnalyticsDonutCard({
  title,
  detailsHref,
  breadcrumb,
  children,
}: {
  title: string;
  detailsHref: string;
  breadcrumb?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="finance-card flex min-h-[310px] flex-col p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[16px] font-bold text-[var(--finance-text)]">{title}</h3>
          {breadcrumb}
        </div>
        <Link
          href={detailsHref}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-[#276EF1] hover:underline"
        >
          Смотреть детали →
        </Link>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function DrillTrail({
  crumbs,
  onBack,
  loading,
}: {
  crumbs: Array<{ label: string; onClick?: () => void } | null>;
  onBack?: () => void;
  loading?: boolean;
}) {
  const items = crumbs.filter(Boolean) as Array<{ label: string; onClick?: () => void }>;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-[var(--finance-text-muted)]">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="mr-1 rounded px-1 py-0.5 font-medium text-[var(--finance-text-secondary)] hover:bg-[var(--finance-hover)]"
        >
          ← Назад
        </button>
      ) : null}
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 ? <span>›</span> : null}
          {item.onClick && i < items.length - 1 ? (
            <button type="button" onClick={item.onClick} className="hover:underline">
              {item.label}
            </button>
          ) : (
            <span className={i === items.length - 1 ? "text-[var(--finance-text-secondary)]" : undefined}>
              {item.label}
            </span>
          )}
        </span>
      ))}
      {loading ? <span>…</span> : null}
    </div>
  );
}
