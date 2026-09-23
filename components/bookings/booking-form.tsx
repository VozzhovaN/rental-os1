"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { GuestPicker } from "@/components/bookings/guest-picker";
import { QuickGuestForm } from "@/components/bookings/quick-guest-form";
import type { BookingDTO } from "@/lib/bookings";
import type { ChannelListingDTO } from "@/lib/channel-listings";
import { safeCrmPath } from "@/lib/crm-path";
import { addUtcDays, toDateInputValue } from "@/lib/format";
import { bookingStatusLabels } from "@/lib/guest-labels";
import type { GuestDTO } from "@/lib/guests";
import type { PropertyDTO } from "@/lib/properties";
import type { SalesChannelDTO } from "@/lib/sales-channels";
import { BOOKING_STATUSES } from "@/lib/validations/guest";

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-900/10 focus:border-zinc-400 focus:ring-2";

const CREATE_STATUSES = ["PENDING", "CONFIRMED"] as const;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-700">{label}</span>
      {children}
    </label>
  );
}

function withNotice(path: string, notice: string) {
  const url = new URL(path, "http://local.invalid");
  url.searchParams.set("notice", notice);
  return `${url.pathname}${url.search}`;
}

type BookingFormProps = {
  booking?: BookingDTO;
  properties: PropertyDTO[];
  guests: GuestDTO[];
  salesChannels: SalesChannelDTO[];
  defaultGuestId?: string;
  defaultPropertyId?: string;
  defaultCheckIn?: string;
  returnTo?: string;
};

export function BookingForm({
  booking,
  properties,
  guests: initialGuests,
  salesChannels,
  defaultGuestId,
  defaultPropertyId,
  defaultCheckIn,
  returnTo,
}: BookingFormProps) {
  const router = useRouter();
  const isEdit = Boolean(booking);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [propertyId, setPropertyId] = useState(booking?.propertyId ?? defaultPropertyId ?? "");
  const [salesChannelId, setSalesChannelId] = useState(booking?.salesChannelId ?? "");
  const [channelListingId, setChannelListingId] = useState(booking?.channelListingId ?? "");
  const [guestId, setGuestId] = useState(booking?.guestId ?? defaultGuestId ?? "");
  const [guests, setGuests] = useState(initialGuests);
  const [listings, setListings] = useState<ChannelListingDTO[]>([]);
  const [creatingGuest, setCreatingGuest] = useState(false);

  const propertyListings = useMemo(() => {
    return listings.filter(
      (listing) => !salesChannelId || listing.salesChannelId === salesChannelId,
    );
  }, [listings, salesChannelId]);

  const resolvedListingId = propertyListings.some((listing) => listing.id === channelListingId)
    ? channelListingId
    : propertyListings.length === 1
      ? propertyListings[0].id
      : "";

  useEffect(() => {
    let cancelled = false;

    async function fetchListings() {
      await Promise.resolve();

      if (!propertyId) {
        if (!cancelled) {
          setListings([]);
        }
        return;
      }

      const response = await fetch(`/api/properties/${propertyId}/channels`);
      const payload = (await response.json()) as { listings?: ChannelListingDTO[] };

      if (!cancelled) {
        setListings(payload.listings ?? []);
      }
    }

    void fetchListings();

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const selectedProperty = properties.find((property) => property.id === propertyId);
  const selectedChannel = salesChannels.find((channel) => channel.id === salesChannelId);
  const selectedListing = propertyListings.find((listing) => listing.id === resolvedListingId);
  const availableStatuses = isEdit ? BOOKING_STATUSES : CREATE_STATUSES;
  const safeReturnTo = safeCrmPath(returnTo);
  const cancelHref = safeReturnTo ?? (booking ? `/crm/bookings/${booking.id}` : "/crm/bookings");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!guestId) {
      setError("Укажите гостя");
      return;
    }

    setPending(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      propertyId: String(form.get("propertyId") ?? ""),
      guestId,
      salesChannelId: String(form.get("salesChannelId") ?? ""),
      channelListingId: resolvedListingId || null,
      checkIn: String(form.get("checkIn") ?? ""),
      checkOut: String(form.get("checkOut") ?? ""),
      guestsCount: Number(form.get("guestsCount")),
      totalAmount: Number(form.get("totalAmount")),
      status: String(form.get("status") ?? (isEdit ? booking?.status : "CONFIRMED")),
      comment: String(form.get("comment") ?? "").trim(),
    };

    try {
      const response = await fetch(
        isEdit ? `/api/bookings/${booking?.id}` : "/api/bookings",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json()) as {
        error?: string;
        details?: string[];
        booking?: { id: string };
      };

      if (!response.ok) {
        throw new Error(
          [result.error, ...(result.details ?? [])].filter(Boolean).join("\n") ||
            "Не удалось сохранить бронь",
        );
      }

      const notice = isEdit ? "updated" : "created";
      const destination = safeReturnTo
        ? withNotice(safeReturnTo, notice)
        : `/crm/bookings/${result.booking?.id ?? booking?.id}`;
      router.push(destination);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось сохранить бронь");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <p className="whitespace-pre-line rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold">Связи</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-zinc-700">Гость</span>
            <GuestPicker
              guests={guests}
              value={guestId}
              onChange={setGuestId}
              onCreateNew={() => setCreatingGuest(true)}
            />
          </div>
          <Field label="Объект">
            <select
              name="propertyId"
              required
              value={propertyId}
              onChange={(event) => setPropertyId(event.target.value)}
              className={inputClassName}
            >
              <option value="">Выберите объект</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name} · {property.city} · до {property.guests} гостей · {property.status}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Канал продаж">
            <select
              name="salesChannelId"
              required
              value={salesChannelId}
              onChange={(event) => setSalesChannelId(event.target.value)}
              className={inputClassName}
            >
              <option value="">Выберите канал</option>
              {salesChannels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}
                </option>
              ))}
            </select>
          </Field>
          <div>
            <Field label="Объявление канала (необязательно)">
              <select
                name="channelListingId"
                value={resolvedListingId}
                onChange={(event) => setChannelListingId(event.target.value)}
                className={inputClassName}
              >
                <option value="">Не указано</option>
                {propertyListings.map((listing) => (
                  <option key={listing.id} value={listing.id}>
                    {listing.salesChannel.name}: {listing.externalId}
                  </option>
                ))}
              </select>
            </Field>
            {selectedChannel && propertyListings.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">
                Для канала «{selectedChannel.name}» объявление не привязано. Создавать его автоматически не будем.
              </p>
            ) : null}
            {selectedListing ? (
              <p className="mt-2 text-sm text-zinc-600">
                Объявление: {selectedListing.salesChannel.name}
                {selectedProperty ? ` — ${selectedProperty.name}` : ""} · {selectedListing.externalId}
              </p>
            ) : null}
          </div>
        </div>
        {selectedProperty ? (
          <p className="text-sm text-zinc-500">
            Вместимость выбранного объекта: {selectedProperty.guests} гостей.
          </p>
        ) : null}
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold">Даты и условия</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Заезд">
            <input
              name="checkIn"
              type="date"
              required
              defaultValue={
                booking ? toDateInputValue(booking.checkIn) : (defaultCheckIn ?? "")
              }
              className={inputClassName}
            />
          </Field>
          <Field label="Выезд">
            <input
              name="checkOut"
              type="date"
              required
              defaultValue={
                booking
                  ? toDateInputValue(booking.checkOut)
                  : defaultCheckIn
                    ? toDateInputValue(addUtcDays(defaultCheckIn, 1))
                    : ""
              }
              className={inputClassName}
            />
          </Field>
          <Field label="Гостей">
            <input
              name="guestsCount"
              type="number"
              min="1"
              max={selectedProperty?.guests}
              required
              defaultValue={booking?.guestsCount ?? 1}
              className={inputClassName}
            />
          </Field>
          <Field label="Сумма бронирования, ₽">
            <input
              name="totalAmount"
              type="number"
              min="0"
              required
              defaultValue={booking?.totalAmount ?? 0}
              className={inputClassName}
            />
          </Field>
        </div>
        <Field label="Статус">
          <select
            name="status"
            defaultValue={booking?.status ?? "CONFIRMED"}
            className={inputClassName}
          >
            {availableStatuses.map((status) => (
              <option key={status} value={status}>
                {bookingStatusLabels[status]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Комментарий">
          <textarea name="comment" rows={3} defaultValue={booking?.comment ?? ""} className={inputClassName} />
        </Field>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Сохранение..." : isEdit ? "Сохранить изменения" : "Создать бронь"}
        </button>
        <Link
          href={cancelHref}
          className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700"
        >
          Отмена
        </Link>
      </div>
    </form>

    {creatingGuest ? (
      <QuickGuestForm
        onClose={() => setCreatingGuest(false)}
        onCreated={(guest) => {
          setGuests((current) => [guest, ...current.filter((item) => item.id !== guest.id)]);
          setGuestId(guest.id);
          setCreatingGuest(false);
          setError(null);
        }}
      />
    ) : null}
    </>
  );
}
