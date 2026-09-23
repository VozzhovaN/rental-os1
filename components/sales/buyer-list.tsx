"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buyerInterestStatusLabels } from "@/lib/buyer-interest-labels";
import type { BuyerListItemDTO } from "@/lib/buyers";
import { messengerTypeLabels } from "@/lib/guest-labels";

export function BuyerList({ buyers }: { buyers: BuyerListItemDTO[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) {
      return buyers;
    }
    return buyers.filter((buyer) => {
      return (
        buyer.name.toLowerCase().includes(needle) ||
        (buyer.phone ?? "").toLowerCase().includes(needle) ||
        (buyer.email ?? "").toLowerCase().includes(needle)
      );
    });
  }, [buyers, q]);

  return (
    <div className="space-y-4">
      <input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Поиск: имя, телефон, email"
        className="w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2 text-sm"
      />
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-zinc-600">
          {buyers.length === 0
            ? "Клиентов продаж пока нет. Добавьте первого покупателя."
            : "По запросу ничего не найдено."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Клиент</th>
                <th className="px-3 py-2 font-medium">Телефон</th>
                <th className="px-3 py-2 font-medium">Мессенджер</th>
                <th className="px-3 py-2 font-medium">Интересы</th>
                <th className="px-3 py-2 font-medium">Активность</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((buyer) => (
                <tr key={buyer.id} className="border-t border-zinc-100">
                  <td className="px-3 py-3 font-medium">{buyer.name}</td>
                  <td className="px-3 py-3 text-zinc-600">{buyer.phone || "—"}</td>
                  <td className="px-3 py-3 text-zinc-600">
                    {buyer.messengerType
                      ? `${messengerTypeLabels[buyer.messengerType]}${
                          buyer.messengerContact ? ` · ${buyer.messengerContact}` : ""
                        }`
                      : "—"}
                  </td>
                  <td className="px-3 py-3">{buyer.interestsCount}</td>
                  <td className="px-3 py-3 text-zinc-600">
                    {buyer.statusSummary
                      ? buyerInterestStatusLabels[buyer.statusSummary]
                      : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/crm/sales/clients/${buyer.id}`}
                      className="rounded-md border border-zinc-200 px-2 py-1 text-xs"
                    >
                      Открыть
                    </Link>
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
