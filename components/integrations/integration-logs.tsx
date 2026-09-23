"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";

type LogRow = {
  id: string;
  createdAt: string;
  channel: string;
  direction: string;
  entityType: string;
  status: string;
  errorMessage: string | null;
};

export function IntegrationLogs() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState("AVITO");
  const [status, setStatus] = useState("");
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    const params = new URLSearchParams();
    if (channel) params.set("channel", channel);
    if (status) params.set("status", status);
    if (entityType) params.set("entityType", entityType);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
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
        const params = new URLSearchParams();
        params.set("channel", "AVITO");
        const response = await fetch(`/api/integrations/logs?${params.toString()}`);
        const payload = (await response.json()) as { logs?: LogRow[]; error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Не удалось загрузить журнал");
        }
        if (!cancelled) {
          setLogs(payload.logs ?? []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить журнал");
        }
      }
    }

    void fetchLogs();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <Link href="/crm/settings/integrations/avito" className="text-sm text-zinc-500 hover:text-zinc-800">
        ← Авито
      </Link>
      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <form
        className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          void load().catch((loadError: unknown) => {
            setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить журнал");
          });
        }}
      >
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Канал</span>
          <select
            value={channel}
            onChange={(event) => setChannel(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-2 py-2"
          >
            <option value="AVITO">Авито</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Статус</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-2 py-2"
          >
            <option value="">Все</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="ERROR">ERROR</option>
            <option value="STARTED">STARTED</option>
            <option value="SKIPPED">SKIPPED</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">Операция</span>
          <select
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-2 py-2"
          >
            <option value="">Все</option>
            <option value="LISTING">Listing</option>
            <option value="BOOKING">Booking</option>
            <option value="AVAILABILITY">Availability</option>
            <option value="PRICE">Price</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">С</span>
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-2 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">По</span>
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-2 py-2"
          />
        </label>
        <div className="sm:col-span-5">
          <button type="submit" className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white">
            Применить
          </button>
        </div>
      </form>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
            <tr>
              <th className="px-3 py-2 font-medium">Время</th>
              <th className="px-3 py-2 font-medium">Канал</th>
              <th className="px-3 py-2 font-medium">Операция</th>
              <th className="px-3 py-2 font-medium">Направление</th>
              <th className="px-3 py-2 font-medium">Статус</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-zinc-500">
                  Записей нет
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-t border-zinc-100">
                  <td className="px-3 py-2">{formatDateTime(log.createdAt)}</td>
                  <td className="px-3 py-2">{log.channel}</td>
                  <td className="px-3 py-2">{log.entityType}</td>
                  <td className="px-3 py-2">{log.direction}</td>
                  <td className="px-3 py-2">
                    {log.status}
                    {log.errorMessage ? (
                      <p className="mt-1 max-w-md text-xs text-red-700">{log.errorMessage}</p>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
