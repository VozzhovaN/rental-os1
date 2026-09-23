"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/property-labels";
import { CommissionPaymentForm } from "@/components/finance/commission-payment-form";
import {
  EXPENSE_CATEGORIES,
  financialCategoryLabels,
  financialTypeLabels,
  type SerializedFinancialTransaction,
  type FinanceSummary,
} from "@/lib/finance";

type PropertyOption = { id: string; name: string };

type Props = {
  initialTransactions: SerializedFinancialTransaction[];
  initialSummary: FinanceSummary;
  properties: PropertyOption[];
  filters: {
    propertyId?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
  };
  basePath?: string;
};

export function FinanceView({
  initialTransactions,
  initialSummary,
  properties,
  filters,
  basePath = "/crm/finance/operations",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    propertyId: filters.propertyId || properties[0]?.id || "__none__",
    amount: "",
    category: "CLEANING",
    expenseResponsibility: "OPERATOR",
    occurredAt: new Date().toISOString().slice(0, 10),
    description: "",
  });
  const [adjustmentForm, setAdjustmentForm] = useState({
    propertyId: filters.propertyId || properties[0]?.id || "",
    amount: "",
    direction: "DEBIT",
    occurredAt: new Date().toISOString().slice(0, 10),
    description: "",
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.propertyId) params.set("propertyId", filters.propertyId);
    if (filters.type) params.set("type", filters.type);
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
    const q = params.toString();
    return q ? `?${q}` : "";
  }, [filters]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const key of ["propertyId", "type", "dateFrom", "dateTo"] as const) {
      const value = String(form.get(key) ?? "").trim();
      if (value) params.set(key, value);
    }
    const q = params.toString();
    router.push(q ? `${basePath}?${q}` : basePath);
  }

  async function submitExpense(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/finance/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: expenseForm.propertyId === "__none__" ? null : expenseForm.propertyId,
        amount: Number(expenseForm.amount),
        category: expenseForm.category,
        expenseResponsibility: expenseForm.expenseResponsibility,
        occurredAt: expenseForm.occurredAt,
        description: expenseForm.description || null,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error || "Не удалось создать расход");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function submitAdjustment(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/finance/adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: adjustmentForm.propertyId,
        amount: Number(adjustmentForm.amount),
        direction: adjustmentForm.direction,
        occurredAt: adjustmentForm.occurredAt,
        description: adjustmentForm.description,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error || "Не удалось создать корректировку");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Операции</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Журнал финансовых операций, расходы и корректировки.
          </p>
        </div>
        <Link
          href="/crm/finance"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Обзор
        </Link>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Выручка бизнеса" value={initialSummary.businessRevenue} highlight />
        <SummaryCard label="Расходы оператора" value={initialSummary.totalOperatorExpenses} />
        <SummaryCard label="Чистая прибыль" value={initialSummary.netProfit} highlight />
        <SummaryCard label="Валовая аренда" value={initialSummary.grossRent} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Доходы (касса)" value={initialSummary.incomeTotal} />
        <SummaryCard label="Расходы (касса)" value={initialSummary.expenseTotal} />
        <SummaryCard label="Комиссия получена" value={initialSummary.commissionReceived} />
        <SummaryCard label="Комиссия начислена" value={initialSummary.commissionAccrued} />
        <SummaryCard label="Движение денег (нетто)" value={initialSummary.netCashMovement} />
      </section>

      <form
        onSubmit={applyFilters}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4"
      >
        <FilterField label="Объект" name="propertyId" defaultValue={filters.propertyId ?? ""}>
          <option value="">Все</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </FilterField>
        <FilterField label="Тип" name="type" defaultValue={filters.type ?? ""}>
          <option value="">Все</option>
          {Object.entries(financialTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </FilterField>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">С</span>
          <input
            type="date"
            name="dateFrom"
            defaultValue={filters.dateFrom ?? ""}
            className="rounded-md border border-zinc-300 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">По</span>
          <input
            type="date"
            name="dateTo"
            defaultValue={filters.dateTo ?? ""}
            className="rounded-md border border-zinc-300 px-2 py-1.5"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Применить
        </button>
        <a href={`${basePath}${queryString}`} className="sr-only">
          refresh
        </a>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={submitExpense} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Добавить расход</h2>
          <Select
            label="Объект (необязательно)"
            value={expenseForm.propertyId}
            onChange={(value) => setExpenseForm((s) => ({ ...s, propertyId: value }))}
            options={[
              { value: "__none__", label: "Общий расход" },
              ...properties.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
          {filters.propertyId ? (
            <a
              href={`/crm/finance/properties/${filters.propertyId}`}
              className="text-sm text-zinc-600 underline hover:text-zinc-900"
            >
              Экономика объекта →
            </a>
          ) : null}
          <Input
            label="Сумма, ₽"
            type="number"
            min={1}
            step={1}
            value={expenseForm.amount}
            onChange={(value) => setExpenseForm((s) => ({ ...s, amount: value }))}
            required
          />
          <Select
            label="Категория"
            value={expenseForm.category}
            onChange={(value) => setExpenseForm((s) => ({ ...s, category: value }))}
            options={EXPENSE_CATEGORIES.map((c) => ({
              value: c,
              label: financialCategoryLabels[c],
            }))}
          />
          <Select
            label="За чей счёт?"
            value={expenseForm.expenseResponsibility}
            onChange={(value) => setExpenseForm((s) => ({ ...s, expenseResponsibility: value }))}
            options={[
              { value: "OPERATOR", label: "Оператор" },
              { value: "OWNER", label: "Собственник" },
            ]}
          />
          <Input
            label="Дата"
            type="date"
            value={expenseForm.occurredAt}
            onChange={(value) => setExpenseForm((s) => ({ ...s, occurredAt: value }))}
            required
          />
          <Input
            label="Описание"
            value={expenseForm.description}
            onChange={(value) => setExpenseForm((s) => ({ ...s, description: value }))}
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Сохранить расход
          </button>
        </form>

        <form
          onSubmit={submitAdjustment}
          className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4"
        >
          <h2 className="text-sm font-semibold">Добавить корректировку</h2>
          <Select
            label="Объект"
            value={adjustmentForm.propertyId}
            onChange={(value) => setAdjustmentForm((s) => ({ ...s, propertyId: value }))}
            options={properties.map((p) => ({ value: p.id, label: p.name }))}
          />
          <Input
            label="Сумма, ₽"
            type="number"
            min={1}
            step={1}
            value={adjustmentForm.amount}
            onChange={(value) => setAdjustmentForm((s) => ({ ...s, amount: value }))}
            required
          />
          <Select
            label="Направление"
            value={adjustmentForm.direction}
            onChange={(value) => setAdjustmentForm((s) => ({ ...s, direction: value }))}
            options={[
              { value: "CREDIT", label: "Увеличение (CREDIT)" },
              { value: "DEBIT", label: "Уменьшение (DEBIT)" },
            ]}
          />
          <Input
            label="Дата"
            type="date"
            value={adjustmentForm.occurredAt}
            onChange={(value) => setAdjustmentForm((s) => ({ ...s, occurredAt: value }))}
            required
          />
          <Input
            label="Причина"
            value={adjustmentForm.description}
            onChange={(value) => setAdjustmentForm((s) => ({ ...s, description: value }))}
            required
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            Сохранить корректировку
          </button>
        </form>

        <CommissionPaymentForm properties={properties} defaultPropertyId={filters.propertyId} />
      </div>

      <section className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-3 py-2 font-medium">Дата</th>
              <th className="px-3 py-2 font-medium">Объект</th>
              <th className="px-3 py-2 font-medium">Тип</th>
              <th className="px-3 py-2 font-medium">Категория</th>
              <th className="px-3 py-2 font-medium">Сумма</th>
              <th className="px-3 py-2 font-medium">Описание</th>
              <th className="px-3 py-2 font-medium">Связь</th>
            </tr>
          </thead>
          <tbody>
            {initialTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                  Записей пока нет
                </td>
              </tr>
            ) : (
              initialTransactions.map((tx) => (
                <tr key={tx.id} className="border-b border-zinc-100">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {tx.occurredAt.slice(0, 10)}
                  </td>
                  <td className="px-3 py-2">{tx.propertyName ?? "—"}</td>
                  <td className="px-3 py-2">{financialTypeLabels[tx.type]}</td>
                  <td className="px-3 py-2">{financialCategoryLabels[tx.category]}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {tx.signedAmount < 0 ? "−" : ""}
                    {formatMoney(Math.abs(tx.amount))}
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{tx.description || "—"}</td>
                  <td className="px-3 py-2">
                    {tx.bookingId ? (
                      <a
                        href={`/crm/bookings/${tx.bookingId}`}
                        className="text-zinc-700 underline hover:text-zinc-900"
                      >
                        Бронь
                      </a>
                    ) : tx.longTermContractId ? (
                      <a
                        href={`/crm/long-term/contracts/${tx.longTermContractId}`}
                        className="text-zinc-700 underline hover:text-zinc-900"
                      >
                        Договор
                      </a>
                    ) : tx.ownerId ? (
                      <a
                        href={`/crm/finance/owners/${tx.ownerId}`}
                        className="text-zinc-700 underline hover:text-zinc-900"
                      >
                        {tx.type === "OWNER_PAYOUT" ? "Выплата" : "Собственник"}
                      </a>
                    ) : (
                      "—"
                    )}
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
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        highlight ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 bg-white"
      }`}
    >
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{formatMoney(value)}</p>
    </div>
  );
}

function FilterField({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue: string;
  children: ReactNode;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-zinc-600">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="rounded-md border border-zinc-300 px-2 py-1.5"
      >
        {children}
      </select>
    </label>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required,
  min,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  min?: number;
  step?: number;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-zinc-600">{label}</span>
      <input
        type={type}
        value={value}
        min={min}
        step={step}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-zinc-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
