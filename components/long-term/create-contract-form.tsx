"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; label: string };

type Prefill = {
  propertyId?: string;
  longTermListingId?: string;
  monthlyRent?: number;
  depositAmount?: number;
  paymentDay?: number;
};

export function CreateContractForm({
  properties,
  guests,
  prefill,
}: {
  properties: Option[];
  guests: Option[];
  prefill?: Prefill;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    propertyId: prefill?.propertyId || properties[0]?.id || "",
    longTermListingId: prefill?.longTermListingId || "",
    guestId: guests[0]?.id || "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
    monthlyRent: String(prefill?.monthlyRent ?? ""),
    depositAmount: String(prefill?.depositAmount ?? 0),
    paymentDay: String(prefill?.paymentDay ?? 5),
    notes: "",
    activate: false,
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const response = await fetch("/api/long-term-contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: form.propertyId,
        longTermListingId: form.longTermListingId || null,
        guestId: form.guestId,
        startDate: form.startDate,
        endDate: form.endDate || null,
        monthlyRent: Number(form.monthlyRent),
        depositAmount: Number(form.depositAmount),
        paymentDay: Number(form.paymentDay),
        notes: form.notes || null,
        status: form.activate ? "ACTIVE" : "DRAFT",
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error || "Не удалось создать договор");
      return;
    }
    const data = (await response.json()) as { contract: { id: string } };
    startTransition(() => router.push(`/crm/long-term/contracts/${data.contract.id}`));
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-4 rounded-xl border bg-white p-5">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Объект</span>
        <select
          required
          value={form.propertyId}
          onChange={(e) => setForm((s) => ({ ...s, propertyId: e.target.value }))}
          className="w-full rounded-md border px-2 py-1.5"
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Арендатор (гость)</span>
        <select
          required
          value={form.guestId}
          onChange={(e) => setForm((s) => ({ ...s, guestId: e.target.value }))}
          className="w-full rounded-md border px-2 py-1.5"
        >
          {guests.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Дата начала</span>
        <input
          type="date"
          required
          value={form.startDate}
          onChange={(e) => setForm((s) => ({ ...s, startDate: e.target.value }))}
          className="w-full rounded-md border px-2 py-1.5"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Месячная ставка, ₽</span>
        <input
          type="number"
          min={1}
          required
          value={form.monthlyRent}
          onChange={(e) => setForm((s) => ({ ...s, monthlyRent: e.target.value }))}
          className="w-full rounded-md border px-2 py-1.5"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Депозит, ₽</span>
        <input
          type="number"
          min={0}
          value={form.depositAmount}
          onChange={(e) => setForm((s) => ({ ...s, depositAmount: e.target.value }))}
          className="w-full rounded-md border px-2 py-1.5"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">День платежа (1–28)</span>
        <input
          type="number"
          min={1}
          max={28}
          required
          value={form.paymentDay}
          onChange={(e) => setForm((s) => ({ ...s, paymentDay: e.target.value }))}
          className="w-full rounded-md border px-2 py-1.5"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.activate}
          onChange={(e) => setForm((s) => ({ ...s, activate: e.target.checked }))}
        />
        Создать сразу ACTIVE (иначе DRAFT)
      </label>
      <p className="text-xs text-zinc-500">
        Комиссия фиксируется с Property.commissionMonthly при создании. Изменение объявления не
        меняет ставку договора.
      </p>
      <button
        type="submit"
        disabled={pending || !form.guestId}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Создать договор
      </button>
    </form>
  );
}
