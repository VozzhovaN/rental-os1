"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { buyerHistoryTypeLabels } from "@/lib/buyer-history-labels";
import type { BuyerHistoryDTO } from "@/lib/buyer-history";
import { formatDateTime } from "@/lib/format";

export function BuyerHistoryTimeline({
  buyerId,
  history,
}: {
  buyerId: string;
  history: BuyerHistoryDTO[];
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addNote(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/buyers/${buyerId}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ message: note }),
      });
      const payload = (await response.json()) as { error?: string; details?: string[] };
      if (!response.ok) {
        throw new Error(payload.details?.join(". ") || payload.error || "Не удалось сохранить");
      }
      setNote("");
      router.refresh();
    } catch (noteError) {
      setError(noteError instanceof Error ? noteError.message : "Не удалось сохранить");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={addNote} className="space-y-2">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">Заметка в историю</span>
          <textarea
            required
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50"
        >
          Добавить заметку
        </button>
      </form>

      {history.length === 0 ? (
        <p className="text-sm text-zinc-500">История пока пуста.</p>
      ) : (
        <ol className="space-y-3">
          {history.map((entry) => (
            <li key={entry.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="font-medium">{buyerHistoryTypeLabels[entry.type]}</span>
                <span className="text-xs text-zinc-400">{formatDateTime(entry.createdAt)}</span>
              </div>
              {entry.message ? <p className="mt-1 text-zinc-600">{entry.message}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
