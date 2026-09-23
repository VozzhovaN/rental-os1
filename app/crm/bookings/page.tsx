import Link from "next/link";
import { IconCalendar, IconPlus } from "@/components/crm/icons";
import { BookingList } from "@/components/bookings/booking-list";
import {
  getBookingListPaymentSummaries,
  getBookings,
  serializeBookingListItem,
} from "@/lib/bookings";
import { getProperties, serializeProperty } from "@/lib/properties";
import { getActiveSalesChannels, serializeSalesChannel } from "@/lib/sales-channels";

export const dynamic = "force-dynamic";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    property?: string;
    channel?: string;
    q?: string;
    period?: string;
  }>;
}) {
  const params = await searchParams;
  const rows = await getBookings();
  const payments = await getBookingListPaymentSummaries(rows.map((r) => r.id));
  const bookings = rows.map((row) =>
    serializeBookingListItem(row, payments.get(row.id)),
  );
  const properties = (await getProperties()).map(serializeProperty).map((p) => ({
    id: p.id,
    name: p.name,
  }));
  const channels = (await getActiveSalesChannels()).map(serializeSalesChannel).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--finance-text)]">
            Бронирования
          </h1>
          <p className="mt-1 text-sm text-[var(--finance-text-secondary)]">
            Управление бронированиями и проживанием гостей
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/crm/dashboard"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--finance-border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--finance-text)] hover:bg-[var(--finance-hover)]"
          >
            <IconCalendar size={16} />
            Календарь
          </Link>
          <Link
            href="/crm/bookings/new"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--finance-blue)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            <IconPlus size={16} />
            Новая бронь
          </Link>
        </div>
      </div>
      <BookingList
        bookings={bookings}
        properties={properties}
        channels={channels}
        initialStatus={params.status}
        initialPropertyId={params.property}
        initialChannelId={params.channel}
        initialQ={params.q}
        initialPeriod={params.period}
      />
    </div>
  );
}
