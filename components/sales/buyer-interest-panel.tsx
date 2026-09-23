"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { buyerInterestStatusLabels } from "@/lib/buyer-interest-labels";
import type { BuyerInterestDTO } from "@/lib/buyer-interests";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/property-labels";

export function BuyerInterestPanel({
  interests,
}: {
  interests: BuyerInterestDTO[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const interest of interests) {
      initial[interest.id] = interest.notes ?? "";
    }
    return initial;
  });

  const sorted = useMemo(
    () => [...interests].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [interests],
  );

  async function patchInterest(
    id: string,
    body: { notes?: string | null; status?: string },
    options?: { confirmRefuse?: boolean },
  ) {
    if (options?.confirmRefuse) {
      const confirmed = window.confirm("Отметить отказ по этому интересу? Связь сохранится.");
      if (!confirmed) {
        return;
      }
    }
    setError(null);
    setPendingId(id);
    try {
      const response = await fetch(`/api/buyer-interests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string; details?: string[] };
      if (!response.ok) {
        throw new Error(payload.details?.join(". ") || payload.error || "Не удалось обновить");
      }
      router.refresh();
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Не удалось обновить");
    } finally {
      setPendingId(null);
    }
  }

  async function completePurchase(id: string) {
    const confirmed = window.confirm(
      "Подтвердить завершение покупки? Объект будет отмечен как проданный, остальные активные покупатели получат статус «Отказ».",
    );
    if (!confirmed) {
      return;
    }
    setError(null);
    setPendingId(id);
    try {
      const response = await fetch(`/api/buyer-interests/${id}/purchase`, {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Не удалось завершить покупку");
      }
      router.refresh();
    } catch (purchaseError) {
      setError(purchaseError instanceof Error ? purchaseError.message : "Не удалось завершить покупку");
    } finally {
      setPendingId(null);
    }
  }

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-zinc-500">Пока нет интересующих объектов продажи.</p>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {sorted.map((interest) => {
        const title =
          interest.saleListing.marketingTitle || interest.saleListing.property.name;
        return (
          <article
            key={interest.id}
            className="space-y-3 rounded-lg border border-zinc-200 p-4"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <a
                  href={`/crm/sales/properties/${interest.saleListingId}`}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {title}
                </a>
                <p className="text-sm text-zinc-600">{interest.saleListing.property.address}</p>
                <p className="text-sm text-zinc-600">
                  Цена продажи: {formatMoney(interest.saleListing.price)}
                </p>
              </div>
              <span className="text-sm font-medium">
                {buyerInterestStatusLabels[interest.status]}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Создан {formatDateTime(interest.createdAt)} · обновлён{" "}
              {formatDateTime(interest.updatedAt)}
            </p>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-600">Заметка</span>
              <textarea
                rows={2}
                value={noteDrafts[interest.id] ?? ""}
                onChange={(event) =>
                  setNoteDrafts((current) => ({
                    ...current,
                    [interest.id]: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pendingId === interest.id}
                onClick={() =>
                  void patchInterest(interest.id, {
                    notes: noteDrafts[interest.id]?.trim() || null,
                  })
                }
                className="rounded-md border border-zinc-200 px-2 py-1 text-xs disabled:opacity-50"
              >
                Сохранить заметку
              </button>
              {interest.status === "DEPOSIT_PAID" ? (
                <button
                  type="button"
                  disabled={pendingId === interest.id}
                  onClick={() => void completePurchase(interest.id)}
                  className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  Завершить покупку
                </button>
              ) : null}
              {interest.manualTargets.map((target) => (
                <button
                  key={target}
                  type="button"
                  disabled={pendingId === interest.id}
                  onClick={() =>
                    void patchInterest(
                      interest.id,
                      { status: target },
                      { confirmRefuse: target === "REFUSED" },
                    )
                  }
                  className="rounded-md border border-zinc-200 px-2 py-1 text-xs disabled:opacity-50"
                >
                  {buyerInterestStatusLabels[target]}
                </button>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
