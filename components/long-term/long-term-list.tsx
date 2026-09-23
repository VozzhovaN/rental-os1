"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { longTermStatusLabels } from "@/lib/long-term-labels";
import type { LongTermListingDTO } from "@/lib/long-term-listings";
import { formatMoney } from "@/lib/property-labels";
import { parseUpdateLongTermListing } from "@/lib/validations/long-term-listing";

const statusStyles = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  ACTIVE: "bg-emerald-50 text-emerald-800",
  PAUSED: "bg-amber-50 text-amber-800",
  ARCHIVED: "bg-zinc-100 text-zinc-500",
} as const;

export function LongTermList({ listings }: { listings: LongTermListingDTO[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return listings.filter((listing) => {
      if (status && listing.status !== status) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return (
        listing.property.name.toLowerCase().includes(needle) ||
        listing.marketingTitle.toLowerCase().includes(needle) ||
        listing.property.city.toLowerCase().includes(needle)
      );
    });
  }, [listings, q, status]);

  async function patchStatus(id: string, nextStatus: "ACTIVE" | "PAUSED" | "ARCHIVED") {
    setError(null);
    setPendingId(id);
    try {
      const parsed = parseUpdateLongTermListing({ status: nextStatus });
      if (!parsed.success) {
        throw new Error("Некорректные данные");
      }
      const response = await fetch(`/api/long-term-listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(parsed.data),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Не удалось изменить статус");
      }
      router.refresh();
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Не удалось изменить статус");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Поиск"
          className="w-full max-w-xs rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">Все статусы</option>
          <option value="DRAFT">Черновик</option>
          <option value="ACTIVE">Активно</option>
          <option value="PAUSED">На паузе</option>
          <option value="ARCHIVED">Архив</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-zinc-600">
          Объектов долгосрочной аренды пока нет.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Объект</th>
                <th className="px-3 py-2 font-medium">Цена</th>
                <th className="px-3 py-2 font-medium">Статус</th>
                <th className="px-3 py-2 font-medium">Дата изменения</th>
                <th className="px-3 py-2 font-medium">Реклама</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((listing) => (
                <tr key={listing.id} className="border-t border-zinc-100">
                  <td className="px-3 py-3">
                    <p className="font-medium text-zinc-900">{listing.property.name}</p>
                    <p className="text-xs text-zinc-500">{listing.marketingTitle || "Без заголовка"}</p>
                  </td>
                  <td className="px-3 py-3">{formatMoney(listing.monthlyPrice)}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[listing.status]}`}
                    >
                      {longTermStatusLabels[listing.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-zinc-500">{formatDateTime(listing.updatedAt)}</td>
                  <td className="px-3 py-3 text-zinc-500">Не опубликовано</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/crm/long-term/${listing.id}`}
                        className="rounded-md border border-zinc-200 px-2 py-1 text-xs"
                      >
                        Открыть
                      </Link>
                      <Link
                        href={`/crm/long-term/${listing.id}/edit`}
                        className="rounded-md border border-zinc-200 px-2 py-1 text-xs"
                      >
                        Редактировать
                      </Link>
                      {listing.status !== "PAUSED" && listing.status !== "ARCHIVED" ? (
                        <button
                          type="button"
                          disabled={pendingId === listing.id}
                          onClick={() => void patchStatus(listing.id, "PAUSED")}
                          className="rounded-md border border-zinc-200 px-2 py-1 text-xs disabled:opacity-50"
                        >
                          На паузу
                        </button>
                      ) : null}
                      {listing.status !== "ACTIVE" && listing.status !== "ARCHIVED" ? (
                        <button
                          type="button"
                          disabled={pendingId === listing.id}
                          onClick={() => void patchStatus(listing.id, "ACTIVE")}
                          className="rounded-md border border-zinc-200 px-2 py-1 text-xs disabled:opacity-50"
                        >
                          Активировать
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
