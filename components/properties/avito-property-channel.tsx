"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ChannelListingDTO } from "@/lib/channel-listings";
import { formatDateTime } from "@/lib/format";
import type { ExternalListing } from "@/lib/integrations/types";
import type { SalesChannelDTO } from "@/lib/sales-channels";

type AvitoPropertyChannelProps = {
  propertyId: string;
  channel: SalesChannelDTO;
  listing: ChannelListingDTO | undefined;
  pending: boolean;
  onReload: () => Promise<void>;
  setError: (value: string | null) => void;
  setPending: (value: boolean) => void;
};

function avitoState(listing: ChannelListingDTO | undefined) {
  if (!listing) {
    return { label: "Не подключено", tone: "idle" as const };
  }

  if (listing.status === "INACTIVE") {
    return { label: "Отключено", tone: "idle" as const };
  }

  if (listing.syncStatus === "ERROR") {
    return { label: "Ошибка", tone: "error" as const };
  }

  return { label: "Подключено", tone: "ok" as const };
}

export function AvitoPropertyChannel({
  propertyId,
  channel,
  listing,
  pending,
  onReload,
  setError,
  setPending,
}: AvitoPropertyChannelProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [listings, setListings] = useState<ExternalListing[]>([]);
  const [connected, setConnected] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadConnection() {
      const response = await fetch("/api/integrations/avito");
      if (!response.ok || cancelled) {
        return;
      }
      const payload = (await response.json()) as { connected?: boolean };
      if (!cancelled) {
        setConnected(Boolean(payload.connected));
      }
      if (payload.connected) {
        const listingsResponse = await fetch("/api/integrations/avito/listings");
        if (listingsResponse.ok && !cancelled) {
          const listingsPayload = (await listingsResponse.json()) as {
            listings?: ExternalListing[];
          };
          setListings(listingsPayload.listings ?? []);
        }
      }
    }

    void loadConnection();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadListings() {
    setLoadingList(true);
    const response = await fetch("/api/integrations/avito/listings");
    const payload = (await response.json()) as { listings?: ExternalListing[]; error?: string };
    if (!response.ok) {
      throw new Error(payload.error || "Не удалось получить объявления Авито");
    }
    setListings(payload.listings ?? []);
    setLoadingList(false);
  }

  async function bindListing(item: ExternalListing) {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/properties/${propertyId}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesChannelId: channel.id,
          externalId: item.id,
          externalUrl: item.url ?? "",
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Не удалось привязать объявление");
      }
      setPickerOpen(false);
      await onReload();
    } finally {
      setPending(false);
    }
  }

  async function patchStatus(status: "ACTIVE" | "INACTIVE") {
    if (!listing) {
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/properties/${propertyId}/channels/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Не удалось изменить статус Авито");
      }
      await onReload();
    } finally {
      setPending(false);
    }
  }

  async function syncListing() {
    if (!listing) {
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/properties/${propertyId}/channels/${listing.id}/sync`, {
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Не удалось синхронизировать объект");
      }
      await onReload();
    } finally {
      setPending(false);
    }
  }

  const matched = listing
    ? listings.find((item) => item.id === listing.externalId)
    : undefined;
  const state = avitoState(listing);
  const isActive = listing?.status === "ACTIVE";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-zinc-900">Авито — посуточная аренда</h3>
          {listing ? (
            <div className="mt-1 space-y-1 text-sm text-zinc-600">
              <p>
                <span
                  className={`mr-2 inline-block h-2 w-2 rounded-full ${
                    state.tone === "ok"
                      ? "bg-emerald-500"
                      : state.tone === "error"
                        ? "bg-red-500"
                        : "bg-zinc-300"
                  }`}
                />
                {state.label}
              </p>
              <p>Объявление: {matched?.title ?? listing.externalId}</p>
              <p>ID: {listing.externalId}</p>
              {isActive ? (
                <>
                  <p>
                    Синхронизация:{" "}
                    {listing.syncStatus === "ERROR" ? (
                      <span className="text-red-700">Ошибка</span>
                    ) : (
                      <span>● OK</span>
                    )}
                  </p>
                  <p>
                    Последняя синхронизация:{" "}
                    {listing.lastSyncAt ? formatDateTime(listing.lastSyncAt) : "—"}
                  </p>
                </>
              ) : (
                <p>Синхронизация остановлена</p>
              )}
              {listing.syncError ? <p className="text-red-700">{listing.syncError}</p> : null}
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
          {listing && isActive ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  void syncListing().catch((syncError: unknown) => {
                    setError(syncError instanceof Error ? syncError.message : "Ошибка синхронизации");
                  })
                }
                className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Синхронизировать объект
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  void patchStatus("INACTIVE").catch((disableError: unknown) => {
                    setError(
                      disableError instanceof Error
                        ? disableError.message
                        : "Не удалось отключить Авито",
                    );
                  })
                }
                className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Отключить от Авито
              </button>
            </>
          ) : null}
          {listing && !isActive ? (
            <button
              type="button"
              disabled={pending || !listing.externalId}
              onClick={() =>
                void patchStatus("ACTIVE").catch((enableError: unknown) => {
                  setError(
                    enableError instanceof Error
                      ? enableError.message
                      : "Не удалось подключить Авито",
                  );
                })
              }
              className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Подключить к Авито
            </button>
          ) : null}
          {!listing ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!connected) {
                  setError("Сначала подключите Авито в Настройках.");
                  return;
                }
                setPickerOpen(true);
                void loadListings().catch((loadError: unknown) => {
                  setError(
                    loadError instanceof Error ? loadError.message : "Не удалось получить объявления",
                  );
                });
              }}
              className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Привязать объявление
            </button>
          ) : null}
        </div>
      </div>

      {!connected ? (
        <p className="mt-2 text-xs text-zinc-500">
          <Link href="/crm/settings/integrations/avito" className="underline">
            Подключить аккаунт Авито
          </Link>
        </p>
      ) : null}

      {pickerOpen && !listing ? (
        <div className="mt-4 space-y-3 rounded-lg bg-zinc-50 p-4">
          <h4 className="text-sm font-medium">Мои объявления Авито</h4>
          {loadingList ? <p className="text-sm text-zinc-500">Загрузка объявлений...</p> : null}
          {listings.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3"
            >
              <div className="text-sm">
                <p className="font-medium text-zinc-900">{item.title}</p>
                <p className="text-zinc-500">ID: {item.id}</p>
                <p className="text-zinc-500">Статус: {item.status}</p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  void bindListing(item).catch((bindError: unknown) => {
                    setError(
                      bindError instanceof Error ? bindError.message : "Не удалось привязать объявление",
                    );
                  })
                }
                className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                Привязать
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPickerOpen(false)}
            className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs"
          >
            Отмена
          </button>
        </div>
      ) : null}
    </div>
  );
}
