"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/crm/empty-state";
import { StatusBadge } from "@/components/crm/status-badge";
import { formatDateTime } from "@/lib/format";
import { integrationStatusLabels } from "@/lib/integrations/labels";
import { integrationStatusTone } from "@/lib/integrations/status-tone";
import type { IntegrationStatus } from "@prisma/client";

export type AvitoBoundListing = {
  id: string;
  propertyId: string;
  propertyName: string;
  externalId: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  syncStatus: string;
  lastSyncAt: string | null;
  syncError: string | null;
};

type AvitoStatus = {
  provider: string;
  status: IntegrationStatus;
  accountId: string | null;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  connected: boolean;
  configured: boolean;
};

type SyncResult = {
  listings: number;
  imported: number;
  updated: number;
  errors: number;
  availabilityExported: number;
};

async function readError(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error || "Операция не выполнена";
}

function listingStatusLabel(listing: AvitoBoundListing) {
  if (listing.status === "INACTIVE" || listing.status === "ARCHIVED") {
    return { label: "Синхронизация отключена", tone: "neutral" as const };
  }
  if (listing.syncStatus === "ERROR") {
    return { label: "Ошибка", tone: "danger" as const };
  }
  return { label: "Активна", tone: "success" as const };
}

export function AvitoSettings({
  initialStatus,
  initialError,
  connected,
  boundListings,
}: {
  initialStatus: AvitoStatus | null;
  initialError?: string;
  connected?: boolean;
  boundListings: AvitoBoundListing[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<AvitoStatus | null>(initialStatus);
  const [listings, setListings] = useState(boundListings);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [notice, setNotice] = useState<string | null>(
    connected ? "Авито подключено" : null,
  );
  const [pending, setPending] = useState(false);
  const [pendingListingId, setPendingListingId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  async function load() {
    const response = await fetch("/api/integrations/avito");
    if (!response.ok) {
      throw new Error(await readError(response));
    }
    setStatus((await response.json()) as AvitoStatus);
    router.refresh();
  }

  async function run(action: () => Promise<void>) {
    setPending(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Ошибка интеграции");
    } finally {
      setPending(false);
    }
  }

  async function patchListing(listing: AvitoBoundListing, next: "ACTIVE" | "INACTIVE") {
    setPendingListingId(listing.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/properties/${listing.propertyId}/channels/${listing.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Не удалось изменить синхронизацию");
      }
      setListings((prev) =>
        prev.map((row) =>
          row.id === listing.id
            ? {
                ...row,
                status: next,
                syncStatus: next === "ACTIVE" ? "CONNECTED" : "NOT_CONNECTED",
                syncError: next === "ACTIVE" ? null : row.syncError,
              }
            : row,
        ),
      );
      setNotice(
        next === "INACTIVE"
          ? "Синхронизация отключена. Привязка сохранена."
          : "Синхронизация включена",
      );
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Ошибка");
    } finally {
      setPendingListingId(null);
    }
  }

  async function retryListing(listing: AvitoBoundListing) {
    setPendingListingId(listing.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/properties/${listing.propertyId}/channels/${listing.id}/sync`,
        { method: "POST" },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Не удалось повторить синхронизацию");
      }
      setNotice("Синхронизация объекта запущена");
      router.refresh();
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Ошибка");
    } finally {
      setPendingListingId(null);
    }
  }

  const connectedNow = status?.status === "CONNECTED" || status?.status === "SYNCING";
  const currentStatus = status?.status ?? "DISCONNECTED";

  return (
    <div className="space-y-5">
      {error ? (
        <p className="rounded-xl bg-[var(--finance-red-light)] px-4 py-3 text-sm text-[var(--finance-red)]">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-xl bg-[var(--finance-green-light)] px-4 py-3 text-sm text-[var(--finance-green)]">
          {notice}
        </p>
      ) : null}

      <section className="finance-card space-y-4 p-5">
        <h2 className="text-base font-semibold text-[var(--finance-text)]">
          Статус подключения
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge tone={integrationStatusTone(currentStatus)} dot>
            {integrationStatusLabels[currentStatus]}
          </StatusBadge>
          {status?.accountId ? (
            <span className="text-sm text-[var(--finance-text-secondary)]">
              Аккаунт: {status.accountId}
            </span>
          ) : null}
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--finance-text-muted)]">Последняя синхронизация</dt>
            <dd>{status?.lastSyncAt ? formatDateTime(status.lastSyncAt) : "Не указан"}</dd>
          </div>
          <div>
            <dt className="text-[var(--finance-text-muted)]">Последний успех</dt>
            <dd>
              {status?.lastSuccessAt ? formatDateTime(status.lastSuccessAt) : "Не указан"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="finance-card space-y-3 p-5">
        <h2 className="text-base font-semibold text-[var(--finance-text)]">Возможности</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex gap-2 text-[var(--finance-text)]">
            <span className="text-[var(--finance-green)]" aria-hidden>
              ✓
            </span>
            Привязка существующего объявления
          </li>
          <li className="flex gap-2 text-[var(--finance-text)]">
            <span className="text-[var(--finance-green)]" aria-hidden>
              ✓
            </span>
            Импорт бронирований
          </li>
          <li className="flex gap-2 text-[var(--finance-text)]">
            <span className="text-[var(--finance-green)]" aria-hidden>
              ✓
            </span>
            Синхронизация занятости
          </li>
          <li className="flex gap-2 text-[var(--finance-text-secondary)]">
            <span className="text-[var(--finance-text-muted)]" aria-hidden>
              —
            </span>
            <span>
              Создание объявления из CRM
              <span className="mt-0.5 block text-xs text-[var(--finance-text-muted)]">
                Не поддерживается текущей интеграцией
              </span>
            </span>
          </li>
        </ul>
      </section>

      <section className="finance-card space-y-4 p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-base font-semibold text-[var(--finance-text)]">
            Привязанные объекты
          </h2>
          <Link
            href="/crm/properties"
            className="text-sm font-medium text-[var(--finance-blue)] hover:underline"
          >
            Привязать в карточке объекта
          </Link>
        </div>

        {listings.length === 0 ? (
          <EmptyState
            title="Нет привязанных объектов"
            description="Откройте карточку объекта и привяжите существующее объявление Авито."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--finance-border)] text-[var(--finance-text-muted)]">
                <tr>
                  <th className="px-2 py-2 font-medium">Объект</th>
                  <th className="px-2 py-2 font-medium">ChannelListing</th>
                  <th className="px-2 py-2 font-medium">Статус</th>
                  <th className="px-2 py-2 font-medium">Последняя синхронизация</th>
                  <th className="px-2 py-2 font-medium">Действие</th>
                </tr>
              </thead>
              <tbody>
                {listings.map((listing) => {
                  const state = listingStatusLabel(listing);
                  const busy = pendingListingId === listing.id;
                  return (
                    <tr key={listing.id} className="border-t border-[var(--finance-border)]">
                      <td className="px-2 py-3">
                        <Link
                          href={`/crm/properties/${listing.propertyId}`}
                          className="font-medium text-[var(--finance-blue)] hover:underline"
                        >
                          {listing.propertyName}
                        </Link>
                      </td>
                      <td className="px-2 py-3 text-[var(--finance-text-secondary)]">
                        {listing.externalId}
                      </td>
                      <td className="px-2 py-3">
                        <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
                      </td>
                      <td className="px-2 py-3 text-[var(--finance-text-secondary)]">
                        {listing.lastSyncAt ? formatDateTime(listing.lastSyncAt) : "Не указан"}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap gap-2">
                          {listing.status === "ACTIVE" ? (
                            <>
                              <button
                                type="button"
                                disabled={busy || pending}
                                onClick={() => void retryListing(listing)}
                                className="rounded-lg border border-[var(--finance-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--finance-hover)] disabled:opacity-50"
                              >
                                Повторить
                              </button>
                              <button
                                type="button"
                                disabled={busy || pending}
                                onClick={() => void patchListing(listing, "INACTIVE")}
                                className="rounded-lg border border-[var(--finance-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--finance-hover)] disabled:opacity-50"
                              >
                                Отключить синхронизацию
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={busy || pending || !listing.externalId}
                              onClick={() => void patchListing(listing, "ACTIVE")}
                              className="rounded-lg border border-[var(--finance-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--finance-hover)] disabled:opacity-50"
                            >
                              Включить синхронизацию
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="finance-card space-y-3 p-5">
        <h2 className="text-base font-semibold text-[var(--finance-text)]">
          Последняя синхронизация
        </h2>
        {syncResult ? (
          <ul className="space-y-1 text-sm text-[var(--finance-text-secondary)]">
            <li>Объявлений: {syncResult.listings}</li>
            <li>Новых броней: {syncResult.imported}</li>
            <li>Обновлено: {syncResult.updated}</li>
            <li>Выгружено занятости: {syncResult.availabilityExported}</li>
            <li>Ошибок: {syncResult.errors}</li>
          </ul>
        ) : (
          <p className="text-sm text-[var(--finance-text-secondary)]">
            {status?.lastSyncAt
              ? `Последний запуск: ${formatDateTime(status.lastSyncAt)}`
              : "Синхронизация ещё не запускалась."}
          </p>
        )}
      </section>

      <section className="finance-card space-y-3 p-5">
        <h2 className="text-base font-semibold text-[var(--finance-text)]">
          Последние ошибки
        </h2>
        {status?.lastError ? (
          <p className="rounded-lg bg-[var(--finance-red-light)] px-3 py-2 text-sm text-[var(--finance-red)]">
            {status.lastError}
            {status.lastErrorAt ? (
              <span className="mt-1 block text-xs opacity-80">
                {formatDateTime(status.lastErrorAt)}
              </span>
            ) : null}
          </p>
        ) : (
          <p className="text-sm text-[var(--finance-text-secondary)]">Ошибок нет</p>
        )}
        {listings.some((l) => l.syncError) ? (
          <ul className="space-y-2 text-sm">
            {listings
              .filter((l) => l.syncError)
              .map((l) => (
                <li
                  key={l.id}
                  className="rounded-lg border border-[var(--finance-border)] px-3 py-2"
                >
                  <span className="font-medium">{l.propertyName}: </span>
                  {l.syncError}
                </li>
              ))}
          </ul>
        ) : null}
      </section>

      <section className="finance-card space-y-3 p-5">
        <h2 className="text-base font-semibold text-[var(--finance-text)]">Действия</h2>
        <div className="flex flex-wrap gap-2">
          {!connectedNow ? (
            <>
              <button
                type="button"
                disabled={pending || status?.configured === false}
                onClick={() =>
                  void run(async () => {
                    const response = await fetch("/api/integrations/avito/connect", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ flow: "oauth" }),
                    });
                    const payload = (await response.json()) as {
                      error?: string;
                      redirectUrl?: string;
                    };
                    if (!response.ok) {
                      throw new Error(payload.error || "Не удалось начать подключение");
                    }
                    if (payload.redirectUrl) {
                      window.location.assign(payload.redirectUrl);
                      return;
                    }
                    setNotice("Авито подключено");
                  })
                }
                className="rounded-xl bg-[var(--finance-blue)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "…" : "Подключить Авито"}
              </button>
              <button
                type="button"
                disabled={pending || status?.configured === false}
                onClick={() =>
                  void run(async () => {
                    const response = await fetch("/api/integrations/avito/connect", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ flow: "client_credentials" }),
                    });
                    const payload = (await response.json()) as { error?: string };
                    if (!response.ok) {
                      throw new Error(payload.error || "Не удалось подключить Авито");
                    }
                    setNotice("Авито подключено");
                  })
                }
                className="rounded-xl border border-[var(--finance-border)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--finance-hover)] disabled:opacity-50"
              >
                Подключить по client credentials
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  void run(async () => {
                    setNotice("Синхронизация запущена");
                    const response = await fetch("/api/integrations/avito/sync", {
                      method: "POST",
                    });
                    const payload = (await response.json()) as {
                      error?: string;
                      result?: SyncResult;
                    };
                    if (!response.ok) {
                      throw new Error(payload.error || "Синхронизация не выполнена");
                    }
                    setSyncResult(payload.result ?? null);
                    setNotice("Синхронизация завершена");
                  })
                }
                className="rounded-xl bg-[var(--finance-blue)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "…" : "Синхронизировать сейчас"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  void run(async () => {
                    const response = await fetch("/api/integrations/avito/listings/sync", {
                      method: "POST",
                    });
                    const payload = (await response.json()) as {
                      error?: string;
                      count?: number;
                    };
                    if (!response.ok) {
                      throw new Error(payload.error || "Не удалось обновить объявления");
                    }
                    setNotice(`Объявления обновлены: ${payload.count ?? 0}`);
                  })
                }
                className="rounded-xl border border-[var(--finance-border)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--finance-hover)] disabled:opacity-50"
              >
                Обновить объявления
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  void run(async () => {
                    const response = await fetch("/api/integrations/avito/disconnect", {
                      method: "POST",
                    });
                    const payload = (await response.json()) as { error?: string };
                    if (!response.ok) {
                      throw new Error(payload.error || "Не удалось отключить Авито");
                    }
                    setNotice("Авито отключено");
                    setSyncResult(null);
                  })
                }
                className="rounded-xl border border-[var(--finance-red)]/30 px-4 py-2.5 text-sm font-medium text-[var(--finance-red)] hover:bg-[var(--finance-red-light)] disabled:opacity-50"
              >
                Отключить Авито
              </button>
            </>
          )}
        </div>
        {status?.configured === false ? (
          <p className="text-sm text-[var(--finance-text-muted)]">
            Задайте AVITO_CLIENT_ID, AVITO_CLIENT_SECRET и AVITO_REDIRECT_URI в окружении.
          </p>
        ) : null}
      </section>
    </div>
  );
}
