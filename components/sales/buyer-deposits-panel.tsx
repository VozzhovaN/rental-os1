"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { BuyerInterestDTO } from "@/lib/buyer-interests";
import type { DepositDTO } from "@/lib/deposits";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/property-labels";
import { depositStatusLabels } from "@/lib/viewing-deposit-labels";

export function BuyerDepositsPanel({
  interests,
  deposits,
}: {
  interests: BuyerInterestDTO[];
  deposits: DepositDTO[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [interestId, setInterestId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const openInterests = interests.filter(
    (interest) => interest.status !== "PURCHASED" && interest.status !== "REFUSED",
  );

  async function runAction(id: string, path: string, confirmMessage?: string) {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }
    setError(null);
    setPendingId(id);
    try {
      const response = await fetch(`/api/deposits/${id}/${path}`, { method: "POST" });
      const payload = (await response.json()) as { error?: string; code?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Не удалось выполнить действие");
      }
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Ошибка");
    } finally {
      setPendingId(null);
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPendingId("new");
    try {
      const response = await fetch(`/api/buyer-interests/${interestId}/deposits`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          amount: Number(amount),
          notes,
        }),
      });
      const payload = (await response.json()) as { error?: string; details?: string[] };
      if (!response.ok) {
        throw new Error(payload.details?.join(". ") || payload.error || "Не удалось создать");
      }
      setOpen(false);
      setInterestId("");
      setAmount("");
      setNotes("");
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Ошибка");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      {!open ? (
        <button
          type="button"
          disabled={openInterests.length === 0}
          onClick={() => setOpen(true)}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Добавить задаток
        </button>
      ) : (
        <form onSubmit={create} className="space-y-3 rounded-lg border border-zinc-200 p-4">
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600">Объект</span>
            <select
              required
              value={interestId}
              onChange={(event) => setInterestId(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            >
              <option value="">Выберите интерес</option>
              {openInterests.map((interest) => (
                <option key={interest.id} value={interest.id}>
                  {interest.saleListing.marketingTitle || interest.saleListing.property.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600">Сумма, ₽</span>
            <input
              required
              type="number"
              min={1}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600">Заметка</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pendingId === "new"}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Создать
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {deposits.length === 0 ? (
        <p className="text-sm text-zinc-500">Задатков пока нет.</p>
      ) : (
        <ul className="space-y-3">
          {deposits.map((deposit) => (
            <li key={deposit.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{deposit.propertyName}</p>
                  <p className="text-zinc-600">{formatMoney(deposit.amount)}</p>
                  {deposit.paidAt ? (
                    <p className="text-xs text-zinc-500">Оплачен {formatDateTime(deposit.paidAt)}</p>
                  ) : null}
                  {deposit.notes ? <p className="mt-1 text-zinc-600">{deposit.notes}</p> : null}
                </div>
                <span className="font-medium">{depositStatusLabels[deposit.status]}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {deposit.status === "PENDING" ? (
                  <button
                    type="button"
                    disabled={pendingId === deposit.id}
                    onClick={() => void runAction(deposit.id, "pay")}
                    className="rounded-md border border-zinc-200 px-2 py-1 text-xs disabled:opacity-50"
                  >
                    Отметить оплаченным
                  </button>
                ) : null}
                {deposit.status === "PAID" ? (
                  <>
                    <button
                      type="button"
                      disabled={pendingId === deposit.id}
                      onClick={() =>
                        void runAction(deposit.id, "refund", "Вернуть задаток?")
                      }
                      className="rounded-md border border-zinc-200 px-2 py-1 text-xs disabled:opacity-50"
                    >
                      Возврат
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === deposit.id}
                      onClick={() =>
                        void runAction(deposit.id, "forfeit", "Удержать задаток?")
                      }
                      className="rounded-md border border-zinc-200 px-2 py-1 text-xs disabled:opacity-50"
                    >
                      Удержан
                    </button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
