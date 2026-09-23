"use client";

import { Fragment, useEffect, useState } from "react";
import { EmptyState } from "@/components/crm/empty-state";
import { StatusBadge } from "@/components/crm/status-badge";
import { formatDateTime } from "@/lib/format";
import {
  providerDisplayNames,
  syncDirectionLabels,
  syncEntityTypeLabels,
  syncLogStatusLabels,
} from "@/lib/integrations/labels";
import { syncLogStatusTone } from "@/lib/integrations/status-tone";
import type { SyncDirection, SyncEntityType, SyncLogStatus } from "@prisma/client";

type LogRow = {
  id: string;
  createdAt: string;
  channel: string;
  channelCode: string;
  direction: SyncDirection;
  entityType: SyncEntityType;
  status: SyncLogStatus;
  externalId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

const SENSITIVE =
  /access[_-]?token|refresh[_-]?token|SESSION_SECRET|INTEGRATION_ENCRYPTION_KEY|Bearer\s+\S+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gi;

function redact(text: string | null) {
  if (!text) return null;
  return text.replace(SENSITIVE, "[redacted]");
}

function providerLabel(code: string, name: string) {
  return providerDisplayNames[code] ?? name;
}

function actionLabel(log: LogRow) {
  return `${syncDirectionLabels[log.direction]} · ${syncEntityTypeLabels[log.entityType]}`;
}

function summary(log: LogRow) {
  const provider = providerLabel(log.channelCode, log.channel);
  const action = actionLabel(log);
  const result = syncLogStatusLabels[log.status];
  const object = log.externalId ? `Объект: ${log.externalId}. ` : "";
  const err = redact(log.errorMessage);
  return `${provider}: ${action}. ${object}Результат: ${result}.${err ? ` ${err}` : ""}`;
}

export function IntegrationLogs() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState("AVITO");
  const [status, setStatus] = useState("");
  const [entityType, setEntityType] = useState("");
  const [objectQuery, setObjectQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load(filters?: {
    channel?: string;
    status?: string;
    entityType?: string;
    from?: string;
    to?: string;
  }) {
    const params = new URLSearchParams();
    const ch = filters?.channel ?? channel;
    const st = filters?.status ?? status;
    const et = filters?.entityType ?? entityType;
    const fr = filters?.from ?? from;
    const t = filters?.to ?? to;
    if (ch) params.set("channel", ch);
    if (st) params.set("status", st);
    if (et) params.set("entityType", et);
    if (fr) params.set("from", fr);
    if (t) params.set("to", t);
    const response = await fetch(`/api/integrations/logs?${params.toString()}`);
    const payload = (await response.json()) as { logs?: LogRow[]; error?: string };
    if (!response.ok) {
      throw new Error(payload.error || "Не удалось загрузить журнал");
    }
    setLogs(payload.logs ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    async function fetchLogs() {
      try {
        setLoading(true);
        await load({ channel: "AVITO" });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить журнал");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchLogs();
    return () => {
      cancelled = true;
    };
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = objectQuery.trim()
    ? logs.filter((log) =>
        (log.externalId ?? "").toLowerCase().includes(objectQuery.trim().toLowerCase()),
      )
    : logs;

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl bg-[var(--finance-red-light)] px-4 py-3 text-sm text-[var(--finance-red)]">
          {error}
        </p>
      ) : null}

      <form
        className="grid gap-3 rounded-xl border border-[var(--finance-border)] bg-white p-4 sm:grid-cols-2 lg:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          setLoading(true);
          void load()
            .catch((loadError: unknown) => {
              setError(
                loadError instanceof Error ? loadError.message : "Не удалось загрузить журнал",
              );
            })
            .finally(() => setLoading(false));
        }}
      >
        <label className="text-sm">
          <span className="mb-1 block text-[var(--finance-text-muted)]">Провайдер</span>
          <select
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
            className="h-10 w-full rounded-xl border border-[var(--finance-border)] px-3"
          >
            <option value="AVITO">Авито</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--finance-text-muted)]">Статус</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-10 w-full rounded-xl border border-[var(--finance-border)] px-3"
          >
            <option value="">Все</option>
            <option value="SUCCESS">{syncLogStatusLabels.SUCCESS}</option>
            <option value="ERROR">{syncLogStatusLabels.ERROR}</option>
            <option value="STARTED">{syncLogStatusLabels.STARTED}</option>
            <option value="SKIPPED">{syncLogStatusLabels.SKIPPED}</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--finance-text-muted)]">Действие</span>
          <select
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
            className="h-10 w-full rounded-xl border border-[var(--finance-border)] px-3"
          >
            <option value="">Все</option>
            <option value="LISTING">{syncEntityTypeLabels.LISTING}</option>
            <option value="BOOKING">{syncEntityTypeLabels.BOOKING}</option>
            <option value="AVAILABILITY">{syncEntityTypeLabels.AVAILABILITY}</option>
            <option value="PRICE">{syncEntityTypeLabels.PRICE}</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--finance-text-muted)]">Объект</span>
          <input
            type="text"
            value={objectQuery}
            onChange={(event) => setObjectQuery(event.target.value)}
            placeholder="External ID"
            className="h-10 w-full rounded-xl border border-[var(--finance-border)] px-3"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--finance-text-muted)]">С</span>
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="h-10 w-full rounded-xl border border-[var(--finance-border)] px-3"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[var(--finance-text-muted)]">По</span>
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="h-10 w-full rounded-xl border border-[var(--finance-border)] px-3"
          />
        </label>
        <div className="lg:col-span-6">
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[var(--finance-blue)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Загрузка…" : "Применить"}
          </button>
        </div>
      </form>

      {loading && filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--finance-border)] bg-white px-4 py-10 text-center text-sm text-[var(--finance-text-secondary)]">
          Загрузка журнала…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Событий синхронизации пока нет." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--finance-border)] bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--finance-border)] bg-[var(--finance-hover)] text-[var(--finance-text-muted)]">
              <tr>
                <th className="px-3 py-2.5 font-medium">Время</th>
                <th className="px-3 py-2.5 font-medium">Провайдер</th>
                <th className="px-3 py-2.5 font-medium">Действие</th>
                <th className="px-3 py-2.5 font-medium">Объект</th>
                <th className="px-3 py-2.5 font-medium">Результат</th>
                <th className="px-3 py-2.5 font-medium">Подробнее</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => {
                const open = expandedId === log.id;
                return (
                  <Fragment key={log.id}>
                    <tr className="border-t border-[var(--finance-border)]">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-3 py-2.5">
                        {providerLabel(log.channelCode, log.channel)}
                      </td>
                      <td className="px-3 py-2.5">{actionLabel(log)}</td>
                      <td className="px-3 py-2.5 text-[var(--finance-text-secondary)]">
                        {log.externalId || "Не указан"}
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge tone={syncLogStatusTone(log.status)}>
                          {syncLogStatusLabels[log.status]}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => setExpandedId(open ? null : log.id)}
                          className="text-sm font-medium text-[var(--finance-blue)] hover:underline"
                        >
                          {open ? "Скрыть" : "Открыть"}
                        </button>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="border-t border-[var(--finance-border)] bg-[var(--finance-hover)]/50">
                        <td colSpan={6} className="px-3 py-3">
                          <p className="text-sm text-[var(--finance-text)]">{summary(log)}</p>
                          <details className="mt-3">
                            <summary className="cursor-pointer text-xs font-medium text-[var(--finance-text-muted)]">
                              Технические детали
                            </summary>
                            <dl className="mt-2 grid gap-2 font-mono text-xs text-[var(--finance-text-secondary)] sm:grid-cols-2">
                              <div>
                                <dt>status</dt>
                                <dd>{log.status}</dd>
                              </div>
                              <div>
                                <dt>direction</dt>
                                <dd>{log.direction}</dd>
                              </div>
                              <div>
                                <dt>entityType</dt>
                                <dd>{log.entityType}</dd>
                              </div>
                              <div>
                                <dt>errorCode</dt>
                                <dd>{log.errorCode || "—"}</dd>
                              </div>
                              <div className="sm:col-span-2">
                                <dt>errorMessage</dt>
                                <dd className="break-all">{redact(log.errorMessage) || "—"}</dd>
                              </div>
                            </dl>
                          </details>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
