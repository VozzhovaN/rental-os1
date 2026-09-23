"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconEye,
  IconHandshake,
  IconWallet,
} from "@/components/crm/icons";
import type {
  SalesCalendarData,
  SalesCalendarEvent,
  SalesCalendarEventKind,
} from "@/lib/dashboard-sidebar";
import { shiftDashboardMonth } from "@/lib/dashboard";
import { formatMonthTitle, startOfUtcDay, utcDaysInMonth } from "@/lib/format";
import { formatMoney } from "@/lib/property-labels";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const MONTHS_GEN = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const DOT_COLOR: Record<SalesCalendarEventKind, string> = {
  VIEWING: "bg-[#9565E3]",
  DEPOSIT: "bg-[#F7834A]",
  PURCHASE: "bg-[#119B81]",
};

const KIND_CHIP: Record<
  SalesCalendarEventKind,
  { className: string; icon: typeof IconEye }
> = {
  VIEWING: { className: "text-[#6D28D9] bg-[#F5F0FF]", icon: IconEye },
  DEPOSIT: { className: "text-[#C2410C] bg-[#FFF4EC]", icon: IconWallet },
  PURCHASE: { className: "text-[#0F766E] bg-[#ECFAF5]", icon: IconHandshake },
};

function formatHumanDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS_GEN[m - 1]}`;
}

function mondayFirstWeekday(day: Date) {
  const wd = day.getUTCDay();
  return wd === 0 ? 6 : wd - 1;
}

type SalesCalendarPanelProps = {
  initialData: SalesCalendarData;
};

export function SalesCalendarPanel({ initialData }: SalesCalendarPanelProps) {
  const todayIso = startOfUtcDay(new Date()).toISOString().slice(0, 10);
  const [data, setData] = useState(initialData);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const dayMap = useMemo(() => {
    const map = new Map<string, { kinds: SalesCalendarEventKind[]; extra: number }>();
    for (const day of data.days) {
      map.set(day.date, { kinds: day.kinds, extra: day.extra });
    }
    return map;
  }, [data.days]);

  const selectedEvents = useMemo(
    () =>
      data.events
        .filter((event) => event.day === selectedDate)
        .slice()
        .sort((a, b) => {
          if (a.sortAt && b.sortAt) return a.sortAt.localeCompare(b.sortAt);
          if (a.sortAt) return -1;
          if (b.sortAt) return 1;
          return 0;
        }),
    [data.events, selectedDate],
  );

  const loadMonth = useCallback(
    async (year: number, month: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/dashboard/sales-calendar?year=${year}&month=${month}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          throw new Error("load_failed");
        }
        const next = (await res.json()) as SalesCalendarData;
        setData(next);
        setSelectedDate((current) => {
          const inMonth = current.startsWith(
            `${year}-${String(month).padStart(2, "0")}`,
          );
          if (inMonth) return current;
          const today = startOfUtcDay(new Date());
          if (today.getUTCFullYear() === year && today.getUTCMonth() + 1 === month) {
            return todayIso;
          }
          return new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
        });
      } catch {
        setError("Не удалось загрузить календарь продаж");
      } finally {
        setLoading(false);
      }
    },
    [todayIso],
  );

  const goPrev = () => {
    const next = shiftDashboardMonth(data.year, data.month, -1);
    void loadMonth(next.year, next.month);
  };

  const goNext = () => {
    const next = shiftDashboardMonth(data.year, data.month, 1);
    void loadMonth(next.year, next.month);
  };

  const goToday = () => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    setSelectedDate(todayIso);
    if (data.year !== year || data.month !== month) {
      void loadMonth(year, month);
    }
  };

  const days = utcDaysInMonth(data.year, data.month);
  const leading = mondayFirstWeekday(days[0]!);
  const cells: Array<Date | null> = [
    ...Array.from({ length: leading }, () => null),
    ...days,
  ];
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return (
    <section className="finance-card flex flex-col p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-tight text-[#0F172A]">
          Календарь продаж
        </h2>
        <button
          type="button"
          onClick={goToday}
          className="inline-flex h-7 items-center rounded-md border border-[#E7ECF3] px-2 text-[11px] font-medium text-[#0F172A] hover:bg-[var(--finance-hover)]"
        >
          Сегодня
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={goPrev}
          disabled={loading}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E7ECF3] text-[#64748B] hover:bg-[var(--finance-hover)] disabled:opacity-50"
          aria-label="Предыдущий месяц"
        >
          <IconChevronLeft size={14} />
        </button>
        <p className="text-[12px] font-semibold capitalize text-[#0F172A]">
          {formatMonthTitle(data.year, data.month)}
        </p>
        <button
          type="button"
          onClick={goNext}
          disabled={loading}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E7ECF3] text-[#64748B] hover:bg-[var(--finance-hover)] disabled:opacity-50"
          aria-label="Следующий месяц"
        >
          <IconChevronRight size={14} />
        </button>
      </div>

      <div className={`mt-1.5 ${loading ? "opacity-60" : ""}`}>
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((label) => (
            <div
              key={label}
              className="py-0.5 text-center text-[10px] font-medium text-[#94A3B8]"
            >
              {label}
            </div>
          ))}
          {cells.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="h-8" />;
            }
            const iso = day.toISOString().slice(0, 10);
            const summary = dayMap.get(iso);
            const isToday = iso === todayIso;
            const isSelected = iso === selectedDate;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelectedDate(iso)}
                className={`flex h-8 flex-col items-center justify-center rounded-md text-[11px] transition-colors ${
                  isSelected
                    ? "bg-[var(--finance-blue)] font-semibold text-white"
                    : isToday
                      ? "border border-[var(--finance-blue)] bg-[#EEF3FF] font-semibold text-[#0F172A]"
                      : "text-[#0F172A] hover:bg-[var(--finance-hover)]"
                }`}
              >
                <span className="leading-none">{day.getUTCDate()}</span>
                {summary && summary.kinds.length > 0 ? (
                  <span className="mt-0.5 flex h-1 items-center gap-0.5">
                    {summary.kinds.map((kind, i) => (
                      <span
                        key={`${iso}-${kind}-${i}`}
                        className={`h-1 w-1 rounded-full ${
                          isSelected ? "bg-white/90" : DOT_COLOR[kind]
                        }`}
                      />
                    ))}
                    {summary.extra > 0 ? (
                      <span
                        className={`text-[7px] leading-none ${
                          isSelected ? "text-white/90" : "text-[#94A3B8]"
                        }`}
                      >
                        +{summary.extra}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="mt-0.5 h-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <p className="mt-1.5 text-[11px] text-[#EF4E62]">{error}</p>
      ) : null}

      <div className="mt-2 border-t border-[#EDF1F6] pt-2">
        <p className="text-[12px] font-semibold text-[#0F172A]">
          {formatHumanDate(selectedDate)}
        </p>
        {selectedEvents.length === 0 ? (
          <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-[#F8FAFC] px-2 py-2 text-[11px] text-[#94A3B8]">
            <IconCalendar size={14} />
            Нет событий на этот день
          </div>
        ) : (
          <ul className="mt-1.5 max-h-[110px] space-y-1 overflow-y-auto overscroll-contain">
            {selectedEvents.map((event) => (
              <SalesEventRow key={event.id} event={event} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SalesEventRow({ event }: { event: SalesCalendarEvent }) {
  const chip = KIND_CHIP[event.kind];
  const Icon = chip.icon;
  const paid = event.kind === "DEPOSIT" && event.status === "PAID";
  const pending = event.kind === "DEPOSIT" && event.status === "PENDING";

  return (
    <li>
      <Link
        href={event.href}
        className={`block rounded-lg border px-2 py-1.5 transition-colors hover:bg-[#F8FAFD] ${
          pending ? "border-dashed border-[#F5C451] bg-[#FFFCF5]" : "border-[#EDF1F6] bg-white"
        }`}
      >
        <div className="flex items-start gap-2">
          <span className="w-9 shrink-0 pt-px text-[12px] font-semibold tabular-nums text-[#0F172A]">
            {event.time ?? "—"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1">
              <span
                className={`inline-flex items-center gap-0.5 rounded px-1 py-px text-[10px] font-medium ${chip.className}`}
              >
                <Icon size={10} aria-hidden />
                {event.label}
              </span>
              {event.kind === "DEPOSIT" && event.amount != null ? (
                <span
                  className={`text-[11px] font-semibold tabular-nums ${
                    paid ? "text-[#119B81]" : "text-[#64748B]"
                  }`}
                >
                  {formatMoney(event.amount)}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[12px] font-medium leading-tight text-[#0F172A]">
              {event.propertyName}
            </p>
            {event.personName ? (
              <p className="truncate text-[11px] leading-tight text-[#64748B]">
                {event.personName}
              </p>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}
