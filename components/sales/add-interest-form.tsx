"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { SaleListingDTO } from "@/lib/sale-listings";
import { formatMoney } from "@/lib/property-labels";

export function AddInterestForm({
  buyerId,
  listings,
}: {
  buyerId: string;
  listings: SaleListingDTO[];
}) {
  const router = useRouter();
  const [saleListingId, setSaleListingId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/buyer-interests", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ buyerId, saleListingId }),
      });
      const payload = (await response.json()) as {
        error?: string;
        details?: string[];
        interest?: { id: string };
        created?: boolean;
      };
      if (!response.ok || !payload.interest) {
        throw new Error(payload.details?.join(". ") || payload.error || "Не удалось добавить");
      }
      setOpen(false);
      setSaleListingId("");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось добавить");
    } finally {
      setPending(false);
    }
  }

  if (listings.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Нет доступных карточек продажи для добавления (все уже связаны, проданы или в архиве).
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
      >
        Добавить объект
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-zinc-200 p-4">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-zinc-700">Объект продажи</span>
        <select
          required
          value={saleListingId}
          onChange={(event) => setSaleListingId(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2"
        >
          <option value="">Выберите карточку</option>
          {listings.map((listing) => (
            <option key={listing.id} value={listing.id}>
              {listing.marketingTitle || listing.property.name} — {formatMoney(listing.price)}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Добавление..." : "Добавить интерес"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
