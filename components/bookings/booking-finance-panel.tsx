"use client";

import { FormEvent, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/property-labels";
import type { BookingFinanceState } from "@/lib/finance";
import {
  bookingPaymentBadgeClass,
  bookingPaymentUiLabels,
  bookingPaymentUiState,
} from "@/lib/booking-ui";

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
  const payState = bookingPaymentUiState(b.grossAmount, {
    paidAmount: f.paidAmount,
    refundedAmount: f.refundedAmount,
    netPaidAmount: f.netPaidAmount,
  });
  const refundTarget = f.payments.find((p) => p.id === refundFor);

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
    setPaymentForm({
      amount: "",
      paidAt: new Date().toISOString().slice(0, 10),
      method: "",
      note: "",
    });
    startTransition(() => router.refresh());
  }

  async function submitRefund(event: FormEvent) {
    event.preventDefault();
    if (!refundFor || !refundTarget) return;
    const amount = Number(refundForm.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > refundTarget.netAmount) {
      setError(`Сумма возврата должна быть от 1 до ${refundTarget.netAmount} ₽`);
      return;
    }
    if (
      !window.confirm(
        `Оформить возврат ${amount} ₽?\nДоступно к возврату: ${refundTarget.netAmount} ₽`,
      )
    ) {
      return;
    }
    setError(null);
    const response = await fetch(
      `/api/bookings/${bookingId}/payments/${refundFor}/refund`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          refundedAt: refundForm.refundedAt,
          note: refundForm.note,
        }),
      },
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error || "Не удалось оформить возврат");
      return;
    }
    setRefundFor(null);
    setRefundForm({
      amount: "",
      refundedAt: new Date().toISOString().slice(0, 10),
      note: "",
    });
    startTransition(() => router.refresh());
  }

  return (
    <section className="finance-card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[var(--finance-text)]">Оплата</h2>
          <span
            className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${bookingPaymentBadgeClass[payState]}`}
          >
            {bookingPaymentUiLabels[payState]}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowPaymentForm((v) => !v)}
          className="rounded-xl bg-[var(--finance-blue)] px-3 py-2 text-sm font-medium text-white"
        >
          + Добавить оплату
        </button>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Стоимость бронирования" value={formatMoney(b.grossAmount)} />
        <Stat label="Оплачено" value={formatMoney(f.netPaidAmount)} />
        <Stat
          label={f.overpaymentAmount > 0 ? "Переплата" : "Осталось"}
          value={
            f.overpaymentAmount > 0
              ? formatMoney(f.overpaymentAmount)
              : formatMoney(f.remainingAmount)
          }
        />
        <Stat label="Возвращено" value={formatMoney(f.refundedAmount)} />
      </dl>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {showPaymentForm ? (
        <form
          onSubmit={submitPayment}
          className="grid gap-3 rounded-xl border border-[var(--finance-border)] bg-[#F8FAFC] p-4 sm:grid-cols-2"
        >
          <Field label="Сумма, ₽">
            <input
              type="number"
              min={1}
              step={1}
              required
              value={paymentForm.amount}
              onChange={(e) =>
                setPaymentForm((s) => ({ ...s, amount: e.target.value }))
              }
              className="w-full rounded-lg border border-[var(--finance-border)] px-3 py-2"
            />
          </Field>
          <Field label="Дата">
            <input
              type="date"
              required
              value={paymentForm.paidAt}
              onChange={(e) =>
                setPaymentForm((s) => ({ ...s, paidAt: e.target.value }))
              }
              className="w-full rounded-lg border border-[var(--finance-border)] px-3 py-2"
            />
          </Field>
          <Field label="Метод">
            <input
              value={paymentForm.method}
              onChange={(e) =>
                setPaymentForm((s) => ({ ...s, method: e.target.value }))
              }
              placeholder="наличные / перевод / …"
              className="w-full rounded-lg border border-[var(--finance-border)] px-3 py-2"
            />
          </Field>
          <Field label="Комментарий">
            <input
              value={paymentForm.note}
              onChange={(e) =>
                setPaymentForm((s) => ({ ...s, note: e.target.value }))
              }
              className="w-full rounded-lg border border-[var(--finance-border)] px-3 py-2"
            />
          </Field>
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-[var(--finance-blue)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Сохранить оплату
            </button>
            <button
              type="button"
              onClick={() => setShowPaymentForm(false)}
              className="rounded-xl border border-[var(--finance-border)] px-3 py-2 text-sm"
            >
              Отмена
            </button>
          </div>
        </form>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-[var(--finance-text)]">
          История оплат
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--finance-border)] text-[#64748B]">
              <tr>
                <th className="py-2 pr-3 font-medium">Дата</th>
                <th className="py-2 pr-3 font-medium">Сумма</th>
                <th className="py-2 pr-3 font-medium">Тип</th>
                <th className="py-2 pr-3 font-medium">Возврат</th>
                <th className="py-2 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {f.payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-[#64748B]">
                    Платежей пока нет. Подтверждённая бронь не означает оплату.
                  </td>
                </tr>
              ) : (
                f.payments.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--finance-border)]">
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      {p.paidAt.slice(0, 10)}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">
                      {formatMoney(p.amount)}
                    </td>
                    <td className="py-2.5 pr-3">Оплата</td>
                    <td className="py-2.5 pr-3 tabular-nums">
                      {p.refundedAmount > 0 ? formatMoney(p.refundedAmount) : "—"}
                    </td>
                    <td className="py-2.5">
                      {p.netAmount > 0 ? (
                        <button
                          type="button"
                          className="min-h-9 text-sm text-[var(--finance-blue)] hover:underline"
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
      </div>

      {refundFor && refundTarget ? (
        <form
          onSubmit={submitRefund}
          className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:grid-cols-2"
        >
          <p className="sm:col-span-2 text-sm text-amber-900">
            Доступно к возврату:{" "}
            <strong className="tabular-nums">
              {formatMoney(refundTarget.netAmount)}
            </strong>
          </p>
          <Field label="Сумма возврата, ₽">
            <input
              type="number"
              min={1}
              max={refundTarget.netAmount}
              step={1}
              required
              value={refundForm.amount}
              onChange={(e) =>
                setRefundForm((s) => ({ ...s, amount: e.target.value }))
              }
              className="w-full rounded-lg border border-[var(--finance-border)] px-3 py-2"
            />
          </Field>
          <Field label="Дата">
            <input
              type="date"
              required
              value={refundForm.refundedAt}
              onChange={(e) =>
                setRefundForm((s) => ({ ...s, refundedAt: e.target.value }))
              }
              className="w-full rounded-lg border border-[var(--finance-border)] px-3 py-2"
            />
          </Field>
          <Field label="Причина">
            <input
              required
              value={refundForm.note}
              onChange={(e) =>
                setRefundForm((s) => ({ ...s, note: e.target.value }))
              }
              className="w-full rounded-lg border border-[var(--finance-border)] px-3 py-2"
            />
          </Field>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={pending}
              className="min-h-10 rounded-xl bg-[var(--finance-text)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Подтвердить возврат
            </button>
            <button
              type="button"
              onClick={() => setRefundFor(null)}
              className="min-h-10 rounded-xl border border-[var(--finance-border)] px-3 py-2 text-sm"
            >
              Отмена
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[#64748B]">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums text-[var(--finance-text)]">
        {value}
      </dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-[#64748B]">{label}</span>
      {children}
    </label>
  );
}
