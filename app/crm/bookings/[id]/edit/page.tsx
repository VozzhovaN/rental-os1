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

  const dto = serializeBooking(booking);
  const properties = (await getProperties()).map(serializeProperty);
  const guests = (await getGuests()).map(serializeGuest);
  const salesChannels = (await getActiveSalesChannels()).map(serializeSalesChannel);
  const backHref = safeCrmPath(returnTo) ?? `/crm/bookings/${dto.id}`;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href={backHref}
          className="text-sm text-[var(--finance-text-secondary)] hover:text-[var(--finance-text)]"
        >
          {safeCrmPath(returnTo) ? "← Назад" : "← К карточке брони"}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--finance-text)]">
          Редактирование бронирования
        </h1>
        <p className="mt-1 text-sm text-[var(--finance-text-secondary)]">
          {dto.property.name}
        </p>
      </div>
      <BookingForm
        booking={dto}
        properties={properties}
        guests={guests}
        salesChannels={salesChannels}
        returnTo={safeCrmPath(returnTo)}
      />
    </div>
  );
}
