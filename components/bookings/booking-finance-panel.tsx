"use client";

import { FormEvent, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/property-labels";
import type { BookingFinanceState } from "@/lib/finance";

type Props = {
  bookingId: string;
  initialFinance: BookingFinanceState;
};

export function BookingFinancePanel({ bookingId, initialFinance }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [refundFor, setRefundFor] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paidAt: new Date().toISOString().slice(0, 10),
    method: "",
    note: "",
  });
  const [refundForm, setRefundForm] = useState({
    amount: "",
    refundedAt: new Date().toISOString().slice(0, 10),
    note: "",
  });

  const f = initialFinance;
  const b = f.breakdown;

  async function submitPayment(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch(`/api/bookings/${bookingId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(paymentForm.amount),
        paidAt: paymentForm.paidAt,
        method: paymentForm.method || null,
        note: paymentForm.note || null,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error || "Не удалось записать оплату");
      return;
    }
    setShowPaymentForm(false);
    setPaymentForm({ amount: "", paidAt: new Date().toISOString().slice(0, 10), method: "", note: "" });
    startTransition(() => router.refresh());
  }

  async function submitRefund(event: FormEvent) {
    event.preventDefault();
    if (!refundFor) return;
    setError(null);
    const response = await fetch(`/api/bookings/${bookingId}/payments/${refundFor}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(refundForm.amount),
        refundedAt: refundForm.refundedAt,
        note: refundForm.note,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error || "Не удалось оформить возврат");
      return;
    }
    setRefundFor(null);
    setRefundForm({ amount: "", refundedAt: new Date().toISOString().slice(0, 10), note: "" });
    startTransition(() => router.refresh());
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Финансы</h2>
        <button
          type="button"
          onClick={() => setShowPaymentForm((v) => !v)}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
        >
          Добавить оплату
        </button>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Стоимость проживания" value={formatMoney(b.grossAmount)} />
        <Stat label="Оплачено (нетто)" value={formatMoney(f.netPaidAmount)} />
        <Stat
          label={f.overpaymentAmount > 0 ? "Переплата" : "Осталось оплатить"}
          value={
            f.overpaymentAmount > 0
              ? formatMoney(f.overpaymentAmount)
              : formatMoney(f.remainingAmount)
          }
        />
        <Stat
          label={`Комиссия управляющего (${formatRate(b.commissionRatePercent)}%)`}
          value={formatMoney(b.commissionAmount)}
        />
        <Stat
          label={b.isOperatorOwned ? "Собственнику (собственный объект)" : "Собственнику"}
          value={formatMoney(b.ownerShareAmount)}
        />
        <Stat
          label="Комиссия с полученных"
          value={formatMoney(f.commissionOnReceived)}
        />
        {b.isOperatorOwned ? (
          <Stat label="Арендная выручка (OWN)" value={formatMoney(f.netPaidAmount)} />
        ) : (
          <>
            <Stat label="Комиссия начислена" value={formatMoney(f.commissionAccrued)} />
            <Stat label="Доля собственнику" value={formatMoney(f.ownerShareOnReceived)} />
          </>
        )}
      </dl>

      {b.isOperatorOwned ? (
        <p className="text-xs text-zinc-500">
          Собственный объект — выручка бизнеса = net оплаченная аренда.
        </p>
      ) : (
        <p className="text-xs text-zinc-500">
          COMMISSION: выручка бизнеса = полученные платежи комиссии (см. /commission).
        </p>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {showPaymentForm ? (
        <form onSubmit={submitPayment} className="grid gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-4 sm:grid-cols-2">
          <Field label="Сумма, ₽">
            <input
              type="number"
              min={1}
              step={1}
              required
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm((s) => ({ ...s, amount: e.target.value }))}
              className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
            />
          </Field>
          <Field label="Дата">
            <input
              type="date"
              required
              value={paymentForm.paidAt}
              onChange={(e) => setPaymentForm((s) => ({ ...s, paidAt: e.target.value }))}
              className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
            />
          </Field>
          <Field label="Метод">
            <input
              value={paymentForm.method}
              onChange={(e) => setPaymentForm((s) => ({ ...s, method: e.target.value }))}
              placeholder="наличные / перевод / …"
              className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
            />
          </Field>
          <Field label="Комментарий">
            <input
              value={paymentForm.note}
              onChange={(e) => setPaymentForm((s) => ({ ...s, note: e.target.value }))}
              className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
            />
          </Field>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Сохранить оплату
            </button>
          </div>
        </form>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-600">
            <tr>
              <th className="py-2 pr-3 font-medium">Дата</th>
              <th className="py-2 pr-3 font-medium">Сумма</th>
              <th className="py-2 pr-3 font-medium">Возврат</th>
              <th className="py-2 pr-3 font-medium">Метод</th>
              <th className="py-2 pr-3 font-medium">Комментарий</th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {f.payments.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-zinc-500">
                  Платежей пока нет. CONFIRMED не означает оплату.
                </td>
              </tr>
            ) : (
              f.payments.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100">
                  <td className="py-2 pr-3 whitespace-nowrap">{p.paidAt.slice(0, 10)}</td>
                  <td className="py-2 pr-3">{formatMoney(p.amount)}</td>
                  <td className="py-2 pr-3">
                    {p.refundedAmount > 0 ? formatMoney(p.refundedAmount) : "—"}
                  </td>
                  <td className="py-2 pr-3">{p.method || "—"}</td>
                  <td className="py-2 pr-3 text-zinc-600">{p.note || "—"}</td>
                  <td className="py-2">
                    {p.netAmount > 0 ? (
                      <button
                        type="button"
                        className="text-sm text-zinc-600 underline hover:text-zinc-900"
                        onClick={() => {
                          setRefundFor(p.id);
                          setRefundForm((s) => ({
                            ...s,
                            amount: String(p.netAmount),
                          }));
                        }}
                      >
                        Возврат
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {refundFor ? (
        <form onSubmit={submitRefund} className="grid gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:grid-cols-2">
          <p className="sm:col-span-2 text-sm text-amber-900">Возврат по платежу (исходная оплата сохраняется)</p>
          <Field label="Сумма возврата, ₽">
            <input
              type="number"
              min={1}
              step={1}
              required
              value={refundForm.amount}
              onChange={(e) => setRefundForm((s) => ({ ...s, amount: e.target.value }))}
              className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
            />
          </Field>
          <Field label="Дата">
            <input
              type="date"
              required
              value={refundForm.refundedAt}
              onChange={(e) => setRefundForm((s) => ({ ...s, refundedAt: e.target.value }))}
              className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
            />
          </Field>
          <Field label="Причина">
            <input
              required
              value={refundForm.note}
              onChange={(e) => setRefundForm((s) => ({ ...s, note: e.target.value }))}
              className="w-full rounded-md border border-zinc-300 px-2 py-1.5"
            />
          </Field>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Подтвердить возврат
            </button>
            <button
              type="button"
              onClick={() => setRefundFor(null)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              Отмена
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function formatRate(percent: number): string {
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(2).replace(/\.?0+$/, "");
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
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
