"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import type { PropertyDTO } from "@/lib/properties";
import { parseCreateSaleListing } from "@/lib/validations/sale-listing";

export function AddSaleForm({
  properties,
  takenPropertyIds,
  defaultPropertyId,
}: {
  properties: PropertyDTO[];
  takenPropertyIds: string[];
  defaultPropertyId?: string;
}) {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState(() => {
    if (defaultPropertyId && !takenPropertyIds.includes(defaultPropertyId)) {
      return defaultPropertyId;
    }
    return "";
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const available = useMemo(
    () => properties.filter((property) => !takenPropertyIds.includes(property.id)),
    [properties, takenPropertyIds],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const parsed = parseCreateSaleListing({ propertyId });
      if (!parsed.success) {
        throw new Error("Укажите объект");
      }
      const response = await fetch("/api/sale-listings", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(parsed.data),
      });
      const payload = (await response.json()) as {
        error?: string;
        created?: boolean;
        listing?: { id: string };
      };
      if (response.status === 409) {
        throw new Error(payload.error || "Этот объект уже добавлен в продажи");
      }
      if (!response.ok || !payload.listing) {
        throw new Error(payload.error || "Не удалось добавить объект в продажи");
      }
      if (payload.created === false) {
        setNotice("Карточка продажи для этого объекта уже существует. Открываем её…");
      }
      router.push(`/crm/sales/properties/${payload.listing.id}/edit`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Не удалось добавить объект в продажи",
      );
    } finally {
      setPending(false);
    }
  }

  if (available.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600">
        Нет свободных объектов для добавления в продажи. Все Property уже имеют карточку SaleListing.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {notice ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">{notice}</p>
      ) : null}
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-zinc-700">Объект</span>
        <select
          required
          value={propertyId}
          onChange={(event) => setPropertyId(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2"
        >
          <option value="">Выберите объект</option>
          {available.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name} — {property.address}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Добавление..." : "Создать карточку продажи"}
      </button>
    </form>
  );
}
