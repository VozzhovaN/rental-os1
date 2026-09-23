"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconPlus } from "@/components/crm/icons";
import { GuestNoteForm } from "@/components/guests/guest-note-form";
import {
  formatDate,
  formatDateTime,
  formatGuestName,
  formatNights,
  nightsBetween,
} from "@/lib/format";
import type { BookingDTO } from "@/lib/bookings";
import type { GuestHistoryDTO } from "@/lib/guest-history";
import {
  bookingStatusLabels,
  guestHistoryTypeLabels,
  messengerTypeLabels,
} from "@/lib/guest-labels";
import type { GuestDTO } from "@/lib/guests";
import {
  guestAvatarTone,
  guestInitials,
  guestUiStatusClass,
  guestUiStatusLabels,
  pickNextBooking,
  telegramHref,
  type GuestUiStatus,
} from "@/lib/guest-status";
import { formatMoney } from "@/lib/property-labels";

function Section({
  title,
  children,
  action,
  id,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="finance-card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--finance-text-muted)]">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function HeaderMenu({ guest }: { guest: GuestDTO }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tg =
    guest.messengerType === "TELEGRAM"
      ? telegramHref(guest.messengerContact)
      : null;

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

  const items: { href: string; label: string; external?: boolean }[] = [
    { href: `/crm/guests/${guest.id}/edit`, label: "Редактировать" },
    { href: `#history`, label: "История" },
  ];
  if (guest.phone) {
    items.push({
      href: `tel:${guest.phone.replace(/\s/g, "")}`,
      label: "Позвонить",
      external: true,
    });
  }
  if (guest.email) {
    items.push({
      href: `mailto:${guest.email}`,
      label: "Написать email",
      external: true,
    });
  }
  if (tg) {
    items.push({ href: tg, label: "Написать в Telegram", external: true });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Дополнительные действия"
        title="Дополнительные действия"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--finance-border)] bg-white text-[#64748B] hover:bg-[var(--finance-hover)]"
      >
        ⋯
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-[var(--finance-border)] bg-white py-1 shadow-[var(--finance-shadow)]"
        >
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              role="menuitem"
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noreferrer" : undefined}
              className="block px-3 py-2 text-sm hover:bg-[var(--finance-hover)]"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DangerZone({ guest }: { guest: GuestDTO }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (
      !window.confirm(
        `Удалить гостя «${formatGuestName(guest)}»? Это действие нельзя отменить.`,
      )
    ) {
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/guests/${guest.id}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось удалить гостя");
      }
      router.push("/crm/guests");
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось удалить гостя",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="finance-card border-[var(--finance-red-light)] p-4 sm:p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--finance-red)]">
        Опасная зона
      </h2>
      <p className="mt-2 text-sm text-[var(--finance-text-secondary)]">
        Удаление запрещено, если у гостя есть бронирования или долгосрочные
        договоры.
      </p>
      {error ? (
        <p className="mt-3 rounded-lg bg-[var(--finance-red-light)] px-3 py-2 text-sm text-[var(--finance-red)]">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={pending}
        className="mt-4 rounded-xl border border-[var(--finance-red)]/30 px-4 py-2 text-sm font-medium text-[var(--finance-red)] hover:bg-[var(--finance-red-light)] disabled:opacity-50"
      >
        {pending ? "Удаление..." : "Удалить гостя"}
      </button>
    </section>
  );
}

export function GuestDetailView({
  guest,
  bookings,
  history,
  uiStatus,
  isRepeat,
}: {
  guest: GuestDTO;
  bookings: BookingDTO[];
  history: GuestHistoryDTO[];
  uiStatus: GuestUiStatus;
  isRepeat: boolean;
}) {
  const upcoming = pickNextBooking(
    bookings.map((b) => ({
      id: b.id,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      status: b.status,
      propertyName: b.property.name,
    })),
  );

  const upcomingFull = upcoming
    ? bookings.find((b) => b.id === upcoming.id) ?? null
    : null;

  const completed = bookings.filter((b) => b.status === "COMPLETED").length;
  const upcomingCount = bookings.filter(
    (b) => b.status === "PENDING" || b.status === "CONFIRMED",
  ).length;
  const totalAmount = bookings
    .filter((b) => b.status !== "CANCELLED")
    .reduce((sum, b) => sum + b.totalAmount, 0);

  const name = formatGuestName(guest);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/crm/guests"
          className="text-sm text-[var(--finance-text-secondary)] hover:text-[var(--finance-text)]"
        >
          ← К списку гостей
        </Link>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold ${guestAvatarTone(guest.id)}`}
              aria-hidden
            >
              {guestInitials(guest)}
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--finance-text)]">
                {name}
              </h1>
              <div className="mt-1 space-y-0.5 text-sm text-[var(--finance-text-secondary)]">
                <p>
                  {guest.phone ? (
                    <a
                      href={`tel:${guest.phone.replace(/\s/g, "")}`}
                      className="hover:text-[var(--finance-blue)] hover:underline"
                    >
                      {guest.phone}
                    </a>
                  ) : (
                    "Не указан"
                  )}
                </p>
                <p>
                  {guest.email ? (
                    <a
                      href={`mailto:${guest.email}`}
                      className="hover:text-[var(--finance-blue)] hover:underline"
                    >
                      {guest.email}
                    </a>
                  ) : (
                    "Не указан"
                  )}
                </p>
                <p>
                  {guest.messengerType
                    ? `${messengerTypeLabels[guest.messengerType]}${
                        guest.messengerContact
                          ? ` · ${guest.messengerContact}`
                          : ""
                      }`
                    : "Мессенджер не указан"}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span
                  className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${guestUiStatusClass[uiStatus]}`}
                >
                  {guestUiStatusLabels[uiStatus]}
                </span>
                {isRepeat ? (
                  <span className="inline-flex rounded-md bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-medium text-[#4338CA]">
                    Повторный гость
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/crm/bookings/new?guestId=${guest.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--finance-blue)] px-3.5 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              <IconPlus size={16} />
              Новая бронь
            </Link>
            <Link
              href={`/crm/guests/${guest.id}/edit`}
              className="inline-flex rounded-xl border border-[var(--finance-border)] bg-white px-3.5 py-2 text-sm font-medium hover:bg-[var(--finance-hover)]"
            >
              Редактировать
            </Link>
            <HeaderMenu guest={guest} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Всего бронирований", value: String(bookings.length) },
          { label: "Предстоящие", value: String(upcomingCount) },
          { label: "Завершённые", value: String(completed) },
          {
            label: "Общая сумма бронирований",
            value: formatMoney(totalAmount),
          },
        ].map((item) => (
          <div key={item.label} className="finance-card p-3">
            <p className="text-[11px] uppercase tracking-wide text-[var(--finance-text-muted)]">
              {item.label}
            </p>
            <p className="mt-1.5 text-lg font-semibold tabular-nums text-[var(--finance-text)]">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Контакты">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--finance-text-muted)]">
                Телефон
              </dt>
              <dd className="mt-0.5 text-sm font-medium">
                {guest.phone ? (
                  <a
                    href={`tel:${guest.phone.replace(/\s/g, "")}`}
                    className="hover:text-[var(--finance-blue)] hover:underline"
                  >
                    {guest.phone}
                  </a>
                ) : (
                  "Не указан"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--finance-text-muted)]">
                Email
              </dt>
              <dd className="mt-0.5 text-sm font-medium">
                {guest.email ? (
                  <a
                    href={`mailto:${guest.email}`}
                    className="hover:text-[var(--finance-blue)] hover:underline"
                  >
                    {guest.email}
                  </a>
                ) : (
                  "Не указан"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--finance-text-muted)]">
                Мессенджер
              </dt>
              <dd className="mt-0.5 text-sm font-medium">
                {guest.messengerType
                  ? messengerTypeLabels[guest.messengerType]
                  : "Не указан"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--finance-text-muted)]">
                Контакт в мессенджере
              </dt>
              <dd className="mt-0.5 text-sm font-medium">
                {guest.messengerContact || "Не указан"}
              </dd>
            </div>
            {guest.comment ? (
              <div className="sm:col-span-2">
                <dt className="text-[11px] uppercase tracking-wide text-[var(--finance-text-muted)]">
                  Комментарий
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-sm">
                  {guest.comment}
                </dd>
              </div>
            ) : null}
          </dl>
        </Section>

        {upcomingFull ? (
          <Section
            title="Ближайшая бронь"
            action={
              bookings.length > 1 ? (
                <a
                  href="#bookings"
                  className="text-xs font-medium text-[var(--finance-blue)] hover:underline"
                >
                  Все бронирования
                </a>
              ) : null
            }
          >
            <p className="text-base font-semibold text-[var(--finance-text)]">
              {upcomingFull.property.name}
            </p>
            <p className="mt-1 text-sm text-[var(--finance-text-secondary)]">
              {formatDate(upcomingFull.checkIn)} –{" "}
              {formatDate(upcomingFull.checkOut)}
            </p>
            <p className="mt-1 text-sm text-[var(--finance-text-muted)]">
              {formatNights(
                nightsBetween(upcomingFull.checkIn, upcomingFull.checkOut),
              )}{" "}
              · {upcomingFull.guestsCount} гост.
            </p>
            <p className="mt-2 text-sm font-medium">
              {bookingStatusLabels[upcomingFull.status]}
            </p>
            <Link
              href={`/crm/bookings/${upcomingFull.id}`}
              className="mt-4 inline-flex rounded-xl bg-[var(--finance-blue)] px-3.5 py-2 text-sm font-medium text-white"
            >
              Открыть бронь
            </Link>
          </Section>
        ) : (
          <Section title="Ближайшая бронь">
            <p className="text-sm text-[var(--finance-text-secondary)]">
              У гостя пока нет бронирований.
            </p>
            <Link
              href={`/crm/bookings/new?guestId=${guest.id}`}
              className="mt-4 inline-flex rounded-xl bg-[var(--finance-blue)] px-3.5 py-2 text-sm font-medium text-white"
            >
              + Создать бронь
            </Link>
          </Section>
        )}
      </div>

      <Section id="bookings" title="История бронирований">
        {bookings.length === 0 ? (
          <div>
            <p className="text-sm text-[var(--finance-text-secondary)]">
              У гостя пока нет бронирований.
            </p>
            <Link
              href={`/crm/bookings/new?guestId=${guest.id}`}
              className="mt-4 inline-flex rounded-xl bg-[var(--finance-blue)] px-3.5 py-2 text-sm font-medium text-white"
            >
              + Создать бронь
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--finance-border)] text-[11px] uppercase tracking-wide text-[#94A3B8]">
                <tr>
                  <th className="py-2 pr-3 font-medium">Объект</th>
                  <th className="py-2 pr-3 font-medium">Даты</th>
                  <th className="py-2 pr-3 font-medium">Статус</th>
                  <th className="py-2 pr-3 font-medium">Канал</th>
                  <th className="py-2 pr-3 font-medium">Сумма</th>
                  <th className="py-2 font-medium">Действие</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => {
                  const muted = booking.status === "CANCELLED";
                  return (
                    <tr
                      key={booking.id}
                      className={`border-b border-[var(--finance-border)] last:border-0 ${
                        muted ? "opacity-55" : ""
                      }`}
                    >
                      <td className="py-2.5 pr-3 font-medium">
                        {booking.property.name}
                      </td>
                      <td className="py-2.5 pr-3 text-[var(--finance-text-secondary)]">
                        {formatDate(booking.checkIn)} –{" "}
                        {formatDate(booking.checkOut)}
                      </td>
                      <td className="py-2.5 pr-3">
                        {bookingStatusLabels[booking.status]}
                      </td>
                      <td className="py-2.5 pr-3 text-[var(--finance-text-secondary)]">
                        {booking.salesChannel.name}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums">
                        {formatMoney(booking.totalAmount)}
                      </td>
                      <td className="py-2.5">
                        <Link
                          href={`/crm/bookings/${booking.id}`}
                          className="text-[var(--finance-blue)] hover:underline"
                        >
                          Открыть
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section id="history" title="История взаимодействий">
        {history.length === 0 ? (
          <p className="mb-4 text-sm text-[var(--finance-text-secondary)]">
            История взаимодействий пока пуста.
          </p>
        ) : (
          <ol className="relative mb-5 space-y-0 border-l border-[var(--finance-border)] ml-2">
            {history.map((entry) => (
              <li key={entry.id} className="relative pb-5 pl-5 last:pb-0">
                <span
                  className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[var(--finance-blue)]"
                  aria-hidden
                />
                <p className="text-xs text-[var(--finance-text-muted)]">
                  {formatDateTime(entry.createdAt)}
                </p>
                <p className="mt-0.5 text-sm font-medium text-[var(--finance-text)]">
                  {guestHistoryTypeLabels[entry.type]}
                </p>
                <p className="text-sm text-[var(--finance-text-secondary)]">
                  {entry.title}
                </p>
                {entry.description ? (
                  <p className="mt-0.5 whitespace-pre-line text-sm text-[var(--finance-text-muted)]">
                    {entry.description}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        <GuestNoteForm guestId={guest.id} />
      </Section>

      <DangerZone guest={guest} />
    </div>
  );
}
