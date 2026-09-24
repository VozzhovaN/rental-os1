"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookingFinancePanel } from "@/components/bookings/booking-finance-panel";
import type { BookingDTO } from "@/lib/bookings";
import {
  bookingStatusBadgeClass,
  formatStayNightsLabel,
  formatStayRangeShort,
} from "@/lib/booking-ui";
import { formatDate, formatGuestName } from "@/lib/format";
import {
  bookingStatusLabels,
  guestHistoryTypeLabels,
  messengerTypeLabels,
} from "@/lib/guest-labels";
import type { GuestHistoryDTO } from "@/lib/guest-history";
import type { BookingFinanceState } from "@/lib/finance";
import { formatMoney } from "@/lib/property-labels";
import type { BookingStatus } from "@prisma/client";

type Props = {
  booking: BookingDTO;
  finance: BookingFinanceState;
  history: GuestHistoryDTO[];
  commission?: {
    ratePercent: number | null;
    accrued: number | null;
    received: number | null;
    isOperatorOwned: boolean;
  } | null;
};

function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium ${bookingStatusBadgeClass[status]}`}
    >
      {bookingStatusLabels[status]}
    </span>
  );
}

function Cover({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className="h-28 w-full rounded-xl object-cover sm:h-36 sm:w-48"
      />
    );
  }
  return (
    <div className="flex h-28 w-full items-center justify-center rounded-xl bg-[#F1F5F9] text-sm text-[#94A3B8] sm:h-36 sm:w-48">
      Нет фото
    </div>
  );
}

export function BookingDetailView({
  booking,
  finance,
  history,
  commission,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const nights = formatStayNightsLabel(booking.checkIn, booking.checkOut);
  const muted = booking.status === "CANCELLED";

  async function run(action: "confirm" | "check-in" | "check-out" | "cancel") {
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
      setCancelOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setPending(null);
    }
  }

  const canConfirm = booking.status === "PENDING";
  const canCheckIn = booking.status === "PENDING";
  const canCheckOut = booking.status === "CONFIRMED";
  const canCancel = booking.status === "PENDING" || booking.status === "CONFIRMED";

  return (
    <div className={`mx-auto max-w-5xl space-y-5 ${muted ? "opacity-90" : ""}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/crm/bookings"
            className="text-sm text-[var(--finance-text-secondary)] hover:text-[var(--finance-text)]"
          >
            ← К списку броней
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--finance-text)]">
              Бронирование
            </h1>
            <StatusBadge status={booking.status} />
            {booking.isImported ? (
              <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-medium text-[#64748B]">
                Импортировано
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[var(--finance-text-secondary)]">
            {formatGuestName(booking.guest)} · {booking.property.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/crm/bookings/${booking.id}/edit`}
            className="rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm font-medium hover:bg-[var(--finance-hover)]"
          >
            Редактировать
          </Link>
          {canConfirm ? (
            <button
              type="button"
              disabled={Boolean(pending)}
              onClick={() => void run("confirm")}
              className="rounded-xl border border-[var(--finance-border)] px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              Подтвердить
            </button>
          ) : null}
          {canCheckIn ? (
            <button
              type="button"
              disabled={Boolean(pending)}
              onClick={() => void run("check-in")}
              className="rounded-xl bg-[var(--finance-blue)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Заселить
            </button>
          ) : null}
          {canCheckOut ? (
            <button
              type="button"
              disabled={Boolean(pending)}
              onClick={() => void run("check-out")}
              className="rounded-xl border border-[var(--finance-border)] px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              Выселить
            </button>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              disabled={Boolean(pending)}
              onClick={() => setCancelOpen(true)}
              className="rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
            >
              Отменить
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="whitespace-pre-line rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {/* Hero summary */}
      <section className="finance-card grid gap-5 p-4 sm:grid-cols-[auto_1fr_auto] sm:p-5">
        <Cover url={booking.coverPhotoUrl} name={booking.property.name} />
        <div className="flex flex-col justify-center gap-3">
          <div>
            <Link
              href={`/crm/properties/${booking.propertyId}`}
              className="text-lg font-semibold text-[var(--finance-text)] hover:underline"
            >
              {booking.property.name}
            </Link>
            <p className="mt-0.5 text-sm text-[#64748B]">
              {[booking.property.city, booking.property.address].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[#94A3B8]">Заезд</p>
              <p className="font-medium">{formatDate(booking.checkIn)}</p>
            </div>
            <span className="text-[#94A3B8]">→ {nights.label} →</span>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[#94A3B8]">Выезд</p>
              <p className="font-medium">{formatDate(booking.checkOut)}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-center border-t border-[var(--finance-border)] pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
          <p className="text-[11px] uppercase tracking-wide text-[#94A3B8]">
            Стоимость бронирования
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--finance-text)]">
            {formatMoney(booking.totalAmount)}
          </p>
          <p className="mt-2 text-sm text-[#64748B]">
            Оплачено:{" "}
            <span className="font-medium tabular-nums text-[var(--finance-text)]">
              {formatMoney(finance.netPaidAmount)}
            </span>
          </p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="finance-card space-y-3 p-5">
          <h2 className="text-base font-semibold text-[var(--finance-text)]">
            Детали бронирования
          </h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[#64748B]">Заезд</dt>
              <dd className="font-medium">{formatDate(booking.checkIn)}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Выезд</dt>
              <dd className="font-medium">{formatDate(booking.checkOut)}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Ночей</dt>
              <dd className="font-medium">{nights.label}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Гостей</dt>
              <dd className="font-medium">{booking.guestsCount}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Статус</dt>
              <dd>
                <StatusBadge status={booking.status} />
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Канал</dt>
              <dd className="font-medium">{booking.salesChannel.name}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Дата создания</dt>
              <dd className="font-medium">{formatDate(booking.createdAt)}</dd>
            </div>
            {booking.comment ? (
              <div className="sm:col-span-2">
                <dt className="text-[#64748B]">Комментарий</dt>
                <dd className="mt-0.5 whitespace-pre-wrap">{booking.comment}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="finance-card space-y-3 p-5">
          <h2 className="text-base font-semibold">Гость</h2>
          <p className="text-lg font-medium">{formatGuestName(booking.guest)}</p>
          {booking.guest.phone ? (
            <p className="text-sm text-[#64748B]">{booking.guest.phone}</p>
          ) : null}
          {booking.guest.email ? (
            <p className="text-sm text-[#64748B]">{booking.guest.email}</p>
          ) : null}
          {booking.guest.messengerType ? (
            <p className="text-sm text-[#64748B]">
              {messengerTypeLabels[booking.guest.messengerType]}
              {booking.guest.messengerContact
                ? ` · ${booking.guest.messengerContact}`
                : ""}
            </p>
          ) : null}
          <Link
            href={`/crm/guests/${booking.guestId}`}
            className="inline-flex rounded-xl border border-[var(--finance-border)] px-3 py-2 text-sm font-medium hover:bg-[var(--finance-hover)]"
          >
            Открыть гостя
          </Link>
        </section>

        <section className="finance-card space-y-3 p-5">
          <h2 className="text-base font-semibold">Объект</h2>
          <div className="flex gap-3">
            <Cover url={booking.coverPhotoUrl} name={booking.property.name} />
            <div>
              <p className="font-medium">{booking.property.name}</p>
              <p className="text-sm text-[#64748B]">{booking.property.city}</p>
              <p className="mt-1 text-sm text-[#64748B]">
                Вместимость: {booking.property.guests}
              </p>
            </div>
          </div>
          <Link
            href={`/crm/properties/${booking.propertyId}`}
            className="inline-flex rounded-xl border border-[var(--finance-border)] px-3 py-2 text-sm font-medium hover:bg-[var(--finance-hover)]"
          >
            Открыть объект
          </Link>
        </section>

        <section className="finance-card space-y-3 p-5">
          <h2 className="text-base font-semibold">Источник бронирования</h2>
          <p className="text-lg font-medium">{booking.salesChannel.name}</p>
          {booking.channelListing ? (
            <p className="text-sm text-[#64748B]">Связано с объявлением</p>
          ) : null}
          {booking.isImported ? (
            <p className="text-sm text-[#64748B]">Импортировано из внешнего канала</p>
          ) : null}
        </section>
      </div>

      {commission && !commission.isOperatorOwned && commission.ratePercent != null ? (
        <section className="finance-card space-y-2 p-5">
          <h2 className="text-base font-semibold">Комиссия</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-[#64748B]">Ставка</dt>
              <dd className="font-medium">{commission.ratePercent}%</dd>
            </div>
            {commission.accrued != null ? (
              <div>
                <dt className="text-[#64748B]">Начислено</dt>
                <dd className="font-medium tabular-nums">
                  {formatMoney(commission.accrued)}
                </dd>
              </div>
            ) : null}
            {commission.received != null ? (
              <div>
                <dt className="text-[#64748B]">Получено</dt>
                <dd className="font-medium tabular-nums">
                  {formatMoney(commission.received)}
                </dd>
              </div>
            ) : null}
          </dl>
          <Link
            href="/crm/finance"
            className="inline-flex text-sm text-[var(--finance-blue)] hover:underline"
          >
            Открыть финансы
          </Link>
        </section>
      ) : null}

      <BookingFinancePanel
        bookingId={booking.id}
        bookingStatus={booking.status}
        initialFinance={finance}
      />

      <section className="finance-card space-y-4 p-5">
        <h2 className="text-base font-semibold">История</h2>
        {history.length === 0 ? (
          <p className="text-sm text-[#64748B]">Событий по этой брони пока нет.</p>
        ) : (
          <ol className="space-y-3 border-l border-[var(--finance-border)] pl-4">
            {history.map((entry) => (
              <li key={entry.id} className="relative">
                <span className="absolute -left-[1.3rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--finance-blue)]" />
                <p className="text-xs text-[#94A3B8]">{formatDate(entry.createdAt)}</p>
                <p className="text-sm font-medium">
                  {entry.title || guestHistoryTypeLabels[entry.type]}
                </p>
                {entry.description ? (
                  <p className="mt-0.5 text-sm text-[#64748B]">{entry.description}</p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        <Link
          href={`/crm/guests/${booking.guestId}#history`}
          className="inline-flex text-sm text-[var(--finance-blue)] hover:underline"
        >
          Полная история гостя
        </Link>
      </section>

      {cancelOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-booking-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 id="cancel-booking-title" className="text-lg font-semibold">
              Отменить бронирование?
            </h3>
            <dl className="mt-3 space-y-1 text-sm text-[#475569]">
              <div>
                <span className="text-[#94A3B8]">Объект: </span>
                {booking.property.name}
              </div>
              <div>
                <span className="text-[#94A3B8]">Даты: </span>
                {formatStayRangeShort(booking.checkIn, booking.checkOut)}
              </div>
              <div>
                <span className="text-[#94A3B8]">Гость: </span>
                {formatGuestName(booking.guest)}
              </div>
            </dl>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
                className="rounded-xl border border-[var(--finance-border)] px-4 py-2 text-sm font-medium"
              >
                Не отменять
              </button>
              <button
                type="button"
                disabled={Boolean(pending)}
                onClick={() => void run("cancel")}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {pending === "cancel" ? "Отмена…" : "Отменить бронирование"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
