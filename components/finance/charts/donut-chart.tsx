"use client";

import { useId, useMemo, useState } from "react";
import { formatMoney } from "@/lib/property-labels";

export type DonutSlice = {
  id: string;
  label: string;
  amount: number;
  percent: number;
};

type DonutChartProps = {
  slices: DonutSlice[];
  centerValue: string;
  centerLabel: string;
  onSliceClick?: (slice: DonutSlice) => void;
  activeId?: string | null;
  emptyMessage?: string;
  title?: string;
  emptyPlaceholder?: boolean;
  bare?: boolean;
  className?: string;
  diameter?: number;
  strokeWidth?: number;
  colorForSlice?: (slice: DonutSlice, index: number) => string;
  /** Muted legend rows (e.g. sales gap) appended below real slices. */
  mutedLegend?: Array<{ label: string; detail: string }>;
  showPercentsInSectors?: boolean;
};

export const PROFIT_SEGMENT_COLORS: Record<string, string> = {
  SHORT_TERM: "#119B81",
  LONG_TERM: "#4F9BF7",
  SALES: "#9B63E6",
  GENERAL: "#64748b",
};

export const EXPENSE_SEGMENT_COLORS: Record<string, string> = {
  SHORT_TERM: "#EF5B86",
  LONG_TERM: "#F7834A",
  SALES: "#F6C54A",
  GENERAL: "#F15179",
  UNALLOCATED: "#94A3B8",
};

export const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  CLEANING: "#5A83F1",
  TAX: "#F17B48",
  UTILITIES: "#F3C343",
  ACQUIRING: "#9667DD",
  ADVERTISING: "#119A83",
  REPAIR: "#20B6A5",
  SUPPLIES: "#8BB6C8",
  OTHER_EXPENSE: "#B6C5D8",
  LAUNDRY: "#6EC6C0",
  PLATFORM_COMMISSION: "#7B8CDE",
};

const FALLBACK = ["#3b82f6", "#0d9488", "#f07167", "#64748b", "#8b5cf6", "#ca8a04"];

export function profitSliceColor(slice: DonutSlice, index: number) {
  return PROFIT_SEGMENT_COLORS[slice.id] ?? FALLBACK[index % FALLBACK.length]!;
}

export function expenseSliceColor(slice: DonutSlice, index: number) {
  return (
    EXPENSE_SEGMENT_COLORS[slice.id] ??
    EXPENSE_CATEGORY_COLORS[slice.id] ??
    FALLBACK[index % FALLBACK.length]!
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
) {
  const startOuter = polarToCartesian(cx, cy, outerR, endAngle);
  const endOuter = polarToCartesian(cx, cy, outerR, startAngle);
  const startInner = polarToCartesian(cx, cy, innerR, startAngle);
  const endInner = polarToCartesian(cx, cy, innerR, endAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 1 ${endInner.x} ${endInner.y}`,
    "Z",
  ].join(" ");
}

export function DonutChart({
  slices,
  centerLabel,
  centerValue,
  onSliceClick,
  activeId,
  emptyMessage = "Нет данных за период",
  title,
  emptyPlaceholder = false,
  bare = false,
  className,
  diameter = 200,
  strokeWidth = 38,
  colorForSlice = profitSliceColor,
  mutedLegend,
  showPercentsInSectors = true,
}: DonutChartProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const labelId = useId();

  const view = 240;
  const cx = 120;
  const cy = 120;
  const OUTER = 104;
  const INNER = Math.max(56, OUTER - strokeWidth);

  const arcs = useMemo(() => {
    if (slices.length === 0) return [];
    const total = slices.reduce((s, sl) => s + sl.amount, 0);
    if (total <= 0) return [];

    let cursor = 0;
    return slices.map((slice, index) => {
      const sweep = (slice.amount / total) * 360;
      const start = cursor;
      const mid = start + sweep / 2;
      cursor = start + sweep;
      const labelR = (OUTER + INNER) / 2;
      const labelPos = polarToCartesian(cx, cy, labelR, mid);
      return {
        slice,
        path: describeArc(cx, cy, OUTER, INNER, start, start + sweep - 0.3),
        color: colorForSlice(slice, index),
        mid,
        labelPos,
        showLabel: showPercentsInSectors && sweep >= 28,
      };
    });
  }, [slices, colorForSlice, showPercentsInSectors, INNER]);

  const highlightId = hoverId ?? focusId ?? activeId;
  const highlighted = arcs.find((a) => a.slice.id === highlightId);

  const shell = bare
    ? `flex h-full min-h-0 flex-col ${className ?? ""}`
    : `finance-card flex min-h-[300px] flex-col p-4 ${className ?? ""}`;

  return (
    <div className={shell}>
      {title ? (
        <h3 id={labelId} className="mb-3 text-[16px] font-bold text-[var(--finance-text)]">
          {title}
        </h3>
      ) : null}

      {arcs.length === 0 ? (
        emptyPlaceholder ? (
          <div className="grid flex-1 grid-cols-1 items-center gap-4 sm:grid-cols-[48%_52%]">
            <div className="relative mx-auto" style={{ width: Math.min(diameter, 220) }}>
              <svg viewBox={`0 0 ${view} ${view}`} className="h-auto w-full" aria-hidden>
                <circle
                  cx={cx}
                  cy={cy}
                  r={(OUTER + INNER) / 2}
                  fill="none"
                  stroke="#E7EBF1"
                  strokeWidth={OUTER - INNER}
                />
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[18px] font-bold tabular-nums text-[var(--finance-text)]">
                  {centerValue}
                </span>
                <span className="mt-0.5 text-[11px] text-[var(--finance-text-muted)]">
                  {centerLabel}
                </span>
              </div>
            </div>
            <p className="text-[13px] text-[var(--finance-text-muted)]">{emptyMessage}</p>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-[13px] text-[var(--finance-text-muted)]">
            {emptyMessage}
          </div>
        )
      ) : (
        <div className="grid flex-1 grid-cols-1 items-center gap-3 sm:grid-cols-[48%_52%]">
          <div className="relative mx-auto" style={{ width: Math.min(diameter, 220) }}>
            <svg
              viewBox={`0 0 ${view} ${view}`}
              className="h-auto w-full"
              role="img"
              aria-labelledby={title ? labelId : undefined}
              aria-label={title ?? centerLabel}
            >
              {arcs.map(({ slice, path, color }) => {
                const isHover = slice.id === highlightId;
                const dimmed = Boolean(highlightId) && !isHover;
                return (
                  <path
                    key={slice.id}
                    d={path}
                    fill={color}
                    stroke="#fff"
                    strokeWidth={2}
                    opacity={dimmed ? 0.4 : 1}
                    className={onSliceClick ? "cursor-pointer" : undefined}
                    tabIndex={onSliceClick ? 0 : undefined}
                    role={onSliceClick ? "button" : undefined}
                    aria-label={`${slice.label}: ${formatMoney(slice.amount)}, ${slice.percent}%`}
                    onMouseEnter={() => setHoverId(slice.id)}
                    onMouseLeave={() => setHoverId(null)}
                    onFocus={() => setFocusId(slice.id)}
                    onBlur={() => setFocusId(null)}
                    onClick={() => onSliceClick?.(slice)}
                    onKeyDown={(e) => {
                      if (!onSliceClick) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSliceClick(slice);
                      }
                    }}
                  />
                );
              })}
              {arcs.map(({ slice, labelPos, showLabel }) =>
                showLabel ? (
                  <text
                    key={`pct-${slice.id}`}
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-white text-[11px] font-semibold"
                    style={{ pointerEvents: "none" }}
                  >
                    {Math.round(slice.percent)}%
                  </text>
                ) : null,
              )}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
              <span className="text-[18px] font-bold leading-tight tabular-nums text-[var(--finance-text)] sm:text-[20px]">
                {highlighted ? formatMoney(highlighted.slice.amount) : centerValue}
              </span>
              <span className="mt-0.5 text-[11px] text-[var(--finance-text-muted)]">
                {highlighted ? highlighted.slice.label : centerLabel}
              </span>
            </div>
          </div>

          <ul className="min-w-0 space-y-3.5" aria-label="Легенда">
            {slices.map((slice, index) => (
              <li key={slice.id}>
                <button
                  type="button"
                  onClick={() => onSliceClick?.(slice)}
                  disabled={!onSliceClick}
                  onMouseEnter={() => setHoverId(slice.id)}
                  onMouseLeave={() => setHoverId(null)}
                  className={`flex w-full items-start gap-2.5 rounded-lg px-1.5 py-1 text-left transition-colors ${
                    onSliceClick ? "cursor-pointer hover:bg-[var(--finance-hover)]" : "cursor-default"
                  } ${slice.id === highlightId ? "bg-[var(--finance-hover)]" : ""}`}
                >
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: colorForSlice(slice, index) }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] text-[var(--finance-text-secondary)]">
                      {slice.label}
                    </span>
                    <span className="mt-0.5 flex items-baseline justify-between gap-2">
                      <span className="text-[16px] font-bold tabular-nums text-[var(--finance-text)]">
                        {formatMoney(slice.amount)}
                      </span>
                      <span className="text-[13px] tabular-nums text-[var(--finance-text-muted)]">
                        {slice.percent}%
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {mutedLegend?.map((row) => (
              <li key={row.label} className="flex items-start gap-2.5 px-1.5 py-1 opacity-70">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#D5DCE8]" aria-hidden />
                <span>
                  <span className="block text-[12.5px] text-[var(--finance-text-secondary)]">
                    {row.label}
                  </span>
                  <span className="text-[11px] text-[var(--finance-text-muted)]">{row.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
