"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EXPENSE_CATEGORIES, financialCategoryLabels } from "@/lib/finance";

type PropertyOption = { id: string; name: string };

type Props = {
  properties: PropertyOption[];
  defaultPropertyId?: string;
  /** Hide outer card chrome when embedded in a panel/modal. */
  embedded?: boolean;
  onSuccess?: () => void;
};

export function ExpenseQuickForm({
  properties,
  defaultPropertyId,
  embedded = false,
  onSuccess,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    propertyId: defaultPropertyId || properties[0]?.id || "__none__",
    amount: "",
    category: "CLEANING",
    expenseResponsibility: "OPERATOR",
    occurredAt: new Date().toISOString().slice(0, 10),
    description: "",
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/finance/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: form.propertyId === "__none__" ? null : form.propertyId,
        amount: Number(form.amount),
        category: form.category,
        expenseResponsibility: form.expenseResponsibility,
        occurredAt: form.occurredAt,
        description: form.description || null,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error || "Не удалось создать расход");
      return;
    }
    setForm((s) => ({ ...s, amount: "", description: "" }));
    onSuccess?.();
    startTransition(() => router.refresh());
  }

  return (
    <form
      onSubmit={submit}
      className={
        embedded
          ? "space-y-3"
          : "space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
      }
    >
      {embedded ? null : <h2 className="text-sm font-semibold">Добавить расход</h2>}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Объект</span>
        <select
          value={form.propertyId}
          onChange={(e) => setForm((s) => ({ ...s, propertyId: e.target.value }))}
          className="w-full rounded-lg border border-zinc-300 px-2 py-1.5"
        >
          <option value="__none__">Общий расход</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Сумма, ₽</span>
        <input
          type="number"
          min={1}
          step={1}
          required
          value={form.amount}
          onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
          className="w-full rounded-lg border border-zinc-300 px-2 py-1.5"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Категория</span>
        <select
          value={form.category}
          onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
          className="w-full rounded-lg border border-zinc-300 px-2 py-1.5"
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {financialCategoryLabels[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Дата</span>
        <input
          type="date"
          required
          value={form.occurredAt}
          onChange={(e) => setForm((s) => ({ ...s, occurredAt: e.target.value }))}
          className="w-full rounded-lg border border-zinc-300 px-2 py-1.5"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        Сохранить
      </button>
    </form>
  );
}
