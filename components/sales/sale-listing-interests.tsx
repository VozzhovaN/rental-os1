"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { buyerInterestStatusLabels } from "@/lib/buyer-interest-labels";
import type { BuyerInterestDTO } from "@/lib/buyer-interests";
import type { BuyerDTO } from "@/lib/buyers";

export function SaleListingInterests({
  saleListingId,
  interests,
  availableBuyers,
}: {
  saleListingId: string;
  interests: BuyerInterestDTO[];
  availableBuyers: BuyerDTO[];
}) {
  const router = useRouter();
  const [buyerId, setBuyerId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  async function linkBuyer(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/buyer-interests", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ buyerId, saleListingId }),
      });
      const payload = (await response.json()) as { error?: string; details?: string[] };
      if (!response.ok) {
        throw new Error(payload.details?.join(". ") || payload.error || "Не удалось связать");
      }
      setBuyerId("");
      router.refresh();
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "Не удалось связать");
    } finally {
      setPending(false);
    }
  }

  async function createAndLink(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const createResponse = await fetch("/api/buyers", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ name: newName, phone: newPhone }),
      });
      const createPayload = (await createResponse.json()) as {
        error?: string;
        details?: string[];
        buyer?: { id: string };
      };
      if (!createResponse.ok || !createPayload.buyer) {
        throw new Error(
          createPayload.details?.join(". ") || createPayload.error || "Не удалось создать клиента",
        );
      }
      const linkResponse = await fetch("/api/buyer-interests", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ buyerId: createPayload.buyer.id, saleListingId }),
      });
      const linkPayload = (await linkResponse.json()) as { error?: string; details?: string[] };
      if (!linkResponse.ok) {
        throw new Error(linkPayload.details?.join(". ") || linkPayload.error || "Не удалось связать");
      }
      setShowCreate(false);
      setNewName("");
      setNewPhone("");
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Не удалось создать");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      {interests.length === 0 ? (
        <p className="text-sm text-zinc-500">Пока нет заинтересованных клиентов.</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {interests.map((interest) => (
            <li key={interest.id} className="rounded-lg border border-zinc-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/crm/sales/clients/${interest.buyerId}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {interest.buyer.name}
                  </Link>
                  <p className="text-zinc-600">{interest.buyer.phone || "Без телефона"}</p>
                  {interest.notes ? <p className="mt-1 text-zinc-600">{interest.notes}</p> : null}
                </div>
                <span>{buyerInterestStatusLabels[interest.status]}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {availableBuyers.length > 0 ? (
        <form onSubmit={linkBuyer} className="flex flex-wrap items-end gap-2">
          <label className="min-w-56 flex-1 text-sm">
            <span className="mb-1 block text-zinc-600">Связать существующего клиента</span>
            <select
              required
              value={buyerId}
              onChange={(event) => setBuyerId(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2"
            >
              <option value="">Выберите клиента</option>
              {availableBuyers.map((buyer) => (
                <option key={buyer.id} value={buyer.id}>
                  {buyer.name}
                  {buyer.phone ? ` · ${buyer.phone}` : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Добавить
          </button>
        </form>
      ) : null}

      {!showCreate ? (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="text-sm underline"
        >
          Создать нового клиента
        </button>
      ) : (
        <form onSubmit={createAndLink} className="space-y-2 rounded-lg border border-zinc-200 p-3">
          <p className="text-sm font-medium">Новый клиент</p>
          <input
            required
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Имя"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            value={newPhone}
            onChange={(event) => setNewPhone(event.target.value)}
            placeholder="Телефон"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Создать и связать
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              Отмена
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
