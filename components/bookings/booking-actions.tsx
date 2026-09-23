"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BookingActions({
  bookingId,
  status,
}: {
  bookingId: string;
  status: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function run(action: "check-in" | "check-out" | "cancel") {
    if (action === "cancel" && !window.confirm("Отменить бронирование?")) {
      return;
    }

    setError(null);
    setPending(action);

    try {
      const response =
        action === "cancel"
          ? await fetch(`/api/bookings/${bookingId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "CANCELLED" }),
            })
          : await fetch(`/api/bookings/${bookingId}/${action}`, {
              method: "POST",
            });
      const result = (await response.json()) as { error?: string; details?: string[] };

      if (!response.ok) {
        throw new Error(
          [result.error, ...(result.details ?? [])].filter(Boolean).join("\n") ||
            "Не удалось выполнить действие",
        );
      }

      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Ошибка");
    } finally {
      setPending(null);
    }
  }

  if (status === "CANCELLED") {
    return null;
  }

  return (
    <div className="space-y-2">
      {error ? <p className="whitespace-pre-line text-sm text-red-700">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {status === "PENDING" ? (
          <button
            type="button"
            disabled={Boolean(pending)}
            onClick={() => run("check-in")}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {pending === "check-in" ? "Сохранение..." : "Заселить"}
          </button>
        ) : null}
        {status === "PENDING" || status === "CONFIRMED" ? (
          <button
            type="button"
            disabled={Boolean(pending)}
            onClick={() => run("check-out")}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {pending === "check-out" ? "Сохранение..." : "Выселить"}
          </button>
        ) : null}
        {status === "PENDING" || status === "CONFIRMED" ? (
          <button
            type="button"
            disabled={Boolean(pending)}
            onClick={() => run("cancel")}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
          >
            {pending === "cancel" ? "Отмена..." : "Отменить бронь"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
