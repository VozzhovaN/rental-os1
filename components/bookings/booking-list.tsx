"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { IconCalendar, IconPlus } from "@/components/crm/icons";
import type { BookingListItemDTO } from "@/lib/bookings";
import {
  bookingOverlapsPeriod,
  bookingPaymentBadgeClass,
  bookingPaymentUiLabels,
  bookingPaymentUiState,
  bookingStatusBadgeClass,
  bookingTodayFlags,
  buildBookingListKpi,
  formatStayNightsLabel,
  formatStayRangeShort,
  periodRange,
  type BookingPeriodPreset,
  type BookingSort,
} from "@/lib/booking-ui";
import { formatGuestName } from "@/lib/format";
import { bookingStatusLabels } from "@/lib/guest-labels";
import { normalizePhoneDigits } from "@/lib/guests";
import { formatMoney } from "@/lib/property-labels";
import type { BookingStatus } from "@prisma/client";

type FilterOption = { id: string; name: string };

type Props = {
  bookings: BookingListItemDTO[];
  properties: FilterOption[];
  channels: FilterOption[];
  initialStatus?: string;
  initialPropertyId?: string;
  initialChannelId?: string;
  initialQ?: string;
  initialPeriod?: string;
};

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="finance-card flex min-h-[88px] flex-col p-3">
      <span className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">
        {label}
      </span>
      <p className="mt-2 text-[22px] font-bold leading-none tabular-nums tracking-tight text-[#0F172A]">
        {value}
      </p>
      <p className="mt-auto pt-1.5 text-[11px] text-[#94A3B8]">{hint}</p>
    </div>
  );
}

function guestInitials(guest: BookingListItemDTO["guest"]) {
  const a = (guest.firstName?.[0] ?? "").toUpperCase();
  const b = (guest.lastName?.[0] ?? "").toUpperCase();
  return `${a}${b}` || "?";
}

function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${bookingStatusBadgeClass[status]}`}
    >
      {bookingStatusLabels[status]}
    </span>
  );
}

function PaymentBadge({ booking }: { booking: BookingListItemDTO }) {
  const state = bookingPaymentUiState(booking.totalAmount, booking);
  return (
    <div className="space-y-0.5">
      <span
        className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${bookingPaymentBadgeClass[state]}`}
      >
        {bookingPaymentUiLabels[state]}
      </span>
      {booking.netPaidAmount > 0 && booking.netPaidAmount < booking.totalAmount ? (
        <p className="text-[11px] tabular-nums text-[#64748B]">
          {formatMoney(booking.netPaidAmount)} / {formatMoney(booking.totalAmount)}
        </p>
      ) : null}
    </div>
  );
}

function TodayChips({ booking }: { booking: BookingListItemDTO }) {
  const flags = bookingTodayFlags(booking.checkIn, booking.checkOut, booking.status);
  const chips: string[] = [];
  if (flags.staying) chips.push("Проживает");
  if (flags.checkInToday) chips.push("Заезд сегодня");
  if (flags.checkOutToday) chips.push("Выезд сегодня");
  if (chips.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {chips.map((label) => (
        <span
          key={label}
          className="rounded bg-[#EFF6FF] px-1.5 py-0.5 text-[10px] font-medium text-[#1D4ED8]"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function CoverThumb({
  url,
  name,
}: {
  url: string | null;
  name: string;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-9 w-12 shrink-0 rounded-md object-cover"
      />
    );
  }
  return (
    <span
      className="inline-flex h-9 w-12 shrink-0 items-center justify-center rounded-md bg-[#F1F5F9] text-[10px] font-medium text-[#94A3B8]"
      aria-hidden
      title={name}
    >
      —
    </span>
  );
}

function RowMenu({ booking }: { booking: BookingListItemDTO }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function runAction(action: "confirm" | "check-in" | "check-out" | "cancel") {
    if (action === "cancel") {
      const ok = window.confirm(
        `Отменить бронирование?\n\nОбъект: ${booking.property.name}\nДаты: ${formatStayRangeShort(booking.checkIn, booking.checkOut)}\nГость: ${formatGuestName(booking.guest)}`,
      );
      if (!ok) return;
    }
    setError(null);
    setPending(action);
    try {
      const response =
        action === "confirm" || action === "cancel"
          ? await fetch(`/api/bookings/${booking.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status: action === "cancel" ? "CANCELLED" : "CONFIRMED",
              }),
            })
          : await fetch(`/api/bookings/${booking.id}/${action}`, {
              method: "POST",
            });
      const result = (await response.json()) as { error?: string; details?: string[] };
      if (!response.ok) {
        throw new Error(
          [result.error, ...(result.details ?? [])].filter(Boolean).join("\n") ||
            "Не удалось выполнить действие",
        );
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setPending(null);
    }
  }

  const canConfirm = booking.status === "PENDING";
  const canCheckIn = booking.status === "PENDING";
  const canCheckOut = booking.status === "PENDING" || booking.status === "CONFIRMED";
  const canCancel = booking.status === "PENDING" || booking.status === "CONFIRMED";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Действия по бронированию"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--finance-border)] text-[#64748B] hover:bg-[var(--finance-hover)]"
      >
        ⋯
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-[var(--finance-border)] bg-white py-1 shadow-[var(--finance-shadow)]"
        >
          <Link
            href={`/crm/bookings/${booking.id}`}
            role="menuitem"
            className="block px-3 py-2 text-sm hover:bg-[var(--finance-hover)]"
            onClick={(e) => e.stopPropagation()}
          >
            Открыть
          </Link>
          <Link
            href={`/crm/bookings/${booking.id}/edit`}
            role="menuitem"
            className="block px-3 py-2 text-sm hover:bg-[var(--finance-hover)]"
            onClick={(e) => e.stopPropagation()}
          >
            Редактировать
          </Link>
          <Link
            href={`/crm/guests/${booking.guestId}`}
            role="menuitem"
            className="block px-3 py-2 text-sm hover:bg-[var(--finance-hover)]"
            onClick={(e) => e.stopPropagation()}
          >
            Открыть гостя
          </Link>
          <Link
            href={`/crm/properties/${booking.propertyId}`}
            role="menuitem"
            className="block px-3 py-2 text-sm hover:bg-[var(--finance-hover)]"
            onClick={(e) => e.stopPropagation()}
          >
            Открыть объект
          </Link>
          {canConfirm ? (
            <button
              type="button"
              role="menuitem"
              disabled={Boolean(pending)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--finance-hover)] disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                void runAction("confirm");
              }}
            >
              Подтвердить
            </button>
          ) : null}
          {canCheckIn ? (
            <button
              type="button"
              role="menuitem"
              disabled={Boolean(pending)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--finance-hover)] disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                void runAction("check-in");
              }}
            >
              Заселить
            </button>
          ) : null}
          {canCheckOut ? (
            <button
              type="button"
              role="menuitem"
              disabled={Boolean(pending)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--finance-hover)] disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                void runAction("check-out");
              }}
            >
              Выселить
            </button>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              role="menuitem"
              disabled={Boolean(pending)}
              className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              onClick={(e) => {
                e.stopPropagation();
                void runAction("cancel");
              }}
            >
              Отменить
            </button>
          ) : null}
          {error ? (
            <p className="whitespace-pre-line border-t border-[var(--finance-border)] px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function matchesSearch(booking: BookingListItemDTO, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  const name = formatGuestName(booking.guest).toLowerCase();
  const phone = (booking.guest.phone ?? "").toLowerCase();
  const email = (booking.guest.email ?? "").toLowerCase();
  const property = booking.property.name.toLowerCase();
  const address = (booking.property.address ?? "").toLowerCase();
  const city = (booking.property.city ?? "").toLowerCase();
  const phoneDigits = normalizePhoneDigits(booking.guest.phone);
  const needleDigits = query.replace(/\D/g, "");
  const idMatch = query.length >= 8 && booking.id.toLowerCase().includes(q);
  return (
    name.includes(q) ||
    phone.includes(q) ||
    email.includes(q) ||
    property.includes(q) ||
    address.includes(q) ||
    city.includes(q) ||
    idMatch ||
    (needleDigits.length >= 3 && phoneDigits.includes(needleDigits))
  );
}

function sortBookings(list: BookingListItemDTO[], sort: BookingSort) {
  const next = [...list];
  const now = Date.now();
  next.sort((a, b) => {
    switch (sort) {
      case "NEWEST":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "CHECK_IN":
        return new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime();
      case "CHECK_OUT":
        return new Date(a.checkOut).getTime() - new Date(b.checkOut).getTime();
      case "AMOUNT":
        return b.totalAmount - a.totalAmount;
      case "NEAREST":
      default: {
        const dist = (b: BookingListItemDTO) =>
          Math.abs(new Date(b.checkIn).getTime() - now);
        return dist(a) - dist(b);
      }
    }
  });
  return next;
}

function syncUrl(params: Record<string, string>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (!value || value === "ALL") url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

export function BookingList({
  bookings,
  properties,
  channels,
  initialStatus = "ALL",
  initialPropertyId = "ALL",
  initialChannelId = "ALL",
  initialQ = "",
  initialPeriod = "MONTH",
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [channelId, setChannelId] = useState(initialChannelId);
  const [period, setPeriod] = useState<BookingPeriodPreset>(
    (["TODAY", "WEEK", "MONTH", "ALL"].includes(initialPeriod)
      ? initialPeriod
      : "MONTH") as BookingPeriodPreset,
  );
  const [sort, setSort] = useState<BookingSort>("NEAREST");
  const [paymentFilter, setPaymentFilter] = useState("ALL");

  const kpi = useMemo(() => buildBookingListKpi(bookings), [bookings]);
  const range = useMemo(() => periodRange(period), [period]);

  const filtered = useMemo(() => {
    const list = bookings.filter((booking) => {
      if (!matchesSearch(booking, search.trim())) return false;
      if (status !== "ALL" && booking.status !== status) return false;
      if (propertyId !== "ALL" && booking.propertyId !== propertyId) return false;
      if (channelId !== "ALL" && booking.salesChannelId !== channelId) return false;
      if (!bookingOverlapsPeriod(booking.checkIn, booking.checkOut, range.from, range.to)) {
        return false;
      }
      if (paymentFilter !== "ALL") {
        const payState = bookingPaymentUiState(booking.totalAmount, booking);
        if (paymentFilter === "UNPAID" && payState !== "UNPAID") return false;
        if (paymentFilter === "PARTIAL" && payState !== "PARTIAL" && payState !== "HAS_REFUND") {
          return false;
        }
        if (paymentFilter === "PAID" && payState !== "PAID" && payState !== "OVERPAID") {
          return false;
        }
      }
      return true;
    });
    return sortBookings(list, sort);
  }, [bookings, search, status, propertyId, channelId, range, paymentFilter, sort]);

  useEffect(() => {
    syncUrl({
      status,
      property: propertyId,
      channel: channelId,
      period,
      q: search.trim(),
    });
  }, [status, propertyId, channelId, period, search]);

  function resetFilters() {
    setSearch("");
    setStatus("ALL");
    setPropertyId("ALL");
    setChannelId("ALL");
    setPeriod("MONTH");
    setPaymentFilter("ALL");
    setSort("NEAREST");
  }

  function onRowKey(e: KeyboardEvent, id: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      router.push(`/crm/bookings/${id}`);
    }
  }

  const hasActiveFilters =
    Boolean(search.trim()) ||
    status !== "ALL" ||
    propertyId !== "ALL" ||
    channelId !== "ALL" ||
    period !== "MONTH" ||
    paymentFilter !== "ALL";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Всего броней" value={String(kpi.total)} hint="В базе" />
        <KpiCard label="Сейчас проживают" value={String(kpi.staying)} hint="На объекте" />
        <KpiCard label="Предстоящие" value={String(kpi.upcoming)} hint="Заезд впереди" />
        <KpiCard label="Заезды сегодня" value={String(kpi.checkInToday)} hint="Check-in" />
        <KpiCard label="Выезды сегодня" value={String(kpi.checkOutToday)} hint="Check-out" />
      </div>

      <div className="finance-card space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["TODAY", "Сегодня"],
              ["WEEK", "Неделя"],
              ["MONTH", "Месяц"],
              ["ALL", "Все"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                period === value
                  ? "bg-[var(--finance-blue)] text-white"
                  : "bg-[#F8FAFC] text-[#475569] hover:bg-[var(--finance-hover)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto_auto]">
          <label className="block">
            <span className="sr-only">Поиск</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Гость, телефон, объект…"
              className="w-full rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--finance-blue)] focus:ring-2 focus:ring-[var(--finance-blue)]/20"
            />
          </label>
          <select
            aria-label="Статус"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">Все статусы</option>
            <option value="PENDING">{bookingStatusLabels.PENDING}</option>
            <option value="CONFIRMED">{bookingStatusLabels.CONFIRMED}</option>
            <option value="COMPLETED">{bookingStatusLabels.COMPLETED}</option>
            <option value="CANCELLED">{bookingStatusLabels.CANCELLED}</option>
          </select>
          <select
            aria-label="Объект"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">Все объекты</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Канал"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">Все каналы</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Оплата"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">Оплата: все</option>
            <option value="UNPAID">Не оплачено</option>
            <option value="PARTIAL">Частично</option>
            <option value="PAID">Оплачено</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-[#64748B]">
            Сортировка
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as BookingSort)}
              className="rounded-lg border border-[var(--finance-border)] bg-white px-2 py-1.5 text-sm text-[var(--finance-text)]"
            >
              <option value="NEAREST">Ближайшие</option>
              <option value="NEWEST">Новые</option>
              <option value="CHECK_IN">Дата заезда</option>
              <option value="CHECK_OUT">Дата выезда</option>
              <option value="AMOUNT">Сумма</option>
            </select>
          </label>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm text-[var(--finance-blue)] hover:underline"
            >
              Сбросить фильтры
            </button>
          ) : null}
        </div>
      </div>

      {bookings.length === 0 ? (
        <div className="finance-card px-6 py-14 text-center">
          <p className="text-base font-medium text-[var(--finance-text)]">
            Бронирований пока нет
          </p>
          <p className="mt-1 text-sm text-[var(--finance-text-secondary)]">
            Создайте первую бронь или добавьте её через календарь.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/crm/bookings/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--finance-blue)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              <IconPlus size={16} />
              Новая бронь
            </Link>
            <Link
              href="/crm/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--finance-border)] px-4 py-2.5 text-sm font-medium text-[var(--finance-text)] hover:bg-[var(--finance-hover)]"
            >
              <IconCalendar size={16} />
              Открыть календарь
            </Link>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="finance-card px-6 py-12 text-center">
          <p className="text-base font-medium text-[var(--finance-text)]">Ничего не найдено</p>
          <p className="mt-1 text-sm text-[var(--finance-text-secondary)]">
            Измените параметры поиска или сбросьте фильтры.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 rounded-xl border border-[var(--finance-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--finance-hover)]"
          >
            Сбросить фильтры
          </button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="finance-card hidden overflow-hidden md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--finance-border)] bg-[#F8FAFC] text-[11px] uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="px-4 py-3 font-medium">Гость</th>
                  <th className="px-4 py-3 font-medium">Объект</th>
                  <th className="px-4 py-3 font-medium">Даты</th>
                  <th className="px-4 py-3 font-medium">Ночей</th>
                  <th className="px-4 py-3 font-medium">Статус</th>
                  <th className="px-4 py-3 font-medium">Канал</th>
                  <th className="px-4 py-3 font-medium">Сумма</th>
                  <th className="px-4 py-3 font-medium">Оплата</th>
                  <th className="px-4 py-3 font-medium">
                    <span className="sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--finance-border)]">
                {filtered.map((booking) => {
                  const nights = formatStayNightsLabel(booking.checkIn, booking.checkOut);
                  const muted = booking.status === "CANCELLED";
                  return (
                    <tr
                      key={booking.id}
                      tabIndex={0}
                      onKeyDown={(e) => onRowKey(e, booking.id)}
                      onClick={() => router.push(`/crm/bookings/${booking.id}`)}
                      className={`cursor-pointer hover:bg-[var(--finance-hover)] ${muted ? "opacity-70" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-xs font-semibold text-[#3730A3]"
                            aria-hidden
                          >
                            {guestInitials(booking.guest)}
                          </span>
                          <div>
                            <Link
                              href={`/crm/guests/${booking.guestId}`}
                              className="font-medium text-[var(--finance-text)] hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {formatGuestName(booking.guest)}
                            </Link>
                            {booking.guest.phone ? (
                              <p className="text-xs text-[#64748B]">{booking.guest.phone}</p>
                            ) : null}
                            <TodayChips booking={booking} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CoverThumb
                            url={booking.coverPhotoUrl}
                            name={booking.property.name}
                          />
                          <Link
                            href={`/crm/properties/${booking.propertyId}`}
                            className="font-medium hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {booking.property.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-[#334155]">
                        {formatStayRangeShort(booking.checkIn, booking.checkOut)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[#64748B]">
                        {nights.nights}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={booking.status} />
                      </td>
                      <td className="px-4 py-3">
                        <span>{booking.salesChannel.name}</span>
                        {booking.isImported ? (
                          <span className="ml-1.5 inline-flex rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-medium text-[#64748B]">
                            Импорт
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums">
                        {formatMoney(booking.totalAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <PaymentBadge booking={booking} />
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <RowMenu booking={booking} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((booking) => {
              const nights = formatStayNightsLabel(booking.checkIn, booking.checkOut);
              const payState = bookingPaymentUiState(booking.totalAmount, booking);
              return (
                <Link
                  key={booking.id}
                  href={`/crm/bookings/${booking.id}`}
                  className={`finance-card block p-4 ${booking.status === "CANCELLED" ? "opacity-70" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-[var(--finance-text)]">
                      {formatGuestName(booking.guest)}
                    </p>
                    <StatusBadge status={booking.status} />
                  </div>
                  <p className="mt-2 text-sm text-[#334155]">{booking.property.name}</p>
                  <p className="mt-1 text-sm text-[#64748B]">
                    {formatStayRangeShort(booking.checkIn, booking.checkOut)} · {nights.label}
                  </p>
                  <TodayChips booking={booking} />
                  <p className="mt-3 text-base font-semibold tabular-nums">
                    {formatMoney(booking.totalAmount)}
                  </p>
                  <p className="text-sm text-[#64748B]">
                    {bookingPaymentUiLabels[payState]}
                    {booking.netPaidAmount > 0 && booking.netPaidAmount < booking.totalAmount
                      ? ` ${formatMoney(booking.netPaidAmount)}`
                      : ""}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-sm text-[#64748B]">
                    <span>
                      {booking.salesChannel.name}
                      {booking.isImported ? " · Импорт" : ""}
                    </span>
                    <span className="font-medium text-[var(--finance-blue)]">Открыть →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
