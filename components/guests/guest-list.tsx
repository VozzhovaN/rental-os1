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
import { IconPlus, IconUsers } from "@/components/crm/icons";
import { formatDate, formatGuestName } from "@/lib/format";
import { messengerTypeLabels } from "@/lib/guest-labels";
import type { GuestListItemDTO } from "@/lib/guests";
import {
  guestAvatarTone,
  guestInitials,
  guestUiStatusClass,
  guestUiStatusLabels,
  telegramHref,
} from "@/lib/guest-status";
import { normalizePhoneDigits } from "@/lib/guests";

type BookingFilter = "ALL" | "ACTIVE" | "FUTURE" | "NONE";
type MessengerFilter = "ALL" | "TELEGRAM" | "MAX" | "NONE";

export type GuestListKpi = {
  total: number;
  active: number;
  neu: number;
  repeat: number;
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

function Avatar({ guest }: { guest: GuestListItemDTO }) {
  return (
    <span
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${guestAvatarTone(guest.id)}`}
      aria-hidden
    >
      {guestInitials(guest)}
    </span>
  );
}

function StatusBadge({ guest }: { guest: GuestListItemDTO }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${guestUiStatusClass[guest.uiStatus]}`}
    >
      {guestUiStatusLabels[guest.uiStatus]}
    </span>
  );
}

function MessengerLabel({ guest }: { guest: GuestListItemDTO }) {
  if (!guest.messengerType) return <>Не указан</>;
  return (
    <>
      {messengerTypeLabels[guest.messengerType]}
      {guest.messengerContact ? ` · ${guest.messengerContact}` : ""}
    </>
  );
}

function QuickMenu({ guest }: { guest: GuestListItemDTO }) {
  const [open, setOpen] = useState(false);
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

  const tg = guest.messengerType === "TELEGRAM"
    ? telegramHref(guest.messengerContact)
    : null;

  const items: { href?: string; label: string; external?: boolean }[] = [
    { href: `/crm/guests/${guest.id}`, label: "Открыть" },
    { href: `/crm/guests/${guest.id}/edit`, label: "Редактировать" },
    { href: `/crm/bookings/new?guestId=${guest.id}`, label: "Создать бронь" },
    { href: `/crm/guests/${guest.id}#history`, label: "История" },
  ];

  if (guest.phone) {
    items.push({ href: `tel:${guest.phone.replace(/\s/g, "")}`, label: "Позвонить", external: true });
  }
  if (tg) {
    items.push({ href: tg, label: "Написать в Telegram", external: true });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Быстрые действия"
        title="Быстрые действия"
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
          {items.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                role="menuitem"
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noreferrer" : undefined}
                className="block px-3 py-2 text-sm hover:bg-[var(--finance-hover)]"
                onClick={(e) => e.stopPropagation()}
              >
                {item.label}
              </Link>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  );
}

function matchesSearch(guest: GuestListItemDTO, query: string) {
  if (!query) return true;
  const q = query.toLowerCase();
  const name = formatGuestName(guest).toLowerCase();
  const phone = (guest.phone ?? "").toLowerCase();
  const phoneDigits = normalizePhoneDigits(guest.phone);
  const email = (guest.email ?? "").toLowerCase();
  const needleDigits = query.replace(/\D/g, "");
  return (
    name.includes(q) ||
    phone.includes(q) ||
    email.includes(q) ||
    (needleDigits.length >= 3 && phoneDigits.includes(needleDigits))
  );
}

function formatStayRange(checkIn: string, checkOut: string) {
  return `${formatDate(checkIn)} – ${formatDate(checkOut)}`;
}

export function GuestList({
  guests,
  kpi,
}: {
  guests: GuestListItemDTO[];
  kpi: GuestListKpi;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>("ALL");
  const [messengerFilter, setMessengerFilter] = useState<MessengerFilter>("ALL");

  const filtered = useMemo(() => {
    return guests.filter((guest) => {
      if (!matchesSearch(guest, search.trim())) return false;

      if (bookingFilter === "ACTIVE" && !guest.hasActiveStay) return false;
      if (bookingFilter === "FUTURE" && !guest.hasFutureBooking) return false;
      if (bookingFilter === "NONE" && guest.bookingsCount !== 0) return false;

      if (messengerFilter === "NONE" && guest.messengerType) return false;
      if (messengerFilter === "TELEGRAM" && guest.messengerType !== "TELEGRAM") {
        return false;
      }
      if (messengerFilter === "MAX" && guest.messengerType !== "MAX") return false;

      return true;
    });
  }, [guests, search, bookingFilter, messengerFilter]);

  function openGuest(id: string) {
    router.push(`/crm/guests/${id}`);
  }

  function onRowKey(event: KeyboardEvent, id: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openGuest(id);
    }
  }

  if (guests.length === 0) {
    return (
      <div className="finance-card px-6 py-14 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--finance-blue-light)] text-[var(--finance-blue)]">
          <IconUsers size={24} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-[var(--finance-text)]">
          Нет гостей
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--finance-text-secondary)]">
          Добавьте первого гостя или создайте его во время бронирования.
        </p>
        <Link
          href="/crm/guests/new"
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--finance-blue)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          <IconPlus size={16} />
          Добавить гостя
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Всего гостей" value={String(kpi.total)} hint="в базе" />
        <KpiCard
          label="С активными бронями"
          value={String(kpi.active)}
          hint="сейчас проживают"
        />
        <KpiCard
          label="Новые за период"
          value={String(kpi.neu)}
          hint="за 30 дней"
        />
        <KpiCard
          label="Повторные гости"
          value={String(kpi.repeat)}
          hint="более одной брони"
        />
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Поиск гостя</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Имя, телефон или email"
            className="w-full rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--finance-blue)] focus:ring-2 focus:ring-[var(--finance-blue)]/15"
          />
        </label>
        <select
          aria-label="Фильтр по броням"
          value={bookingFilter}
          onChange={(e) => setBookingFilter(e.target.value as BookingFilter)}
          className="rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm"
        >
          <option value="ALL">Все гости</option>
          <option value="ACTIVE">Есть активная бронь</option>
          <option value="FUTURE">Есть будущая бронь</option>
          <option value="NONE">Без бронирований</option>
        </select>
        <select
          aria-label="Фильтр по мессенджеру"
          value={messengerFilter}
          onChange={(e) => setMessengerFilter(e.target.value as MessengerFilter)}
          className="rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm"
        >
          <option value="ALL">Мессенджер</option>
          <option value="TELEGRAM">Telegram</option>
          <option value="MAX">MAX</option>
          <option value="NONE">Не указан</option>
        </select>
      </div>

      <p className="text-xs text-[var(--finance-text-muted)]">
        Показано {filtered.length} из {guests.length}
      </p>

      {filtered.length === 0 ? (
        <div className="finance-card px-6 py-10 text-center text-sm text-[var(--finance-text-secondary)]">
          Нет гостей по выбранным фильтрам
        </div>
      ) : (
        <>
          <div className="finance-card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[var(--finance-border)] text-[11px] uppercase tracking-wide text-[#94A3B8]">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Гость</th>
                    <th className="px-3 py-2.5 font-medium">Контакты</th>
                    <th className="px-3 py-2.5 font-medium">Мессенджер</th>
                    <th className="px-3 py-2.5 font-medium">Бронирований</th>
                    <th className="px-3 py-2.5 font-medium">Последнее проживание</th>
                    <th className="px-3 py-2.5 font-medium">Ближайшая бронь</th>
                    <th className="px-3 py-2.5 font-medium">Статус</th>
                    <th className="px-3 py-2.5 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((guest) => (
                    <tr
                      key={guest.id}
                      tabIndex={0}
                      role="link"
                      aria-label={`Открыть ${formatGuestName(guest)}`}
                      className="cursor-pointer border-b border-[var(--finance-border)] last:border-0 hover:bg-[var(--finance-hover)] focus-visible:bg-[var(--finance-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--finance-blue)]"
                      onClick={() => openGuest(guest.id)}
                      onKeyDown={(e) => onRowKey(e, guest.id)}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar guest={guest} />
                          <div>
                            <p className="font-medium text-[var(--finance-text)]">
                              {formatGuestName(guest)}
                            </p>
                            {guest.isRepeat ? (
                              <span className="mt-0.5 inline-flex rounded-md bg-[#EEF2FF] px-1.5 py-0.5 text-[10px] font-medium text-[#4338CA]">
                                Повторный гость
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[var(--finance-text-secondary)]">
                        <div className="space-y-0.5">
                          <p>{guest.phone || "Не указан"}</p>
                          <p className="text-xs">{guest.email || "Не указан"}</p>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <MessengerLabel guest={guest} />
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {guest.bookingsCount}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--finance-text-secondary)]">
                        {guest.lastBooking
                          ? formatStayRange(
                              guest.lastBooking.checkIn,
                              guest.lastBooking.checkOut,
                            )
                          : "Не указан"}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--finance-text-secondary)]">
                        {guest.nextBooking
                          ? formatStayRange(
                              guest.nextBooking.checkIn,
                              guest.nextBooking.checkOut,
                            )
                          : "Не указан"}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge guest={guest} />
                      </td>
                      <td
                        className="px-3 py-2.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <QuickMenu guest={guest} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 md:hidden">
            {filtered.map((guest) => (
              <article
                key={guest.id}
                className="finance-card p-4"
                onClick={() => openGuest(guest.id)}
                onKeyDown={(e) => onRowKey(e, guest.id)}
                tabIndex={0}
                role="link"
                aria-label={`Открыть ${formatGuestName(guest)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Avatar guest={guest} />
                    <div>
                      <h2 className="font-semibold text-[var(--finance-text)]">
                        {formatGuestName(guest)}
                      </h2>
                      <p className="mt-0.5 text-sm text-[var(--finance-text-secondary)]">
                        {guest.phone || "Не указан"}
                      </p>
                      <p className="text-xs text-[var(--finance-text-muted)]">
                        <MessengerLabel guest={guest} />
                      </p>
                    </div>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <QuickMenu guest={guest} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge guest={guest} />
                  {guest.isRepeat ? (
                    <span className="inline-flex rounded-md bg-[#EEF2FF] px-1.5 py-0.5 text-[10px] font-medium text-[#4338CA]">
                      Повторный гость
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-[var(--finance-text-muted)]">
                  {guest.nextBooking
                    ? `Ближайшая: ${formatStayRange(guest.nextBooking.checkIn, guest.nextBooking.checkOut)}`
                    : guest.lastBooking
                      ? `Последнее: ${formatStayRange(guest.lastBooking.checkIn, guest.lastBooking.checkOut)}`
                      : "Нет бронирований"}
                </p>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
