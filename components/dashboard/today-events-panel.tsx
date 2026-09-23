"use client";

import Link from "next/link";
import {
  IconCalendar,
  IconEye,
  IconHandshake,
  IconLogIn,
  IconLogOut,
} from "@/components/crm/icons";
import type { DashboardTodayEvents, TodayEventKind } from "@/lib/dashboard-sidebar";

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

const KIND_STYLE: Record<
  TodayEventKind,
  { bar: string; chip: string; icon: typeof IconLogIn }
> = {
  CHECK_IN: {
    bar: "border-l-[#119B81]",
    chip: "text-[#0F766E] bg-[#ECFAF5]",
    icon: IconLogIn,
  },
  CHECK_OUT: {
    bar: "border-l-[#3977F6]",
    chip: "text-[#1D4ED8] bg-[#EEF3FF]",
    icon: IconLogOut,
  },
  VIEWING: {
    bar: "border-l-[#9565E3]",
    chip: "text-[#6D28D9] bg-[#F5F0FF]",
    icon: IconEye,
  },
  SALE: {
    bar: "border-l-[#F7834A]",
    chip: "text-[#C2410C] bg-[#FFF4EC]",
    icon: IconHandshake,
  },
};

function formatHumanDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS_GEN[m - 1]} ${y}`;
}

type TodayEventsPanelProps = {
  data: DashboardTodayEvents;
};

export function TodayEventsPanel({ data }: TodayEventsPanelProps) {
  const counters = [
    { key: "checkIns", label: "Заезды", value: data.counts.checkIns },
    { key: "checkOuts", label: "Выезды", value: data.counts.checkOuts },
    { key: "viewings", label: "Показы", value: data.counts.viewings },
    { key: "purchases", label: "Сделки", value: data.counts.purchases },
  ] as const;

  return (
    <section className="finance-card flex flex-col p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold tracking-tight text-[#0F172A]">
          События сегодня
        </h2>
        <p className="shrink-0 text-[11px] text-[#94A3B8]">{formatHumanDate(data.date)}</p>
      </div>

      <div className="mt-2 grid grid-cols-4 overflow-hidden rounded-lg border border-[#E7ECF3]">
        {counters.map((item, index) => (
          <div
            key={item.key}
            className={`bg-white px-1.5 py-1.5 text-center ${
              index < 3 ? "border-r border-[#E7ECF3]" : ""
            }`}
          >
            <p className="text-[10px] font-medium text-[#94A3B8]">{item.label}</p>
            <p className="mt-0.5 text-[16px] font-semibold tabular-nums leading-none text-[#0F172A]">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-2 min-h-0">
        {data.events.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg bg-[#F8FAFC] px-2.5 py-2.5 text-[12px] text-[#94A3B8]">
            <IconCalendar size={14} />
            На сегодня событий нет
          </div>
        ) : (
          <ul className="max-h-[148px] space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">
            {data.events.map((event) => {
              const style = KIND_STYLE[event.kind];
              const Icon = style.icon;
              return (
                <li key={event.id}>
                  <Link
                    href={event.href}
                    className={`block rounded-lg border border-[#EDF1F6] border-l-[3px] ${style.bar} bg-white px-2 py-1.5 transition-colors hover:bg-[#F8FAFD]`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="w-9 shrink-0 pt-px text-[12px] font-semibold tabular-nums text-[#0F172A]">
                        {event.time ?? "—"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1 py-px text-[10px] font-medium ${style.chip}`}
                        >
                          <Icon size={10} aria-hidden />
                          {event.label}
                        </span>
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
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
