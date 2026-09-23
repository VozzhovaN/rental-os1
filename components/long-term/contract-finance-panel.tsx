"use client";

import { FormEvent, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/property-labels";

type FinancePayload = Awaited<
  ReturnType<typeof import("@/lib/finance/long-term-finance").getContractFinanceSummary>
>;

type Props = {
  contractId: string;
  status: string;
  initial: FinancePayload;
};

export function LongTermContractFinancePanel({ contractId, status, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPay, setShowPay] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: "",
    paidAt: new Date().toISOString().slice(0, 10),
    method: "",
    note: "",
  });

  const s = initial.summary;

  async function post(url: string, body?: unknown) {
    setError(null);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : "{}",
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error || "Ошибка запроса");
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  async function submitPayment(e: FormEvent) {
    e.preventDefault();
    const ok = await post(`/api/long-term-contracts/${contractId}/payments`, {
      amount: Number(payForm.amount),
      paidAt: payForm.paidAt,
      method: payForm.method || null,
      note: payForm.note || null,
    });
    if (ok) {
      setShowPay(false);
      setPayForm({ amount: "", paidAt: new Date().toISOString().slice(0, 10), method: "", note: "" });
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
        <h2 className="text-lg font-semibold">Финансы</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Аренда начислено" value={formatMoney(s.rentAccrued)} />
          <Stat label="Аренда оплачено" value={formatMoney(s.rentPaid)} />
          <Stat label="Долг по аренде" value={formatMoney(Math.max(0, s.rentOutstanding))} />
          <Stat label="Просроченных начислений" value={String(s.overdueChargeCount)} />
          <Stat label="Депозит начислено" value={formatMoney(s.depositAccrued)} />
          <Stat label="Депозит оплачено" value={formatMoney(s.depositPaid)} />
          <Stat label="Комиссия (начисл.)" value={formatMoney(s.commissionAccrued)} />
          <Stat label="Собственнику (начисл.)" value={formatMoney(s.ownerShareAccrued)} />
          <Stat label="Комиссия с оплаченного" value={formatMoney(s.commissionOnPaid)} />
          <Stat label="Собственнику с оплаченного" value={formatMoney(s.ownerShareOnPaid)} />
          <Stat label="Комиссия начислена" value={formatMoney(s.commissionAccrued)} />
        </dl>
        <p className="text-xs text-zinc-500">
          Полученная комиссия от собственника — отдельные платежи (CommissionPayment).
        </p>
        {s.unallocatedPaymentAmount > 0 ? (
          <p className="text-sm text-amber-800">
            Нераспределённый остаток платежей (переплата): {formatMoney(s.unallocatedPaymentAmount)}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
        <div className="flex flex-wrap gap-2 justify-between items-center">
          <h2 className="text-lg font-semibold">Начисления</h2>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm"
              onClick={() =>
                post(`/api/long-term-contracts/${contractId}/charges/generate`, {
                  includeDeposit: true,
                })
              }
            >
              Сгенерировать начисления
            </button>
          </div>
        </div>
        <ChargeTable charges={initial.charges} />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
        <div className="flex flex-wrap gap-2 justify-between items-center">
          <h2 className="text-lg font-semibold">Платежи</h2>
          <button
            type="button"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white"
            onClick={() => setShowPay((v) => !v)}
          >
            Добавить платёж
          </button>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {showPay ? (
          <form onSubmit={submitPayment} className="grid gap-3 sm:grid-cols-2 rounded-lg bg-zinc-50 p-4 border">
            <Field label="Сумма, ₽">
              <input
                type="number"
                min={1}
                required
                value={payForm.amount}
                onChange={(e) => setPayForm((s) => ({ ...s, amount: e.target.value }))}
                className="w-full rounded-md border px-2 py-1.5"
              />
            </Field>
            <Field label="Дата">
              <input
                type="date"
                required
                value={payForm.paidAt}
                onChange={(e) => setPayForm((s) => ({ ...s, paidAt: e.target.value }))}
                className="w-full rounded-md border px-2 py-1.5"
              />
            </Field>
            <Field label="Метод">
              <input
                value={payForm.method}
                onChange={(e) => setPayForm((s) => ({ ...s, method: e.target.value }))}
                className="w-full rounded-md border px-2 py-1.5"
              />
            </Field>
            <Field label="Комментарий">
              <input
                value={payForm.note}
                onChange={(e) => setPayForm((s) => ({ ...s, note: e.target.value }))}
                className="w-full rounded-md border px-2 py-1.5"
              />
            </Field>
            <button type="submit" disabled={pending} className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white sm:col-span-2">
              Сохранить
            </button>
          </form>
        ) : null}
        <PaymentTable payments={initial.payments} />
      </section>

      {status === "DRAFT" || status === "ACTIVE" ? (
        <div className="flex flex-wrap gap-2">
          {status === "DRAFT" ? (
            <button
              type="button"
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white"
              onClick={() => post(`/api/long-term-contracts/${contractId}/activate`)}
            >
              Активировать
            </button>
          ) : null}
          {status === "ACTIVE" ? (
            <button
              type="button"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              onClick={() => post(`/api/long-term-contracts/${contractId}/end`, {})}
            >
              Завершить договор
            </button>
          ) : null}
          {status === "DRAFT" || status === "ACTIVE" ? (
            <button
              type="button"
              className="rounded-md border border-red-300 text-red-800 px-3 py-2 text-sm"
              onClick={() => post(`/api/long-term-contracts/${contractId}/cancel`)}
            >
              Отменить договор
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
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

function ChargeTable({
  charges,
}: {
  charges: FinancePayload["charges"];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-left">
        <thead className="text-zinc-600 border-b">
          <tr>
            <th className="py-2 pr-3">Тип</th>
            <th className="py-2 pr-3">Срок</th>
            <th className="py-2 pr-3">Сумма</th>
            <th className="py-2 pr-3">Оплачено</th>
            <th className="py-2 pr-3">Остаток</th>
            <th className="py-2">Статус</th>
          </tr>
        </thead>
        <tbody>
          {charges.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-4 text-zinc-500">
                Нет начислений
              </td>
            </tr>
          ) : (
            charges.map((c) => (
              <tr key={c.id} className="border-b border-zinc-100">
                <td className="py-2 pr-3">{c.type}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{c.dueDate.slice(0, 10)}</td>
                <td className="py-2 pr-3">{formatMoney(c.amount)}</td>
                <td className="py-2 pr-3">{formatMoney(c.paid)}</td>
                <td className="py-2 pr-3">{formatMoney(c.outstanding)}</td>
                <td className="py-2">
                  {c.status}
                  {c.overdue ? " · ПРОСРОЧКА" : ""}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function PaymentTable({ payments }: { payments: FinancePayload["payments"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-left">
        <thead className="text-zinc-600 border-b">
          <tr>
            <th className="py-2 pr-3">Дата</th>
            <th className="py-2 pr-3">Сумма</th>
            <th className="py-2 pr-3">Метод</th>
            <th className="py-2">Allocation</th>
          </tr>
        </thead>
        <tbody>
          {payments.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-4 text-zinc-500">
                Нет платежей
              </td>
            </tr>
          ) : (
            payments.map((p) => (
              <tr key={p.id} className="border-b border-zinc-100">
                <td className="py-2 pr-3">{p.paidAt.slice(0, 10)}</td>
                <td className="py-2 pr-3">{formatMoney(p.amount)}</td>
                <td className="py-2 pr-3">{p.method || "—"}</td>
                <td className="py-2 text-zinc-600">
                  {p.allocations.length === 0
                    ? "не распределён"
                    : p.allocations
                        .map((a) => `${a.chargeType}: ${formatMoney(a.amount)}`)
                        .join("; ")}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
