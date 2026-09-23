"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type PropertyOption = { id: string; name: string };

type Props = {
  properties: PropertyOption[];
  defaultPropertyId?: string;
  bookingId?: string;
  longTermContractId?: string;
};

export function CommissionPaymentForm({
  properties,
  defaultPropertyId,
  bookingId,
  longTermContractId,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<"booking" | "contract">("booking");
  const [form, setForm] = useState({
    propertyId: defaultPropertyId || properties[0]?.id || "",
    linkId: "",
    amount: "",
    paidAt: new Date().toISOString().slice(0, 10),
    method: "",
    note: "",
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/commission-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: form.propertyId,
        amount: Number(form.amount),
        paidAt: form.paidAt,
        method: form.method || null,
        note: form.note || null,
        bookingId:
          bookingId ?? (linkType === "booking" && form.linkId ? form.linkId : null),
        longTermContractId:
          longTermContractId ??
          (linkType === "contract" && form.linkId ? form.linkId : null),
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error || "Не удалось записать платёж комиссии");
      return;
    }
    setForm((s) => ({ ...s, amount: "", method: "", note: "" }));
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold">Платёж комиссии от собственника</h2>
      {!bookingId && !longTermContractId ? (
        <div className="space-y-2 text-sm">
          <span className="block text-zinc-600">Привязка</span>
          <div className="flex gap-3">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={linkType === "booking"}
                onChange={() => setLinkType("booking")}
              />
              Бронь
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={linkType === "contract"}
                onChange={() => setLinkType("contract")}
              />
              Договор
            </label>
          </div>
          <input
            required
            value={form.linkId}
            onChange={(e) => setForm((s) => ({ ...s, linkId: e.target.value }))}
            placeholder="ID брони или договора"
            className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
          />
        </div>
      ) : null}
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Объект</span>
        <select
          value={form.propertyId}
          onChange={(e) => setForm((s) => ({ ...s, propertyId: e.target.value }))}
          className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
          required
          disabled={Boolean(defaultPropertyId)}
        >
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
          className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Дата</span>
        <input
          type="date"
          required
          value={form.paidAt}
          onChange={(e) => setForm((s) => ({ ...s, paidAt: e.target.value }))}
          className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Метод</span>
        <input
          value={form.method}
          onChange={(e) => setForm((s) => ({ ...s, method: e.target.value }))}
          className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-600">Комментарий</span>
        <input
          value={form.note}
          onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))}
          className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        Сохранить
      </button>
    </form>
  );
}
