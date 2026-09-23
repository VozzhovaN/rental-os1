"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { integrationStatusLabels } from "@/lib/integrations/labels";
import type { IntegrationStatus } from "@prisma/client";

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

export function AvitoSettings({
  initialError,
  connected,
}: {
  initialError?: string;
  connected?: boolean;
}) {
  const [status, setStatus] = useState<AvitoStatus | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [notice, setNotice] = useState<string | null>(
    connected ? "Авито подключено" : null,
  );
  const [pending, setPending] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  async function load() {
    const response = await fetch("/api/integrations/avito");
    if (!response.ok) {
      throw new Error(await readError(response));
    }
    setStatus((await response.json()) as AvitoStatus);
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const response = await fetch("/api/integrations/avito");
        if (!response.ok) {
          throw new Error(await readError(response));
        }
        const payload = (await response.json()) as AvitoStatus;
        if (!cancelled) {
          setStatus(payload);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить статус");
        }
      }
    }

    void fetchStatus();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const connectedNow = status?.status === "CONNECTED" || status?.status === "SYNCING";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/crm/settings/integrations" className="text-zinc-500 hover:text-zinc-800">
          ← Интеграции
        </Link>
        <Link href="/crm/settings/integrations/logs" className="text-zinc-500 hover:text-zinc-800">
          Журнал
        </Link>
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {notice ? (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>
      ) : null}

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold">Статус Авито</h2>
        <p className="mt-3 text-sm text-zinc-700">
          <span
            className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${
              connectedNow ? "bg-emerald-500" : "bg-zinc-300"
            }`}
          />
          {status ? integrationStatusLabels[status.status] : "Загрузка..."}
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Аккаунт Авито</dt>
            <dd>{status?.accountId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Последняя синхронизация</dt>
            <dd>{status?.lastSyncAt ? formatDateTime(status.lastSyncAt) : "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Статус</dt>
            <dd>
              {status?.status === "CONNECTED"
                ? "Синхронизировано"
                : status
                  ? integrationStatusLabels[status.status]
                  : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Ошибка</dt>
            <dd>{status?.lastError ?? "—"}</dd>
          </div>
        </dl>
      </section>

      {syncResult ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 text-sm">
          <p className="font-medium">Синхронизация завершена</p>
          <ul className="mt-2 space-y-1 text-zinc-600">
            <li>Объявлений: {syncResult.listings}</li>
            <li>Новых броней: {syncResult.imported}</li>
            <li>Обновлено: {syncResult.updated}</li>
            <li>Ошибок: {syncResult.errors}</li>
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!connectedNow ? (
          <>
            <button
              type="button"
              disabled={pending || status?.configured === false}
              onClick={() =>
                run(async () => {
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
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              Подключить Авито
            </button>
            <button
              type="button"
              disabled={pending || status?.configured === false}
              onClick={() =>
                run(async () => {
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
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-white disabled:opacity-50"
            >
              Подключить по client credentials
            </button>
          </>
        ) : null}
        {connectedNow ? (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  setNotice("Синхронизация запущена");
                  const response = await fetch("/api/integrations/avito/sync", { method: "POST" });
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
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              Синхронизировать сейчас
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const response = await fetch("/api/integrations/avito/listings/sync", {
                    method: "POST",
                  });
                  const payload = (await response.json()) as { error?: string; count?: number };
                  if (!response.ok) {
                    throw new Error(payload.error || "Не удалось обновить объявления");
                  }
                  setNotice(`Объявления обновлены: ${payload.count ?? 0}`);
                })
              }
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-white disabled:opacity-50"
            >
              Обновить объявления
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(async () => {
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
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Отключить Авито
            </button>
          </>
        ) : null}
      </div>

      {status?.configured === false ? (
        <p className="text-sm text-zinc-500">
          Задайте AVITO_CLIENT_ID, AVITO_CLIENT_SECRET и AVITO_REDIRECT_URI в .env.
        </p>
      ) : null}
    </div>
  );
}
