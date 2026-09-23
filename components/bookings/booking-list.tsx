"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BookingDTO } from "@/lib/bookings";
import { formatDate, formatGuestName } from "@/lib/format";
import { bookingStatusLabels } from "@/lib/guest-labels";
import { formatMoney } from "@/lib/property-labels";

export function BookingList({ bookings }: { bookings: BookingDTO[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(booking: BookingDTO) {
    if (!window.confirm("Удалить бронирование?")) {
      return;
    }

    setError(null);
    setPendingId(booking.id);

    try {
      const response = await fetch(`/api/bookings/${booking.id}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error || "Не удалось удалить бронь");
      }

      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Не удалось удалить бронь");
    } finally {
      setPendingId(null);
    }
  }

  if (bookings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
        <p className="text-zinc-700">Бронирований пока нет.</p>
        <Link
          href="/crm/bookings/new"
          className="mt-4 inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          Создать бронь
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
              <th className="px-4 py-3 font-medium">Гость</th>
              <th className="px-4 py-3 font-medium">Объект</th>
              <th className="px-4 py-3 font-medium">Даты</th>
              <th className="px-4 py-3 font-medium">Канал</th>
              <th className="px-4 py-3 font-medium">Гости</th>
              <th className="px-4 py-3 font-medium">Сумма</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {bookings.map((booking) => (
              <tr key={booking.id}>
                <td className="px-4 py-3">
                  <Link href={`/crm/guests/${booking.guestId}`} className="hover:underline">
                    {formatGuestName(booking.guest)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/crm/properties/${booking.propertyId}/edit`} className="hover:underline">
                    {booking.property.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {formatDate(booking.checkIn)} — {formatDate(booking.checkOut)}
                </td>
                <td className="px-4 py-3">{booking.salesChannel.name}</td>
                <td className="px-4 py-3">{booking.guestsCount}</td>
                <td className="px-4 py-3">{formatMoney(booking.totalAmount)}</td>
                <td className="px-4 py-3">{bookingStatusLabels[booking.status]}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/crm/bookings/${booking.id}`}
                      className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium"
                    >
                      Открыть
                    </Link>
                    <Link
                      href={`/crm/bookings/${booking.id}/edit`}
                      className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium"
                    >
                      Редактировать
                    </Link>
                    <button
                      type="button"
                      disabled={pendingId === booking.id}
                      onClick={() => handleDelete(booking)}
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
