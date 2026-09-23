"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AvitoPropertyChannel } from "@/components/properties/avito-property-channel";
import type { ChannelListingDTO } from "@/lib/channel-listings";
import { SALES_CHANNEL_CODES } from "@/lib/sales-channel-codes";
import type { SalesChannelDTO } from "@/lib/sales-channels";

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-900/10 focus:border-zinc-400 focus:ring-2";

type PropertyChannelsProps = {
  propertyId: string;
};

async function fetchPropertyChannels(propertyId: string) {
  const [channelsResponse, listingsResponse] = await Promise.all([
    fetch("/api/sales-channels"),
    fetch(`/api/properties/${propertyId}/channels`),
  ]);

  if (!channelsResponse.ok || !listingsResponse.ok) {
    throw new Error("Не удалось загрузить каналы продаж");
  }

  const channelsPayload = (await channelsResponse.json()) as {
    salesChannels: SalesChannelDTO[];
  };
  const listingsPayload = (await listingsResponse.json()) as {
    listings: ChannelListingDTO[];
  };

  return {
    channels: channelsPayload.salesChannels,
    listings: listingsPayload.listings,
  };
}

export function PropertyChannels({ propertyId }: PropertyChannelsProps) {
  const [channels, setChannels] = useState<SalesChannelDTO[]>([]);
  const [listings, setListings] = useState<ChannelListingDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bindChannelId, setBindChannelId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const data = await fetchPropertyChannels(propertyId);
        if (cancelled) {
          return;
        }
        setChannels(data.channels);
        setListings(data.listings);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Не удалось загрузить каналы продаж",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchData();

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  async function reload() {
    const data = await fetchPropertyChannels(propertyId);
    setChannels(data.channels);
    setListings(data.listings);
  }

  const listingsByChannelId = useMemo(() => {
    return new Map(listings.map((listing) => [listing.salesChannelId, listing]));
  }, [listings]);

  const orderedChannels = useMemo(() => {
    return [...channels].sort((left, right) => {
      return (
        SALES_CHANNEL_CODES.indexOf(
          left.code as (typeof SALES_CHANNEL_CODES)[number],
        ) -
        SALES_CHANNEL_CODES.indexOf(
          right.code as (typeof SALES_CHANNEL_CODES)[number],
        )
      );
    });
  }, [channels]);

  async function handleBind(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      salesChannelId: String(form.get("salesChannelId") ?? ""),
      externalId: String(form.get("externalId") ?? "").trim(),
      externalUrl: String(form.get("externalUrl") ?? "").trim(),
    };

    try {
      const response = await fetch(`/api/properties/${propertyId}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        error?: string;
        details?: string[];
      };

      if (!response.ok) {
        throw new Error(result.details?.join(". ") || result.error || "Не удалось привязать канал");
      }

      setBindChannelId(null);
      await reload();
    } catch (bindError) {
      setError(
        bindError instanceof Error ? bindError.message : "Не удалось привязать канал",
      );
    } finally {
      setPending(false);
    }
  }

  async function handleUnbind(listing: ChannelListingDTO) {
    const confirmed = window.confirm(
      `Отвязать объявление канала «${listing.salesChannel.name}»?`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setPending(true);

    try {
      const response = await fetch(
        `/api/properties/${propertyId}/channels/${listing.id}`,
        { method: "DELETE" },
      );
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error || "Не удалось отвязать канал");
      }

      await reload();
    } catch (unbindError) {
      setError(
        unbindError instanceof Error
          ? unbindError.message
          : "Не удалось отвязать канал",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
      <div>
        <h2 className="text-base font-semibold tracking-wide text-zinc-900">
          Каналы продаж
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Привязка существующих объявлений площадок к этому объекту. Для Авито
          доступна синхронизация через интеграционный слой. Остальные каналы
          привязываются вручную.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500">Загрузка каналов...</p>
      ) : (
        <div className="divide-y divide-zinc-100">
          {orderedChannels.map((channel) => {
            const listing = listingsByChannelId.get(channel.id);

            if (channel.code === "AVITO") {
              return (
                <div key={channel.id} className="py-4 first:pt-0 last:pb-0">
                  <AvitoPropertyChannel
                    propertyId={propertyId}
                    channel={channel}
                    listing={listing}
                    pending={pending}
                    onReload={reload}
                    setError={setError}
                    setPending={setPending}
                  />
                </div>
              );
            }

            return (
              <div key={channel.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-zinc-900">{channel.name}</h3>
                    {listing ? (
                      <div className="mt-1 text-sm text-zinc-600">
                        <p>
                          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />
                          Подключено
                        </p>
                        <p className="mt-1 text-zinc-500">
                          Объявление: {listing.externalId}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-zinc-500">
                        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-zinc-300" />
                        Не подключено
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {listing?.externalUrl ? (
                      <a
                        href={listing.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        Открыть объявление
                      </a>
                    ) : null}
                    {listing ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleUnbind(listing)}
                        className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Отвязать
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setBindChannelId(channel.id)}
                        className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        Привязать
                      </button>
                    )}
                  </div>
                </div>

                {bindChannelId === channel.id && !listing ? (
                  <form onSubmit={handleBind} className="mt-4 space-y-3 rounded-lg bg-zinc-50 p-4">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-zinc-700">
                        Канал
                      </span>
                      <select
                        name="salesChannelId"
                        required
                        defaultValue={channel.id}
                        className={inputClassName}
                      >
                        {orderedChannels.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-zinc-700">
                        ID объявления
                      </span>
                      <input
                        name="externalId"
                        required
                        placeholder="123456789"
                        className={inputClassName}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-zinc-700">
                        Ссылка
                      </span>
                      <input
                        name="externalUrl"
                        type="url"
                        placeholder="https://"
                        className={inputClassName}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setBindChannelId(null)}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-white"
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        disabled={pending}
                        className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                      >
                        {pending ? "Сохранение..." : "Привязать"}
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
