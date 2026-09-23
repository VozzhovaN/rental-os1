"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  IconBuilding,
  IconCalendar,
  IconPlus,
  IconTrendingUp,
  IconUsers,
  IconWallet,
} from "@/components/crm/icons";
import { BookingChannelsPanel } from "@/components/dashboard/booking-channels-panel";
import { SalesCalendarPanel } from "@/components/dashboard/sales-calendar-panel";
import { TodayEventsPanel } from "@/components/dashboard/today-events-panel";
import type { BookingDTO } from "@/lib/bookings";
import {
  bookingBarClass,
  isSameUtcDay,
  layoutPropertyBookings,
} from "@/lib/calendar";
import type {
  DashboardChannelStats,
  DashboardData,
  DashboardFilters,
} from "@/lib/dashboard";
import { dashboardHref, shiftDashboardMonth } from "@/lib/dashboard";
import type {
  DashboardTodayEvents,
  SalesCalendarData,
} from "@/lib/dashboard-sidebar";
import {
  formatDate,
  formatGuestName,
  formatGuestsCount,
  formatMonthTitle,
  formatNights,
  formatWeekdayShort,
  nightsBetween,
  occupiesUtcDay,
  parseDateOnly,
  startOfUtcDay,
  utcDaysInMonth,
} from "@/lib/format";
import { bookingStatusLabels, calendarStatusLegend } from "@/lib/guest-labels";
import { formatMoney, propertyTypeLabels } from "@/lib/property-labels";
import type { PropertyDTO } from "@/lib/properties";

const DAY_COL_PX = 44;
const PROPERTY_COL_PX = 248;
const ROW_H = 56;
const VISIBLE_PROPERTY_ROWS = 6;
const DATE_HEADER_H = 48;

type DashboardViewProps = {
  data: DashboardData;
  filters: DashboardFilters;
  propertyOptions: PropertyDTO[];
  notice?: string;
  photoByPropertyId?: Record<string, string>;
  todayEvents: DashboardTodayEvents;
  salesCalendar: SalesCalendarData;
  channelStats: DashboardChannelStats;
};

const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function noticeMessage(notice?: string) {
  if (notice === "created") return "Бронирование создано";
  if (notice === "updated") return "Бронирование сохранено";
  return null;
}

function formatHumanDate(isoOrDate: Date | string) {
  const d = typeof isoOrDate === "string" ? parseDateOnly(isoOrDate) ?? new Date(isoOrDate) : isoOrDate;
  const day = d.getUTCDate();
  const month = MONTHS_GEN[d.getUTCMonth()]!;
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

function propertySubtitle(property: PropertyDTO) {
  const type =
    property.type === "STUDIO"
      ? "Студия"
      : property.type === "HOUSE"
        ? "Дом"
        : property.type === "APARTMENT"
          ? `${property.rooms}-комн.`
          : propertyTypeLabels[property.type];
  return `${type} · ${formatGuestsCount(property.guests)}`;
}

function isWeekend(day: Date) {
  const wd = day.getUTCDay();
  return wd === 0 || wd === 6;
}

export function DashboardView({
  data,
  filters,
  propertyOptions,
  notice,
  photoByPropertyId = {},
  todayEvents,
  salesCalendar,
  channelStats,
}: DashboardViewProps) {
  const router = useRouter();
  const [hoveredBooking, setHoveredBooking] = useState<BookingDTO | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [toast, setToast] = useState(() => noticeMessage(notice));
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const days = useMemo(
    () => utcDaysInMonth(filters.year, filters.month),
    [filters.year, filters.month],
  );
  const todayIso = startOfUtcDay(new Date()).toISOString().slice(0, 10);
  const today = parseDateOnly(todayIso) ?? startOfUtcDay(new Date());
  const prevMonth = shiftDashboardMonth(filters.year, filters.month, -1);
  const nextMonth = shiftDashboardMonth(filters.year, filters.month, 1);
  const todayHref = dashboardHref({
    ...filters,
    year: today.getUTCFullYear(),
    month: today.getUTCMonth() + 1,
    date: todayIso,
  });
  const calendarReturnTo = encodeURIComponent(dashboardHref(filters));
  const newBookingHref = `/crm/bookings/new?returnTo=${calendarReturnTo}`;

  const bookingsByProperty = useMemo(() => {
    const map = new Map<string, BookingDTO[]>();
    for (const booking of data.bookings) {
      const current = map.get(booking.propertyId) ?? [];
      current.push(booking);
      map.set(booking.propertyId, current);
    }
    return map;
  }, [data.bookings]);

  const occupancy = (() => {
    const total = data.properties.length;
    const occupied = new Set<string>();
    const todayDate = parseDateOnly(todayIso) ?? startOfUtcDay(new Date());
    for (const booking of data.bookings) {
      if (booking.status === "CANCELLED") continue;
      if (occupiesUtcDay(booking.checkIn, booking.checkOut, todayDate)) {
        occupied.add(booking.propertyId);
      }
    }
    const busy = occupied.size;
    const free = Math.max(0, total - busy);
    const pct = total > 0 ? Math.round((busy / total) * 100) : 0;
    return { total, busy, free, pct };
  })();

  const upcoming = [...data.bookings]
    .filter((b) => b.checkIn >= todayIso && b.status !== "CANCELLED")
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.id.localeCompare(b.id))
    .slice(0, 6);

  const pushFilters = useCallback(
    (patch: Partial<DashboardFilters>) => {
      router.push(dashboardHref({ ...filters, ...patch }));
    },
    [filters, router],
  );

  function showPopover(booking: BookingDTO, el: HTMLElement) {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    const rect = el.getBoundingClientRect();
    const cal = calendarRef.current?.getBoundingClientRect();
    setHoveredBooking(booking);
    setPopoverPos({
      top: rect.bottom - (cal?.top ?? 0) + 8,
      left: Math.min(
        Math.max(8, rect.left - (cal?.left ?? 0)),
        (cal?.width ?? 400) - 260,
      ),
    });
  }

  function hidePopoverSoon() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setHoveredBooking(null);
      setPopoverPos(null);
    }, 120);
  }

  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  const dateTitle = isSameUtcDay(filters.date, today)
    ? `Сегодня, ${formatHumanDate(filters.date)}`
    : formatHumanDate(filters.date);

  return (
    <div className="space-y-3">
      {toast ? (
        <div className="flex items-center justify-between rounded-xl border border-[#D6F1E5] bg-[#EFFAF5] px-3 py-2 text-sm text-[#0F766E]">
          <span>{toast}</span>
          <button
            type="button"
            className="text-xs font-medium hover:underline"
            onClick={() => setToast(null)}
          >
            Закрыть
          </button>
        </div>
      ) : null}

      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-[#0F172A] sm:text-[30px]">
            Dashboard
          </h1>
          <p className="mt-0.5 text-[14px] text-[#64748B]">Управление посуточной арендой</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="text-[13px] text-[#64748B]">{dateTitle}</p>
          <Link
            href={newBookingHref}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--finance-blue)] px-3 text-[13px] font-semibold text-white hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--finance-blue)]"
          >
            <IconPlus size={16} />
            Новая бронь
          </Link>
        </div>
      </div>

      {/* KPI */}
      <section className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Объекты"
          value={String(data.stats.properties)}
          hint="Активные"
          icon={<IconBuilding size={16} />}
          iconBg="bg-[#EEF3FF]"
          iconColor="text-[#3977F6]"
        />
        <KpiCard
          label="Заезды"
          value={String(data.stats.checkIns)}
          hint="Сегодня"
          icon={<IconUsers size={16} />}
          iconBg="bg-[#E9FAF4]"
          iconColor="text-[#12A87C]"
        />
        <KpiCard
          label="Выезды"
          value={String(data.stats.checkOuts)}
          hint="Сегодня"
          icon={<IconTrendingUp size={16} />}
          iconBg="bg-[#F3EEFF]"
          iconColor="text-[#7C5CFC]"
        />
        <KpiCard
          label="Доход"
          value={formatMoney(data.stats.income)}
          hint="За период"
          icon={<IconWallet size={16} />}
          iconBg="bg-[#E9FAF4]"
          iconColor="text-[#119B81]"
        />
        <KpiCard
          label="Брони"
          value={String(data.stats.bookings)}
          hint="За период"
          icon={<IconCalendar size={16} />}
          iconBg="bg-[#EEF3FF]"
          iconColor="text-[#4F6EF7]"
        />
      </section>

      {/* Today block removed — operational feed lives in right sidebar */}

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FilterSelect
          label="Объект"
          value={filters.propertyId ?? ""}
          onChange={(v) => pushFilters({ propertyId: v || undefined })}
        >
          <option value="">Все объекты</option>
          {propertyOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Тип объекта"
          value={filters.propertyType ?? ""}
          onChange={(v) =>
            pushFilters({
              propertyType: (v || undefined) as DashboardFilters["propertyType"],
            })
          }
        >
          <option value="">Все типы</option>
          <option value="APARTMENT">{propertyTypeLabels.APARTMENT}</option>
          <option value="STUDIO">{propertyTypeLabels.STUDIO}</option>
          <option value="HOUSE">{propertyTypeLabels.HOUSE}</option>
          <option value="OTHER">{propertyTypeLabels.OTHER}</option>
        </FilterSelect>
        <FilterSelect
          label="Статус брони"
          value={filters.bookingStatus ?? ""}
          onChange={(v) =>
            pushFilters({
              bookingStatus: (v || undefined) as DashboardFilters["bookingStatus"],
            })
          }
        >
          <option value="">Все актуальные</option>
          <option value="PENDING">Ожидают подтверждения</option>
          <option value="CONFIRMED">Подтверждены</option>
          <option value="COMPLETED">Завершены</option>
        </FilterSelect>
        <label className="relative flex h-11 items-center rounded-lg border border-[#DFE6F0] bg-white px-3">
          <span className="sr-only">Поиск объекта</span>
          <input
            type="search"
            defaultValue={filters.q ?? ""}
            placeholder="Поиск объекта…"
            className="w-full bg-transparent text-[13px] text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                pushFilters({ q: (e.target as HTMLInputElement).value.trim() || undefined });
              }
            }}
            onBlur={(e) => {
              const next = e.target.value.trim() || undefined;
              if ((next ?? "") !== (filters.q ?? "")) {
                pushFilters({ q: next });
              }
            }}
          />
        </label>
      </div>

      {/* Calendar + right sidebar */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,3.2fr)_minmax(260px,0.9fr)]">
        <div className="order-1 xl:col-start-2 xl:row-start-1">
          <TodayEventsPanel data={todayEvents} />
        </div>

        {/* Calendar */}
        <section className="finance-card order-2 min-w-0 overflow-hidden xl:col-start-1 xl:row-span-2 xl:row-start-1">
        <div className="flex flex-col gap-2 border-b border-[#EDF1F6] px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <h2 className="text-[16px] font-bold text-[#0F172A]">Календарь занятости</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={dashboardHref({ ...filters, ...prevMonth })}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DFE6F0] text-[#64748B] hover:bg-[var(--finance-hover)]"
              aria-label="Предыдущий месяц"
            >
              ←
            </Link>
            <Link
              href={todayHref}
              className="inline-flex h-8 items-center rounded-lg border border-[#DFE6F0] px-2.5 text-[12px] font-medium text-[#0F172A] hover:bg-[var(--finance-hover)]"
            >
              Сегодня
            </Link>
            <p className="min-w-[8.5rem] text-center text-[13px] font-semibold capitalize text-[#0F172A]">
              {formatMonthTitle(filters.year, filters.month)}
            </p>
            <Link
              href={dashboardHref({ ...filters, ...nextMonth })}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DFE6F0] text-[#64748B] hover:bg-[var(--finance-hover)]"
              aria-label="Следующий месяц"
            >
              →
            </Link>
            <Link
              href={newBookingHref}
              className="ml-1 inline-flex h-8 items-center gap-1 rounded-lg border border-[#DFE6F0] bg-white px-2.5 text-[12px] font-medium text-[#0F172A] hover:bg-[var(--finance-hover)]"
            >
              <IconPlus size={14} />
              Новая бронь
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 px-4 py-2 text-[11px] text-[#64748B]">
          {calendarStatusLegend.map((item) => (
            <span key={item.status} className="inline-flex items-center gap-1.5">
              <span
                className={`booking-legend-swatch booking-legend-${item.status.toLowerCase()}`}
              />
              {item.label}
            </span>
          ))}
        </div>

        {data.properties.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-[15px] font-semibold text-[#0F172A]">Нет объектов</p>
            <p className="mt-1 text-[13px] text-[#64748B]">
              Добавьте первый объект, чтобы начать работу с календарём бронирований.
            </p>
            <Link
              href="/crm/properties/new"
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--finance-blue)] px-3.5 text-[13px] font-semibold text-white"
            >
              <IconPlus size={16} />
              Добавить объект
            </Link>
          </div>
        ) : (
          <div ref={calendarRef} className="relative">
            <div
              className="overflow-auto overscroll-contain"
              style={{
                maxHeight: DATE_HEADER_H + VISIBLE_PROPERTY_ROWS * ROW_H,
              }}
              aria-label="Календарь объектов, прокрутка колёсиком"
            >
              <div style={{ minWidth: PROPERTY_COL_PX + days.length * DAY_COL_PX }}>
                {/* Sticky date header */}
                <div
                  className="sticky top-0 z-30 flex border-b border-[#EDF1F6] bg-white/95 backdrop-blur-sm"
                  style={{ height: DATE_HEADER_H }}
                >
                  <div
                    className="sticky left-0 z-40 flex shrink-0 items-center border-r border-[#EDF1F6] bg-white px-3 text-[11px] font-medium uppercase tracking-wide text-[#94A3B8]"
                    style={{ width: PROPERTY_COL_PX }}
                  >
                    Объект
                  </div>
                  <div className="flex min-w-0 flex-1">
                    {days.map((day) => {
                      const isToday = isSameUtcDay(day, today);
                      const weekend = isWeekend(day);
                      return (
                        <div
                          key={day.toISOString()}
                          className={`flex shrink-0 flex-col items-center justify-center text-[11px] ${
                            weekend && !isToday ? "bg-[#F8FAFC]" : ""
                          }`}
                          style={{ width: DAY_COL_PX }}
                        >
                          <span
                            className={`capitalize ${
                              weekend && !isToday ? "text-[#F87171]" : "text-[#94A3B8]"
                            }`}
                          >
                            {formatWeekdayShort(day)}
                          </span>
                          <span
                            className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                              isToday
                                ? "bg-[var(--finance-blue)] text-white"
                                : "text-[#0F172A]"
                            }`}
                          >
                            {String(day.getUTCDate()).padStart(2, "0")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {data.properties.map((property) => {
                  const spans = layoutPropertyBookings(
                    bookingsByProperty.get(property.id) ?? [],
                    days,
                  );
                  const photo = photoByPropertyId[property.id];

                  return (
                    <div
                      key={property.id}
                      className="flex border-b border-[#EDF1F6]"
                      style={{ height: ROW_H }}
                    >
                      <div
                        className="sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r border-[#EDF1F6] bg-white px-3"
                        style={{ width: PROPERTY_COL_PX }}
                      >
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photo}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#E8EEF6] text-[#94A3B8]">
                            <IconBuilding size={14} />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p
                            className="truncate text-[13px] font-semibold leading-tight text-[#0F172A]"
                            title={property.name}
                          >
                            {property.name}
                          </p>
                          <p className="truncate text-[11px] text-[#94A3B8]">
                            {propertySubtitle(property)}
                          </p>
                        </div>
                      </div>

                      <div className="relative min-w-0 flex-1" style={{ height: ROW_H }}>
                        <div className="absolute inset-0 flex">
                          {days.map((day) => {
                            const dateValue = day.toISOString().slice(0, 10);
                            const isToday = isSameUtcDay(day, today);
                            const weekend = isWeekend(day);
                            return (
                              <Link
                                key={day.toISOString()}
                                href={`/crm/bookings/new?propertyId=${property.id}&checkIn=${dateValue}&returnTo=${calendarReturnTo}`}
                                title={`Создать бронь: ${property.name}, ${formatDate(day)}`}
                                aria-label={`Свободный день ${formatDate(day)}, создать бронь для ${property.name}`}
                                className={`group flex shrink-0 items-center justify-center border-l border-[#F1F5F9] text-transparent transition-colors hover:bg-[#F0F7FF] hover:text-[var(--finance-blue)] ${
                                  isToday ? "bg-[#F0F7FF]/70" : weekend ? "bg-[#F8FAFC]" : ""
                                }`}
                                style={{ width: DAY_COL_PX }}
                              >
                                <span className="text-sm font-semibold opacity-0 group-hover:opacity-100">
                                  +
                                </span>
                              </Link>
                            );
                          })}
                        </div>

                        {spans.map((span) => {
                          const guestName = formatGuestName(span.booking.guest);
                          const statusLabel = bookingStatusLabels[span.booking.status];
                          const nights = nightsBetween(span.booking.checkIn, span.booking.checkOut);
                          const wide = span.dayCount >= 3;
                          const laneOffset = Math.min(span.lane, 1) * 22;
                          return (
                            <button
                              key={span.booking.id}
                              type="button"
                              className={bookingBarClass(span.booking.status)}
                              style={{
                                left: `calc(${span.startIndex} * ${DAY_COL_PX}px + 3px)`,
                                width: `calc(${span.dayCount} * ${DAY_COL_PX}px - 6px)`,
                                top: `${8 + laneOffset}px`,
                                height: "1.35rem",
                                bottom: "auto",
                              }}
                              aria-label={`${guestName}, ${statusLabel}, ${formatDate(span.booking.checkIn)} — ${formatDate(span.booking.checkOut)}`}
                              onMouseEnter={(e) => showPopover(span.booking, e.currentTarget)}
                              onMouseLeave={hidePopoverSoon}
                              onFocus={(e) => showPopover(span.booking, e.currentTarget)}
                              onBlur={hidePopoverSoon}
                              onClick={() => router.push(`/crm/bookings/${span.booking.id}`)}
                            >
                              <span className="min-w-0 truncate">
                                {wide
                                  ? `${guestName} · ${formatNights(nights)}`
                                  : guestName}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {data.properties.length > VISIBLE_PROPERTY_ROWS ? (
              <p className="border-t border-[#EDF1F6] px-4 py-1.5 text-center text-[11px] text-[#94A3B8]">
                Показаны {VISIBLE_PROPERTY_ROWS} из {data.properties.length} · прокрутите календарь
                колёсиком
              </p>
            ) : null}

            {hoveredBooking && popoverPos ? (
              <BookingPopover
                booking={hoveredBooking}
                style={{ top: popoverPos.top, left: popoverPos.left }}
                onMouseEnter={() => {
                  if (hoverTimer.current) clearTimeout(hoverTimer.current);
                }}
                onMouseLeave={hidePopoverSoon}
              />
            ) : null}
          </div>
        )}
      </section>

        <div className="order-3 xl:col-start-2 xl:row-start-2">
          <SalesCalendarPanel initialData={salesCalendar} />
        </div>
      </div>

      {/* Bottom blocks */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-[1.7fr_1fr_0.9fr]">
        <div className="finance-card min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-[#EDF1F6] px-3 py-2">
            <h2 className="text-[15px] font-semibold text-[#0F172A]">Ближайшие брони</h2>
            <Link
              href="/crm/bookings"
              className="shrink-0 text-[11px] font-medium text-[var(--finance-blue)] hover:underline"
            >
              Все →
            </Link>
          </div>
          <div className="max-h-[220px] overflow-auto">
            <table className="min-w-full text-left text-[12px]">
              <thead className="sticky top-0 bg-white text-[10px] text-[#94A3B8]">
                <tr className="border-b border-[#EDF1F6]">
                  <th className="px-3 py-1.5 font-medium">Гость</th>
                  <th className="px-3 py-1.5 font-medium">Объект</th>
                  <th className="px-3 py-1.5 font-medium">Заезд</th>
                  <th className="px-3 py-1.5 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-[12px] text-[#94A3B8]">
                      Нет ближайших бронирований
                    </td>
                  </tr>
                ) : (
                  upcoming.map((booking) => (
                    <tr
                      key={booking.id}
                      className="cursor-pointer border-b border-[#EDF1F6] hover:bg-[#F8FAFD]"
                      onClick={() => router.push(`/crm/bookings/${booking.id}`)}
                    >
                      <td className="max-w-[90px] truncate px-3 py-1.5 font-medium text-[#0F172A]">
                        {formatGuestName(booking.guest)}
                      </td>
                      <td className="max-w-[90px] truncate px-3 py-1.5 text-[#64748B]">
                        {booking.property.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-[#64748B]">
                        {formatDate(booking.checkIn)}
                      </td>
                      <td className="px-3 py-1.5">
                        <StatusBadge status={booking.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <BookingChannelsPanel data={channelStats} />

        <div className="finance-card p-3">
          <h2 className="text-[15px] font-semibold text-[#0F172A]">Загрузка объектов</h2>
          <p className="mt-0.5 text-[11px] text-[#94A3B8]">На сегодня · по видимым объектам</p>
          <p className="mt-2.5 text-[24px] font-bold tabular-nums leading-none text-[#0F172A]">
            {occupancy.pct}%
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E8EEF6]">
            <div
              className="h-full rounded-full bg-[var(--finance-blue)] transition-[width]"
              style={{ width: `${occupancy.pct}%` }}
            />
          </div>
          <dl className="mt-2.5 space-y-1 text-[12px]">
            <div className="flex justify-between">
              <dt className="text-[#64748B]">Занято</dt>
              <dd className="font-semibold tabular-nums text-[#0F172A]">{occupancy.busy}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#64748B]">Свободно</dt>
              <dd className="font-semibold tabular-nums text-[#0F172A]">{occupancy.free}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#64748B]">Всего</dt>
              <dd className="font-semibold tabular-nums text-[#0F172A]">{occupancy.total}</dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="finance-card flex min-h-[92px] flex-col p-3">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${iconBg} ${iconColor}`}
        >
          {icon}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-[#64748B]">
          {label}
        </span>
      </div>
      <p className="mt-2 text-[24px] font-bold leading-none tabular-nums tracking-tight text-[#0F172A]">
        {value}
      </p>
      <p className="mt-auto pt-1.5 text-[11px] text-[#94A3B8]">{hint}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="relative flex h-11 items-center rounded-lg border border-[#DFE6F0] bg-white px-3">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-transparent text-[13px] text-[#0F172A] outline-none"
      >
        {children}
      </select>
    </label>
  );
}

function StatusBadge({ status }: { status: BookingDTO["status"] }) {
  const styles =
    status === "PENDING"
      ? "bg-[#FFF4E5] text-[#B45309]"
      : status === "CONFIRMED"
        ? "bg-[#E9FAF4] text-[#0F766E]"
        : status === "COMPLETED"
          ? "bg-[#F1F5F9] text-[#475569]"
          : "bg-[#FEE2E2] text-[#B91C1C]";
  return (
    <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${styles}`}>
      {bookingStatusLabels[status]}
    </span>
  );
}

function BookingPopover({
  booking,
  style,
  onMouseEnter,
  onMouseLeave,
}: {
  booking: BookingDTO;
  style: { top: number; left: number };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  return (
    <div
      role="dialog"
      aria-label="Бронирование"
      className="absolute z-50 w-[240px] rounded-xl border border-[#E6ECF2] bg-white p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <p className="text-[14px] font-bold text-[#0F172A]">{formatGuestName(booking.guest)}</p>
      <p className="mt-1 text-[12px] text-[#64748B]">{booking.property.name}</p>
      <p className="mt-0.5 text-[12px] text-[#64748B]">
        {formatDate(booking.checkIn)} — {formatDate(booking.checkOut)}
      </p>
      <p className="mt-0.5 text-[12px] text-[#64748B]">
        {formatNights(nights)} · {formatGuestsCount(booking.guestsCount)}
      </p>
      <p className="mt-2 text-[12px] font-semibold text-[#0F172A]">
        {bookingStatusLabels[booking.status]}
      </p>
      <p className="mt-0.5 text-[13px] font-bold tabular-nums text-[#0F172A]">
        {formatMoney(booking.totalAmount)}
      </p>
      <Link
        href={`/crm/bookings/${booking.id}`}
        className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-lg bg-[var(--finance-blue)] text-[12px] font-semibold text-white hover:brightness-95"
      >
        Открыть бронь
      </Link>
    </div>
  );
}
