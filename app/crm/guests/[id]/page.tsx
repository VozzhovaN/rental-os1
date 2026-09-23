import Link from "next/link";
import { notFound } from "next/navigation";
import { GuestHistoryForm } from "@/components/guests/guest-history-form";
import { formatDate, formatDateTime, formatGuestName } from "@/lib/format";
import { getGuestBookings, serializeBooking } from "@/lib/bookings";
import { getGuestHistory, serializeGuestHistory } from "@/lib/guest-history";
import { bookingStatusLabels, guestHistoryTypeLabels, messengerTypeLabels } from "@/lib/guest-labels";
import { getGuestById } from "@/lib/guests";
import { formatMoney } from "@/lib/property-labels";

export const dynamic = "force-dynamic";

export default async function GuestCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const guest = await getGuestById(id);

  if (!guest) {
    notFound();
  }

  const bookings = (await getGuestBookings(guest.id)).map(serializeBooking);
  const history = (await getGuestHistory(guest.id)).map(serializeGuestHistory);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/crm/guests" className="text-sm text-zinc-500 hover:text-zinc-800">
            ← К списку гостей
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {formatGuestName(guest)}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/crm/guests/${guest.id}/edit`}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium"
          >
            Редактировать
          </Link>
          <Link
            href={`/crm/bookings/new?guestId=${guest.id}`}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
          >
            Новая бронь
          </Link>
        </div>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">ФИО</dt>
            <dd>{formatGuestName(guest)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Телефон</dt>
            <dd>{guest.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Email</dt>
            <dd>{guest.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">MAX / Telegram</dt>
            <dd>
              {guest.messengerType ? messengerTypeLabels[guest.messengerType] : "Не выбран"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Контакт в мессенджере</dt>
            <dd>{guest.messengerContact ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Комментарий</dt>
            <dd>{guest.comment ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold tracking-wide">Бронирования</h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-zinc-500">Бронирований пока нет.</p>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <article key={booking.id} className="rounded-lg border border-zinc-100 p-4">
                <h3 className="font-medium">{booking.property.name}</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  {formatDate(booking.checkIn)} — {formatDate(booking.checkOut)}
                </p>
                <p className="text-sm text-zinc-600">
                  {booking.salesChannel.name} · {formatMoney(booking.totalAmount)} ·{" "}
                  {bookingStatusLabels[booking.status]}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/crm/bookings/${booking.id}`}
                    className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium"
                  >
                    Открыть
                  </Link>
                  <Link
                    href={`/crm/bookings/${booking.id}/edit?returnTo=${encodeURIComponent(`/crm/dashboard`)}`}
                    className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium"
                  >
                    Редактировать
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold tracking-wide">История</h2>
        {history.length === 0 ? (
          <p className="text-sm text-zinc-500">Записей пока нет.</p>
        ) : (
          <ol className="space-y-3">
            {history.map((entry) => (
              <li key={entry.id} className="border-l-2 border-zinc-200 pl-3">
                <p className="text-xs text-zinc-500">{formatDateTime(entry.createdAt)}</p>
                <p className="font-medium">{guestHistoryTypeLabels[entry.type]}</p>
                <p className="text-sm text-zinc-700">{entry.title}</p>
                {entry.description ? (
                  <p className="whitespace-pre-line text-sm text-zinc-500">{entry.description}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        <GuestHistoryForm guestId={guest.id} />
      </section>
    </div>
  );
}
