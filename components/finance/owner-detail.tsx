"use client";

import Link from "next/link";
import { FormEvent, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { OwnerBalance, SerializedFinancialTransaction } from "@/lib/finance";
import {
  financialCategoryLabels,
  financialTypeLabels,
} from "@/lib/finance";
import { formatMoney, managementTypeLabels } from "@/lib/property-labels";
import type { ManagementType } from "@prisma/client";

type PropertyRow = {
  id: string;
  name: string;
  managementType: string;
  city: string;
  status: string;
};

type PayoutRow = {
  id: string;
  amount: number;
  paidAt: string;
  method: string | null;
  note: string | null;
  allocations: Array<{
    id: string;
    amount: number;
    property: { id: string; name: string };
  }>;
};

type SettlementRow = {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  notes: string | null;
  closedAt: string | null;
};

type OwnerInfo = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean;
  properties: PropertyRow[];
};

type Props = {
  owner: OwnerInfo;
  balance: OwnerBalance;
  payouts: PayoutRow[];
  settlements: SettlementRow[];
  transactions: SerializedFinancialTransaction[];
};

export function OwnerDetail({
  owner,
  balance,
  payouts,
  settlements,
  transactions,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [showPayout, setShowPayout] = useState(false);

  const commissionProperties = owner.properties.filter((p) => p.managementType === "COMMISSION");

  const [payoutForm, setPayoutForm] = useState({
    amount: "",
    paidAt: new Date().toISOString().slice(0, 10),
    method: "",
    note: "",
    allocations: Object.fromEntries(commissionProperties.map((p) => [p.id, ""])),
  });

  async function submitPayout(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setWarning(null);

    const amount = Number(payoutForm.amount);
    const allocations = commissionProperties
      .map((p) => ({
        propertyId: p.id,
        amount: Number(payoutForm.allocations[p.id] || 0),
      }))
      .filter((a) => a.amount > 0);

    if (amount > balance.balanceDue) {
      setWarning(
        `Сумма выплаты (${formatMoney(amount)}) превышает к выплате (${formatMoney(balance.balanceDue)}). Выплата будет сохранена.`,
      );
    }

    const response = await fetch(`/api/owners/${owner.id}/payouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        paidAt: payoutForm.paidAt,
        method: payoutForm.method || null,
        note: payoutForm.note || null,
        allocations,
      }),
    });

    const body = (await response.json().catch(() => null)) as {
      error?: string;
      exceedsWarning?: boolean;
    } | null;

    if (!response.ok) {
      setError(body?.error || "Не удалось создать выплату");
      return;
    }

    if (body?.exceedsWarning) {
      setWarning("Выплата сохранена, но сумма превышает текущий баланс к выплате.");
    }

    setShowPayout(false);
    setPayoutForm({
      amount: "",
      paidAt: new Date().toISOString().slice(0, 10),
      method: "",
      note: "",
      allocations: Object.fromEntries(commissionProperties.map((p) => [p.id, ""])),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{owner.name}</h1>
            {!owner.isActive ? (
              <span className="text-sm text-zinc-500">Неактивен</span>
            ) : null}
          </div>
          <p className="text-lg font-semibold tabular-nums">
            К выплате: {formatMoney(balance.balanceDue)}
          </p>
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Телефон" value={owner.phone || "—"} />
          <Stat label="Email" value={owner.email || "—"} />
          <Stat label="Доля посуточно" value={formatMoney(balance.shortTermOwnerShareOnPaid)} />
          <Stat label="Доля долгосрочно" value={formatMoney(balance.longTermOwnerShareOnPaid)} />
          <Stat label="Расходы собственника" value={formatMoney(balance.ownerExpenses)} />
          <Stat label="Выплаты" value={formatMoney(balance.ownerPayouts)} />
          <Stat label="Корректировки (нетто)" value={formatMoney(balance.ownerAdjustmentsNet)} />
        </dl>
        {owner.notes ? <p className="text-sm text-zinc-600">{owner.notes}</p> : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
        <h2 className="text-lg font-semibold">Объекты</h2>
        {owner.properties.length === 0 ? (
          <p className="text-sm text-zinc-500">Объектов нет</p>
        ) : (
          <ul className="divide-y divide-zinc-100 text-sm">
            {owner.properties.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {p.name}{" "}
                  <span className="text-zinc-500">
                    ({p.city},{" "}
                    {managementTypeLabels[p.managementType as ManagementType] ?? p.managementType})
                  </span>
                </span>
                <Link href={`/crm/properties/${p.id}`} className="text-xs underline">
                  Карточка
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
        <h2 className="text-lg font-semibold">Периоды расчёта</h2>
        {settlements.length === 0 ? (
          <p className="text-sm text-zinc-500">Периодов пока нет</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-zinc-500">
                <tr>
                  <th className="px-2 py-1 text-left font-medium">Период</th>
                  <th className="px-2 py-1 text-left font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s.id} className="border-t border-zinc-100">
                    <td className="px-2 py-2">
                      {s.periodStart.slice(0, 10)} — {s.periodEnd.slice(0, 10)}
                    </td>
                    <td className="px-2 py-2">{s.status === "CLOSED" ? "Закрыт" : "Черновик"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Выплаты</h2>
          <button
            type="button"
            disabled={commissionProperties.length === 0 || pending}
            onClick={() => setShowPayout((v) => !v)}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Выплатить собственнику
          </button>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {warning ? <p className="text-sm text-amber-800">{warning}</p> : null}
        {showPayout ? (
          <form onSubmit={submitPayout} className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Сумма, ₽">
                <input
                  type="number"
                  min={1}
                  required
                  value={payoutForm.amount}
                  onChange={(e) => setPayoutForm((s) => ({ ...s, amount: e.target.value }))}
                  className="w-full rounded-md border px-2 py-1.5"
                />
              </Field>
              <Field label="Дата">
                <input
                  type="date"
                  required
                  value={payoutForm.paidAt}
                  onChange={(e) => setPayoutForm((s) => ({ ...s, paidAt: e.target.value }))}
                  className="w-full rounded-md border px-2 py-1.5"
                />
              </Field>
              <Field label="Способ">
                <input
                  value={payoutForm.method}
                  onChange={(e) => setPayoutForm((s) => ({ ...s, method: e.target.value }))}
                  className="w-full rounded-md border px-2 py-1.5"
                />
              </Field>
              <Field label="Комментарий">
                <input
                  value={payoutForm.note}
                  onChange={(e) => setPayoutForm((s) => ({ ...s, note: e.target.value }))}
                  className="w-full rounded-md border px-2 py-1.5"
                />
              </Field>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-700">Распределение по объектам</p>
              {commissionProperties.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-40 truncate">{p.name}</span>
                  <input
                    type="number"
                    min={0}
                    value={payoutForm.allocations[p.id]}
                    onChange={(e) =>
                      setPayoutForm((s) => ({
                        ...s,
                        allocations: { ...s.allocations, [p.id]: e.target.value },
                      }))
                    }
                    className="w-32 rounded-md border px-2 py-1"
                  />
                  <span className="text-zinc-500">₽</span>
                </label>
              ))}
            </div>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-60"
            >
              Сохранить выплату
            </button>
          </form>
        ) : null}
        {payouts.length === 0 ? (
          <p className="text-sm text-zinc-500">Выплат пока нет</p>
        ) : (
          <div className="space-y-3">
            {payouts.map((p) => (
              <div key={p.id} className="rounded-lg border border-zinc-100 p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{formatMoney(p.amount)}</span>
                  <span className="text-zinc-500">{p.paidAt.slice(0, 10)}</span>
                </div>
                {p.method ? <p className="text-zinc-600">{p.method}</p> : null}
                {p.note ? <p className="text-zinc-600">{p.note}</p> : null}
                <ul className="mt-2 text-zinc-600">
                  {p.allocations.map((a) => (
                    <li key={a.id}>
                      {a.property.name}: {formatMoney(a.amount)}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <h2 className="border-b border-zinc-200 px-4 py-3 text-lg font-semibold">Операции</h2>
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-3 py-2 font-medium">Дата</th>
              <th className="px-3 py-2 font-medium">Объект</th>
              <th className="px-3 py-2 font-medium">Тип</th>
              <th className="px-3 py-2 font-medium">Категория</th>
              <th className="px-3 py-2 font-medium">Сумма</th>
              <th className="px-3 py-2 font-medium">Описание</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                  Операций пока нет
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-zinc-100">
                  <td className="px-3 py-2 whitespace-nowrap">{tx.occurredAt.slice(0, 10)}</td>
                  <td className="px-3 py-2">{tx.propertyName}</td>
                  <td className="px-3 py-2">{financialTypeLabels[tx.type]}</td>
                  <td className="px-3 py-2">{financialCategoryLabels[tx.category]}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {tx.signedAmount < 0 ? "−" : ""}
                    {formatMoney(Math.abs(tx.amount))}
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{tx.description || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-zinc-600">{label}</span>
      {children}
    </label>
  );
}
