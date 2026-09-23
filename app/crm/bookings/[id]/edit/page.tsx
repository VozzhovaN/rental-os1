import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingForm } from "@/components/bookings/booking-form";
import { getBookingById, serializeBooking } from "@/lib/bookings";
import { safeCrmPath } from "@/lib/crm-path";
import { getGuests, serializeGuest } from "@/lib/guests";
import { getProperties, serializeProperty } from "@/lib/properties";
import { getActiveSalesChannels, serializeSalesChannel } from "@/lib/sales-channels";

export const dynamic = "force-dynamic";

export default async function EditBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const { returnTo } = await searchParams;
  const booking = await getBookingById(id);

  if (!booking) {
    notFound();
  }

  const properties = (await getProperties()).map(serializeProperty);
  const guests = (await getGuests()).map(serializeGuest);
  const salesChannels = (await getActiveSalesChannels()).map(serializeSalesChannel);
  const backHref = safeCrmPath(returnTo) ?? `/crm/bookings/${booking.id}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-zinc-500 hover:text-zinc-800">
          {safeCrmPath(returnTo) ? "← Назад" : "← К карточке брони"}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Редактирование бронирования</h1>
      </div>
      <BookingForm
        booking={serializeBooking(booking)}
        properties={properties}
        guests={guests}
        salesChannels={salesChannels}
        returnTo={safeCrmPath(returnTo)}
      />
    </div>
  );
}
