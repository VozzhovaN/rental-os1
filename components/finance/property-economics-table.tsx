"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/property-labels";

export type PropertyEconomicsRow = {
  propertyId: string;
  name: string;
  managementType: string;
  rentCollectionMode: string;
  grossRent: number;
  businessRevenue: number;
  totalExpenses: number;
  netProfit: number;
  commissionRateHint: number | null;
};

type SortKey = keyof Pick<
  PropertyEconomicsRow,
  "name" | "grossRent" | "businessRevenue" | "totalExpenses" | "netProfit"
>;

type Props = {
  rows: PropertyEconomicsRow[];
  dateFrom: string;
  dateTo: string;
  title?: string;
  segmentFilter?: string;
  photoByPropertyId?: Record<string, string>;
  detailsHref?: string;
};

function directionLabel(segmentFilter?: string) {
  if (segmentFilter === "SHORT_TERM") return "Посуточная";
  if (segmentFilter === "LONG_TERM") return "Долгосрочная";
  if (segmentFilter === "SALES") return "Продажи";
  return "—";
}

function modelBadge(row: PropertyEconomicsRow) {
  if (row.managementType === "OWN") {
    return (
      <span className="inline-flex rounded-[5px] bg-[#E9FAF4] px-1.5 py-0.5 text-[11px] font-semibold text-[#079B73]">
        OWN
      </span>
    );
  }
  if (row.managementType === "COMMISSION") {
    const rate =
      row.commissionRateHint != null ? `COMM ${Math.round(row.commissionRateHint)}%` : "Комиссия";
    return (
      <span className="inline-flex rounded-[5px] bg-[#FFF4E8] px-1.5 py-0.5 text-[11px] font-semibold text-[#D97706]">
        {rate}
      </span>
    );
  }
  return <span className="text-[var(--finance-text-muted)]">{row.managementType}</span>;
}

function profitTone(v: number) {
  if (v > 0) return "font-semibold text-[#079B73]";
  if (v < 0) return "font-semibold text-[#E5484D]";
  return "text-[var(--finance-text-muted)]";
}

export function PropertyEconomicsTable({
  rows,
  dateFrom,
  dateTo,
  title = "Экономика по объектам",
  segmentFilter,
  photoByPropertyId,
  detailsHref,
}: Props) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("netProfit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const detailQuery = `?dateFrom=${encodeURIComponent(dateFrom)}&dateTo=${encodeURIComponent(dateTo)}`;
  const direction = directionLabel(segmentFilter);

  return (
    <section className="finance-card flex h-full min-h-[300px] flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-[#EDF1F6] px-4 py-3">
        <h3 className="text-[16px] font-bold text-[var(--finance-text)]">{title}</h3>
        {detailsHref ? (
          <a
            href={detailsHref}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--finance-blue)] hover:underline"
          >
            Смотреть все →
          </a>
        ) : null}
      </div>
      <div className="flex-1 overflow-x-auto">
        <table className="min-w-full text-left text-[12.5px]">
          <thead className="text-[11px] text-[var(--finance-text-muted)]">
            <tr className="border-b border-[#EDF1F6]">
              <th className="px-3 py-2.5 font-medium">
                <button type="button" onClick={() => toggleSort("name")} className="hover:text-[var(--finance-text)]">
                  Объект
                </button>
              </th>
              <th className="px-3 py-2.5 font-medium">Направление</th>
              <th className="px-3 py-2.5 font-medium">Модель</th>
              <th className="px-3 py-2.5 font-medium">
                <button type="button" onClick={() => toggleSort("grossRent")}>Оборот</button>
              </th>
              <th className="px-3 py-2.5 font-medium">
                <button type="button" onClick={() => toggleSort("businessRevenue")}>Выручка</button>
              </th>
              <th className="px-3 py-2.5 font-medium">
                <button type="button" onClick={() => toggleSort("totalExpenses")}>Расходы</button>
              </th>
              <th className="px-3 py-2.5 font-medium">
                <button type="button" onClick={() => toggleSort("netProfit")}>Прибыль</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-[var(--finance-text-muted)]">
                  Нет данных за период
                </td>
              </tr>
            ) : (
              sorted.map((row) => {
                const photo = photoByPropertyId?.[row.propertyId];
                return (
                  <tr
                    key={row.propertyId}
                    className="h-11 cursor-pointer border-b border-[#EDF1F6] hover:bg-[#F8FAFD]"
                    tabIndex={0}
                    role="link"
                    onClick={() =>
                      router.push(`/crm/finance/properties/${row.propertyId}${detailQuery}`)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/crm/finance/properties/${row.propertyId}${detailQuery}`);
                      }
                    }}
                  >
                    <td className="max-w-[180px] px-3 py-2">
                      <span className="flex items-center gap-2">
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photo}
                            alt=""
                            className="h-7 w-7 shrink-0 rounded-[5px] object-cover"
                          />
                        ) : (
                          <span className="inline-block h-7 w-7 shrink-0 rounded-[5px] bg-[#E8EEF6]" />
                        )}
                        <span className="truncate font-medium text-[var(--finance-text)]">
                          {row.name}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[var(--finance-text-secondary)]">{direction}</td>
                    <td className="px-3 py-2">{modelBadge(row)}</td>
                    <td className="px-3 py-2 tabular-nums text-[var(--finance-text)]">
                      {formatMoney(row.grossRent)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-[var(--finance-text)]">
                      {formatMoney(row.businessRevenue)}
                    </td>
                    <td
                      className={`px-3 py-2 tabular-nums ${
                        row.totalExpenses === 0
                          ? "text-[var(--finance-text-muted)]"
                          : "text-[var(--finance-text)]"
                      }`}
                    >
                      {formatMoney(row.totalExpenses)}
                    </td>
                    <td className={`px-3 py-2 tabular-nums ${profitTone(row.netProfit)}`}>
                      {formatMoney(row.netProfit)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
