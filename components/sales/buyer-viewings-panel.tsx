"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { formatDateTime } from "@/lib/format";
import type { ViewingDTO } from "@/lib/viewings";
import { viewingStatusLabels } from "@/lib/viewing-deposit-labels";
import type { BuyerInterestDTO } from "@/lib/buyer-interests";

export function BuyerViewingsPanel({
  interests,
  viewings,
}: {
  interests: BuyerInterestDTO[];
  viewings: ViewingDTO[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [interestId, setInterestId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
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
      const response = await fetch(`/api/viewings/${id}/${path}`, { method: "POST" });
      const payload = (await response.json()) as { error?: string };
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

  async function schedule(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPendingId("new");
    try {
      const response = await fetch(`/api/buyer-interests/${interestId}/viewings`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          scheduledAt: new Date(scheduledAt).toISOString(),
          notes,
        }),
      });
      const payload = (await response.json()) as { error?: string; details?: string[] };
      if (!response.ok) {
        throw new Error(payload.details?.join(". ") || payload.error || "Не удалось назначить");
      }
      setOpen(false);
      setInterestId("");
      setScheduledAt("");
      setNotes("");
      router.refresh();
    } catch (scheduleError) {
      setError(scheduleError instanceof Error ? scheduleError.message : "Ошибка");
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
          Назначить просмотр
        </button>
      ) : (
        <form onSubmit={schedule} className="space-y-3 rounded-lg border border-zinc-200 p-4">
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
            <span className="mb-1 block text-zinc-600">Дата и время</span>
            <input
              required
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
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
              Сохранить
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

      {viewings.length === 0 ? (
        <p className="text-sm text-zinc-500">Показов пока нет.</p>
      ) : (
        <ul className="space-y-3">
          {viewings.map((viewing) => (
            <li key={viewing.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{viewing.propertyName}</p>
                  <p className="text-zinc-600">{formatDateTime(viewing.scheduledAt)}</p>
                  {viewing.notes ? <p className="mt-1 text-zinc-600">{viewing.notes}</p> : null}
                </div>
                <span className="font-medium">{viewingStatusLabels[viewing.status]}</span>
              </div>
              {viewing.status === "SCHEDULED" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pendingId === viewing.id}
                    onClick={() => void runAction(viewing.id, "complete")}
                    className="rounded-md border border-zinc-200 px-2 py-1 text-xs disabled:opacity-50"
                  >
                    Завершить
                  </button>
                  <button
                    type="button"
                    disabled={pendingId === viewing.id}
                    onClick={() =>
                      void runAction(viewing.id, "cancel", "Отменить показ?")
                    }
                    className="rounded-md border border-zinc-200 px-2 py-1 text-xs disabled:opacity-50"
                  >
                    Отменить
                  </button>
                  <button
                    type="button"
                    disabled={pendingId === viewing.id}
                    onClick={() =>
                      void runAction(viewing.id, "no-show", "Отметить неявку?")
                    }
                    className="rounded-md border border-zinc-200 px-2 py-1 text-xs disabled:opacity-50"
                  >
                    Не явился
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
