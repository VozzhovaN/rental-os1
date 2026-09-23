"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OwnerBalance } from "@/lib/finance";
import { formatMoney } from "@/lib/property-labels";

export type OwnerListItem = {
  id: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  propertiesCount: number;
  balance: OwnerBalance;
};

export function OwnersList({ owners }: { owners: OwnerListItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({ name: "", phone: "" });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return owners;
    return owners.filter(
      (o) =>
        o.name.toLowerCase().includes(needle) ||
        (o.phone ?? "").toLowerCase().includes(needle),
    );
  }, [owners, q]);

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/owners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: createForm.name.trim(),
        phone: createForm.phone.trim() || null,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error || "Не удалось создать собственника");
      return;
    }
    setShowCreate(false);
    setCreateForm({ name: "", phone: "" });
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск: имя, телефон"
          className="w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Новый собственник
        </button>
      </div>

      {showCreate ? (
        <form
          onSubmit={submitCreate}
          className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 max-w-md"
        >
          <h2 className="text-sm font-semibold">Новый собственник</h2>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600">Имя</span>
            <input
              required
              value={createForm.name}
              onChange={(e) => setCreateForm((s) => ({ ...s, name: e.target.value }))}
              className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600">Телефон</span>
            <input
              value={createForm.phone}
              onChange={(e) => setCreateForm((s) => ({ ...s, phone: e.target.value }))}
              className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
            >
              Создать
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
            >
              Отмена
            </button>
          </div>
        </form>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-zinc-600">
          {owners.length === 0
            ? "Собственников пока нет. Добавьте первого."
            : "По запросу ничего не найдено."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Собственник</th>
                <th className="px-3 py-2 font-medium">Объектов</th>
                <th className="px-3 py-2 font-medium">Доля (кратк.+долг.)</th>
                <th className="px-3 py-2 font-medium">Расходы</th>
                <th className="px-3 py-2 font-medium">Выплаты</th>
                <th className="px-3 py-2 font-medium">К выплате</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((owner) => (
                <tr key={owner.id} className="border-t border-zinc-100">
                  <td className="px-3 py-3">
                    <div className="font-medium">{owner.name}</div>
                    {!owner.isActive ? (
                      <span className="text-xs text-zinc-500">неактивен</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">{owner.propertiesCount}</td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatMoney(owner.balance.ownerShareTotal)}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatMoney(owner.balance.ownerExpenses)}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatMoney(owner.balance.ownerPayouts)}
                  </td>
                  <td className="px-3 py-3 tabular-nums font-medium">
                    {formatMoney(owner.balance.balanceDue)}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/crm/finance/owners/${owner.id}`}
                      className="rounded-md border border-zinc-200 px-2 py-1 text-xs"
                    >
                      Открыть
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
