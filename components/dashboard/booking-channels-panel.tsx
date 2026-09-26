"use client";

import { IconChart } from "@/components/crm/icons";
import type { DashboardChannelStats } from "@/lib/dashboard";
import { formatMonthTitle } from "@/lib/format";
import { formatMoney } from "@/lib/property-labels";

const ACCENT_COLORS = [
  "#3977F6",
  "#119B81",
  "#9565E3",
  "#F7834A",
  "#4F9BF7",
];

function formatBookingCount(count: number) {
  const abs = Math.abs(count);
  const mod10 = abs % 10;
  const mod100 = abs % 100;

  if (mod100 >= 11 && mod100 <= 14) {
    return `${count} броней`;
  }
  if (mod10 === 1) {
    return `${count} бронь`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${count} брони`;
  }
  return `${count} броней`;
}

type BookingChannelsPanelProps = {
  data: DashboardChannelStats;
};

export function BookingChannelsPanel({ data }: BookingChannelsPanelProps) {
  return (
    <section className="finance-card flex flex-col p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold tracking-tight text-[#0F172A]">
          Каналы продаж
        </h2>
        <p className="shrink-0 text-[10px] capitalize text-[#94A3B8]">
          {formatMonthTitle(data.year, data.month)}
        </p>
      </div>

      {data.totalBookings === 0 ? (
        <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-[#F8FAFC] px-2 py-2 text-[11px] text-[#94A3B8]">
          <IconChart size={13} />
          Нет бронирований за период
        </div>
      ) : (
        <>
          <div className="mt-1.5 grid grid-cols-2 gap-2 rounded-lg border border-[#E7ECF3] px-2 py-1.5">
            <div>
              <p className="text-[9px] font-medium uppercase tracking-wide text-[#94A3B8]">
                Бронирования
              </p>
              <p className="mt-0.5 text-[16px] font-semibold tabular-nums leading-none text-[#0F172A]">
                {data.totalBookings}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-medium uppercase tracking-wide text-[#94A3B8]">
                Оборот
              </p>
              <p className="mt-0.5 text-[16px] font-semibold tabular-nums leading-none text-[#0F172A]">
                {formatMoney(data.totalTurnover)}
              </p>
            </div>
          </div>

          <ul className="mt-1.5 max-h-[128px] space-y-1 overflow-y-auto overscroll-contain">
            {data.channels.map((channel, index) => {
              const color = ACCENT_COLORS[index % ACCENT_COLORS.length]!;
              const title = [
                channel.channelName,
                formatBookingCount(channel.bookingCount),
                `${formatMoney(channel.turnover)} оборот`,
                `${channel.bookingShare}% всех бронирований`,
              ].join(" · ");

              return (
                <li key={channel.channelId} title={title}>
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                      <p className="truncate text-[11px] font-medium text-[#0F172A]">
                        {channel.channelName}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-baseline gap-1.5 text-[10px] tabular-nums">
                      <span className="font-semibold text-[#0F172A]">
                        {channel.bookingCount}
                      </span>
                      <span className="text-[#94A3B8]">{channel.bookingShare}%</span>
                    </div>
                  </div>
                  <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-[#EEF2F7]">
                    <div
                      className="h-full rounded-full transition-[width]"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(channel.bookingShare, channel.bookingCount > 0 ? 2 : 0),
                        )}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
