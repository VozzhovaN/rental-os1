"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/property-labels";

export type TimelinePoint = {
  bucket: string;
  label: string;
  grossRent: number;
  businessRevenue: number;
  expenses: number;
  netProfit: number;
};

type LineChartProps = {
  points: TimelinePoint[];
  title?: string;
  granularityLabel?: string;
};

const SERIES = [
  { key: "grossRent" as const, label: "Оборот", color: "#B7C8E5" },
  { key: "businessRevenue" as const, label: "Выручка", color: "#159E82" },
  { key: "expenses" as const, label: "Расходы", color: "#F47A49" },
  { key: "netProfit" as const, label: "Прибыль", color: "#7657DF" },
];

const WIDTH = 720;
const HEIGHT = 260;
const PAD = { top: 12, right: 16, bottom: 32, left: 48 };

function buildPath(
  values: number[],
  minY: number,
  maxY: number,
) {
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const range = maxY - minY || 1;

  return values
    .map((value, index) => {
      const x = PAD.left + (index / Math.max(values.length - 1, 1)) * innerW;
      const y = PAD.top + innerH - ((value - minY) / range) * innerH;
      return { x, y, cmd: `${index === 0 ? "M" : "L"} ${x} ${y}` };
    });
}

function pickTickIndices(count: number): number[] {
  if (count <= 1) return [0];
  if (count <= 8) return Array.from({ length: count }, (_, i) => i);
  const maxTicks = count <= 16 ? 6 : count <= 40 ? 7 : 8;
  const step = Math.max(1, Math.ceil((count - 1) / (maxTicks - 1)));
  const indices: number[] = [];
  for (let i = 0; i < count; i += step) indices.push(i);
  if (indices[indices.length - 1] !== count - 1) indices.push(count - 1);
  return indices;
}

function shortenLabel(label: string): string {
  if (label.length <= 8) return label;
  const m = label.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    return `${Number(m[3])} ${months[Number(m[2]) - 1]}`;
  }
  return label.length > 10 ? `${label.slice(0, 8)}…` : label;
}

function formatAxis(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
  if (Math.abs(n) >= 1000) return `${Math.round(n / 1000)}k`;
  return String(Math.round(n));
}

export function LineChart({
  points,
  title = "Динамика финансов",
  granularityLabel,
}: LineChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const chart = useMemo(() => {
    if (points.length === 0) return null;
    const allValues = points.flatMap((p) => [
      p.grossRent,
      p.businessRevenue,
      p.expenses,
      p.netProfit,
    ]);
    const min = Math.min(0, ...allValues);
    const rawMax = Math.max(...allValues, 0);
    const max = rawMax === 0 ? 1 : rawMax * 1.08;
    const series = SERIES.map((s) => {
      const pts = buildPath(
        points.map((p) => p[s.key]),
        min,
        max,
      );
      return { ...s, path: pts.map((p) => p.cmd).join(" "), pts };
    });
    return {
      series,
      minY: min,
      maxY: max,
      tickIndices: pickTickIndices(points.length),
      yTicks: [0, 0.25, 0.5, 0.75, 1].map((t) => min + (max - min) * t),
      innerW: WIDTH - PAD.left - PAD.right,
      innerH: HEIGHT - PAD.top - PAD.bottom,
    };
  }, [points]);

  if (!chart) {
    return (
      <div className="finance-card p-4">
        <h3 className="text-[16px] font-bold text-[var(--finance-text)]">{title}</h3>
        <p className="py-12 text-center text-[13px] text-[var(--finance-text-muted)]">
          Нет данных за период
        </p>
      </div>
    );
  }

  const hoverPoint = hoverIndex != null ? points[hoverIndex] : null;

  return (
    <div className="finance-card p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[16px] font-bold text-[var(--finance-text)]">{title}</h3>
        <div className="flex flex-wrap items-center gap-3">
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--finance-text-secondary)]">
            {SERIES.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </li>
            ))}
          </ul>
          {granularityLabel ? (
            <span className="inline-flex h-8 items-center rounded-lg border border-[#DFE6F0] bg-white px-2.5 text-[12px] text-[var(--finance-text-secondary)]">
              {granularityLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-[220px] w-full sm:h-[230px]"
          role="img"
          aria-label={title}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {chart.yTicks.map((yVal) => {
            const y =
              PAD.top +
              chart.innerH -
              ((yVal - chart.minY) / (chart.maxY - chart.minY || 1)) * chart.innerH;
            return (
              <g key={yVal}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={WIDTH - PAD.right}
                  y2={y}
                  stroke="#E9EEF5"
                  strokeWidth="1"
                />
                <text
                  x={PAD.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-[#71809B] text-[10px]"
                >
                  {formatAxis(yVal)}
                </text>
              </g>
            );
          })}

          {chart.series.map((s) => (
            <g key={s.key}>
              <path
                d={s.path}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {s.pts.map((pt, i) => (
                <circle key={`${s.key}-${i}`} cx={pt.x} cy={pt.y} r="3" fill={s.color} />
              ))}
            </g>
          ))}

          {chart.tickIndices.map((index) => {
            const point = points[index]!;
            const x = PAD.left + (index / Math.max(points.length - 1, 1)) * chart.innerW;
            return (
              <text
                key={point.bucket}
                x={x}
                y={HEIGHT - 10}
                textAnchor="middle"
                className="fill-[#71809B] text-[11px]"
              >
                {shortenLabel(point.label)}
              </text>
            );
          })}

          {points.map((point, index) => {
            const x = PAD.left + (index / Math.max(points.length - 1, 1)) * chart.innerW;
            const hitW = chart.innerW / Math.max(points.length, 1);
            return (
              <rect
                key={`hit-${point.bucket}`}
                x={x - hitW / 2}
                y={PAD.top}
                width={Math.max(hitW, 8)}
                height={chart.innerH}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(index)}
              />
            );
          })}

          {hoverIndex != null ? (
            <line
              x1={PAD.left + (hoverIndex / Math.max(points.length - 1, 1)) * chart.innerW}
              y1={PAD.top}
              x2={PAD.left + (hoverIndex / Math.max(points.length - 1, 1)) * chart.innerW}
              y2={PAD.top + chart.innerH}
              stroke="#A8B4C8"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          ) : null}
        </svg>

        {hoverPoint ? (
          <div className="pointer-events-none absolute top-2 left-1/2 z-10 w-max max-w-[240px] -translate-x-1/2 rounded-lg border border-[var(--finance-border)] bg-white px-3 py-2 text-[11px] shadow-md">
            <p className="mb-1 font-semibold text-[var(--finance-text)]">{hoverPoint.label}</p>
            <dl className="space-y-0.5 tabular-nums text-[var(--finance-text-secondary)]">
              <div className="flex justify-between gap-4">
                <dt>Оборот</dt>
                <dd>{formatMoney(hoverPoint.grossRent)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Выручка</dt>
                <dd>{formatMoney(hoverPoint.businessRevenue)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Расходы</dt>
                <dd>{formatMoney(hoverPoint.expenses)}</dd>
              </div>
              <div className="flex justify-between gap-4 font-semibold text-[var(--finance-text)]">
                <dt>Прибыль</dt>
                <dd>{formatMoney(hoverPoint.netProfit)}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  );
}
