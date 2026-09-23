import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingActions } from "@/components/bookings/booking-actions";
import { BookingFinancePanel } from "@/components/bookings/booking-finance-panel";
import { PropertyObjectBlock } from "@/components/properties/property-object-block";
import { formatDate, formatGuestName } from "@/lib/format";
import { getBookingById, serializeBooking } from "@/lib/bookings";
import { getBookingFinanceState } from "@/lib/finance";
import { bookingStatusLabels, messengerTypeLabels } from "@/lib/guest-labels";
import { formatArea, formatMoney, propertyTypeLabels } from "@/lib/property-labels";
import { getPropertyPhotos, serializePropertyPhoto } from "@/lib/property-photos";

export const dynamic = "force-dynamic";

export default async function BookingCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bookingRecord = await getBookingById(id);

  if (!bookingRecord) {
    notFound();
  }

  const booking = serializeBooking(bookingRecord);
  const finance = await getBookingFinanceState(id);
  const propertyPhotos = (await getPropertyPhotos(booking.propertyId)).map(serializePropertyPhoto);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/crm/bookings" className="text-sm text-zinc-500 hover:text-zinc-800">
            ← К списку броней
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Бронирование</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {formatDate(booking.checkIn)} — {formatDate(booking.checkOut)}
          </p>
        </div>
        <Link
          href={`/crm/bookings/${booking.id}/edit`}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
        >
          Редактировать
        </Link>
      </div>

      <PropertyObjectBlock
        property={{
          id: booking.property.id,
          name: booking.property.name,
          typeLabel: propertyTypeLabels[booking.property.type],
          areaLabel: formatArea(booking.property.area),
          city: booking.property.city,
          address: booking.property.address,
          metaLine: `Вместимость ${booking.property.guests} · в брони ${booking.guestsCount} гост.`,
        }}
        photos={propertyPhotos}
        propertyHref={`/crm/properties/${booking.propertyId}/edit`}
      />

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Гость</dt>
            <dd>
              <Link href={`/crm/guests/${booking.guestId}`} className="font-medium hover:underline">
                {formatGuestName(booking.guest)}
              </Link>
              <p className="text-zinc-500">{booking.guest.phone ?? "без телефона"}</p>
              <p className="text-zinc-500">
                Мессенджер:{" "}
                {booking.guest.messengerType
                  ? `${messengerTypeLabels[booking.guest.messengerType]}${booking.guest.messengerContact ? ` · ${booking.guest.messengerContact}` : ""}`
                  : "не выбран"}
              </p>
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Канал продаж</dt>
            <dd>{booking.salesChannel.name}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Объявление</dt>
            <dd>
              {booking.channelListing
                ? `${booking.channelListing.externalId}`
                : "не указано"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Гостей</dt>
            <dd>{booking.guestsCount}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Сумма</dt>
            <dd>{formatMoney(booking.totalAmount)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Статус</dt>
            <dd>{bookingStatusLabels[booking.status]}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Комментарий</dt>
            <dd>{booking.comment ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <BookingFinancePanel bookingId={booking.id} initialFinance={finance} />

      <BookingActions bookingId={booking.id} status={booking.status} />
    </div>
  );
}
