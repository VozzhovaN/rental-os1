"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate, formatGuestName } from "@/lib/format";
import { messengerTypeLabels } from "@/lib/guest-labels";
import type { GuestListItemDTO } from "@/lib/guests";

export function GuestList({ guests }: { guests: GuestListItemDTO[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(guest: GuestListItemDTO) {
    if (!window.confirm(`Удалить гостя «${formatGuestName(guest)}»?`)) {
      return;
    }

    setError(null);
    setPendingId(guest.id);

    try {
      const response = await fetch(`/api/guests/${guest.id}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error || "Не удалось удалить гостя");
      }

      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Не удалось удалить гостя");
    } finally {
      setPendingId(null);
    }
  }

  if (guests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
        <p className="text-zinc-700">Гостей пока нет.</p>
        <Link
          href="/crm/guests/new"
          className="mt-4 inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          Добавить гостя
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">ФИО</th>
              <th className="px-4 py-3 font-medium">Телефон</th>
              <th className="px-4 py-3 font-medium">Мессенджер</th>
              <th className="px-4 py-3 font-medium">Брони</th>
              <th className="px-4 py-3 font-medium">Последнее бронирование</th>
              <th className="px-4 py-3 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {guests.map((guest) => (
              <tr key={guest.id}>
                <td className="px-4 py-3 font-medium">
                  <Link href={`/crm/guests/${guest.id}`} className="hover:underline">
                    {formatGuestName(guest)}
                  </Link>
                </td>
                <td className="px-4 py-3">{guest.phone ?? "—"}</td>
                <td className="px-4 py-3">
                  {guest.messengerType
                    ? `${messengerTypeLabels[guest.messengerType]}${guest.messengerContact ? ` · ${guest.messengerContact}` : ""}`
                    : "Не выбран"}
                </td>
                <td className="px-4 py-3">{guest.bookingsCount}</td>
                <td className="px-4 py-3">
                  {guest.lastBooking
                    ? `${guest.lastBooking.propertyName}, ${formatDate(guest.lastBooking.checkIn)} — ${formatDate(guest.lastBooking.checkOut)}`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/crm/guests/${guest.id}`}
                      className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium"
                    >
                      Открыть
                    </Link>
                    <Link
                      href={`/crm/guests/${guest.id}/edit`}
                      className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium"
                    >
                      Редактировать
                    </Link>
                    <button
                      type="button"
                      disabled={pendingId === guest.id}
                      onClick={() => handleDelete(guest)}
                      className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 disabled:opacity-50"
                    >
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
