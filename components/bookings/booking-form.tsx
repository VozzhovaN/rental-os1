"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { GuestPicker } from "@/components/bookings/guest-picker";
import { QuickGuestForm } from "@/components/bookings/quick-guest-form";
import type { BookingDTO } from "@/lib/bookings";
import { getAllowedBookingStatuses } from "@/lib/bookings";
import { formatStayNightsLabel } from "@/lib/booking-ui";
import type { ChannelListingDTO } from "@/lib/channel-listings";
import { safeCrmPath } from "@/lib/crm-path";
import { addUtcDays, formatGuestName, toDateInputValue } from "@/lib/format";
import { bookingStatusLabels } from "@/lib/guest-labels";
import type { GuestDTO } from "@/lib/guests";
import type { PropertyDTO } from "@/lib/properties";
import { formatMoney } from "@/lib/property-labels";
import type { SalesChannelDTO } from "@/lib/sales-channels";
import type { BookingStatus } from "@prisma/client";

const inputClassName =
  "w-full rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm text-[var(--finance-text)] outline-none focus:border-[var(--finance-blue)] focus:ring-2 focus:ring-[var(--finance-blue)]/20";

const CREATE_STATUSES = ["PENDING", "CONFIRMED"] as const;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[#334155]">{label}</span>
      {children}
    </label>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="finance-card space-y-4 p-5">
      <h2 className="text-base font-semibold text-[var(--finance-text)]">{title}</h2>
      {children}
    </section>
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
  const [propertyId, setPropertyId] = useState(
    booking?.propertyId ?? defaultPropertyId ?? "",
  );
  const [salesChannelId, setSalesChannelId] = useState(
    booking?.salesChannelId ?? "",
  );
  const [channelListingId, setChannelListingId] = useState(
    booking?.channelListingId ?? "",
  );
  const [guestId, setGuestId] = useState(booking?.guestId ?? defaultGuestId ?? "");
  const [guests, setGuests] = useState(initialGuests);
  const [listings, setListings] = useState<ChannelListingDTO[]>([]);
  const [creatingGuest, setCreatingGuest] = useState(false);
  const [checkIn, setCheckIn] = useState(
    booking
      ? toDateInputValue(booking.checkIn)
      : (defaultCheckIn ?? ""),
  );
  const [checkOut, setCheckOut] = useState(
    booking
      ? toDateInputValue(booking.checkOut)
      : defaultCheckIn
        ? toDateInputValue(addUtcDays(defaultCheckIn, 1))
        : "",
  );
  const [guestsCount, setGuestsCount] = useState(booking?.guestsCount ?? 1);
  const [totalAmount, setTotalAmount] = useState(booking?.totalAmount ?? 0);

  const propertyListings = useMemo(() => {
    return listings.filter(
      (listing) => !salesChannelId || listing.salesChannelId === salesChannelId,
    );
  }, [listings, salesChannelId]);

  const resolvedListingId = propertyListings.some(
    (listing) => listing.id === channelListingId,
  )
    ? channelListingId
    : propertyListings.length === 1
      ? propertyListings[0].id
      : "";

  useEffect(() => {
    let cancelled = false;

    async function fetchListings() {
      await Promise.resolve();
      if (!propertyId) {
        if (!cancelled) setListings([]);
        return;
      }
      const response = await fetch(`/api/properties/${propertyId}/channels`);
      const payload = (await response.json()) as { listings?: ChannelListingDTO[] };
      if (!cancelled) setListings(payload.listings ?? []);
    }

    void fetchListings();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const selectedProperty = properties.find((property) => property.id === propertyId);
  const selectedChannel = salesChannels.find((channel) => channel.id === salesChannelId);
  const selectedGuest = guests.find((guest) => guest.id === guestId);
  const availableStatuses = isEdit
    ? getAllowedBookingStatuses(booking!.status as BookingStatus)
    : CREATE_STATUSES;
  const safeReturnTo = safeCrmPath(returnTo);
  const cancelHref =
    safeReturnTo ?? (booking ? `/crm/bookings/${booking.id}` : "/crm/bookings");
  const nights =
    checkIn && checkOut ? formatStayNightsLabel(checkIn, checkOut) : null;

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
      propertyId,
      guestId,
      salesChannelId,
      channelListingId: resolvedListingId || null,
      checkIn,
      checkOut,
      guestsCount,
      totalAmount,
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
        code?: string;
        booking?: { id: string };
      };

      if (!response.ok) {
        if (result.code === "CONFLICT") {
          throw new Error(
            ["На выбранные даты объект уже занят.", ...(result.details ?? [])]
              .filter(Boolean)
              .join("\n"),
          );
        }
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
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось сохранить бронь",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error ? (
          <p className="whitespace-pre-line rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <Section title="1. Объект">
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
                  {property.name} · {property.city} · до {property.guests} гостей
                </option>
              ))}
            </select>
          </Field>
          {selectedProperty ? (
            <p className="text-sm text-[#64748B]">
              Вместимость: {selectedProperty.guests} гостей
              {selectedProperty.address ? ` · ${selectedProperty.address}` : ""}
            </p>
          ) : null}
        </Section>

        <Section title="2. Даты">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Заезд">
              <input
                name="checkIn"
                type="date"
                required
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className={inputClassName}
              />
            </Field>
            <Field label="Выезд">
              <input
                name="checkOut"
                type="date"
                required
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className={inputClassName}
              />
            </Field>
            <div className="flex items-end">
              <p className="pb-2 text-sm text-[#64748B]">
                {nights ? nights.label : "Укажите даты"}
              </p>
            </div>
          </div>
        </Section>

        <Section title="3. Гость">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="mb-1.5 block text-sm font-medium text-[#334155]">
                Гость
              </span>
              <GuestPicker
                guests={guests}
                value={guestId}
                onChange={setGuestId}
                onCreateNew={() => setCreatingGuest(true)}
              />
            </div>
            <Field label="Количество гостей">
              <input
                name="guestsCount"
                type="number"
                min={1}
                max={selectedProperty?.guests}
                required
                value={guestsCount}
                onChange={(e) => setGuestsCount(Number(e.target.value))}
                className={inputClassName}
              />
            </Field>
          </div>
        </Section>

        <Section title="4. Канал">
          <div className="grid gap-4 sm:grid-cols-2">
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
            <Field label="Объявление (необязательно)">
              <select
                name="channelListingId"
                value={resolvedListingId}
                onChange={(event) => setChannelListingId(event.target.value)}
                className={inputClassName}
              >
                <option value="">Не указано</option>
                {propertyListings.map((listing) => (
                  <option key={listing.id} value={listing.id}>
                    {listing.salesChannel.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {selectedChannel && propertyListings.length === 0 ? (
            <p className="text-sm text-[#64748B]">
              Для канала «{selectedChannel.name}» объявление не привязано.
            </p>
          ) : null}
        </Section>

        <Section title="5. Стоимость">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Сумма бронирования, ₽">
              <input
                name="totalAmount"
                type="number"
                min={0}
                required
                value={totalAmount}
                onChange={(e) => setTotalAmount(Number(e.target.value))}
                className={inputClassName}
              />
            </Field>
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
          </div>
          {nights ? (
            <p className="text-sm text-[#64748B]">
              Справочно: {nights.label}. Сумма не пересчитывается автоматически.
            </p>
          ) : null}
          <Field label="Комментарий">
            <textarea
              name="comment"
              rows={3}
              defaultValue={booking?.comment ?? ""}
              className={inputClassName}
            />
          </Field>
        </Section>

        {!isEdit ? (
          <Section title="6. Проверка">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[#64748B]">Объект</dt>
                <dd className="font-medium text-right">
                  {selectedProperty?.name ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#64748B]">Даты</dt>
                <dd className="font-medium text-right">
                  {checkIn && checkOut
                    ? `${checkIn} — ${checkOut}${nights ? ` · ${nights.label}` : ""}`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#64748B]">Гость</dt>
                <dd className="font-medium text-right">
                  {selectedGuest ? formatGuestName(selectedGuest) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#64748B]">Канал</dt>
                <dd className="font-medium text-right">
                  {selectedChannel?.name ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-[var(--finance-border)] pt-2">
                <dt className="text-[#64748B]">Сумма</dt>
                <dd className="text-base font-semibold tabular-nums">
                  {formatMoney(totalAmount)}
                </dd>
              </div>
            </dl>
          </Section>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-[var(--finance-blue)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending
              ? "Сохранение…"
              : isEdit
                ? "Сохранить изменения"
                : "Создать бронь"}
          </button>
          <Link
            href={cancelHref}
            className="rounded-xl border border-[var(--finance-border)] px-4 py-2.5 text-sm font-medium text-[var(--finance-text)] hover:bg-[var(--finance-hover)]"
          >
            Отмена
          </Link>
        </div>
      </form>

      {creatingGuest ? (
        <QuickGuestForm
          onClose={() => setCreatingGuest(false)}
          onCreated={(guest) => {
            setGuests((current) => [
              guest,
              ...current.filter((item) => item.id !== guest.id),
            ]);
            setGuestId(guest.id);
            setCreatingGuest(false);
            setError(null);
          }}
        />
      ) : null}
    </>
  );
}
