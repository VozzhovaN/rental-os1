"use client";

import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import type { AvitoSaleDiagnosticsView } from "@/lib/publications/providers/avito/sale";
import type { DomclickSaleDiagnosticsView } from "@/lib/publications/providers/domclick/sale";

type BlockedDiagnostics = AvitoSaleDiagnosticsView | DomclickSaleDiagnosticsView;

export function BlockedSaleProviderDiagnostics({
  title,
  diagnostics,
}: {
  title: string;
  diagnostics: BlockedDiagnostics;
}) {
  const router = useRouter();
  const publication = diagnostics.publication;

  return (
    <article className="space-y-3 rounded-lg border border-zinc-200 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-xs text-zinc-500">
            Feed: {diagnostics.capabilities.feed} · Preview: {diagnostics.capabilities.preview}
          </p>
        </div>
        <span className="font-medium">{diagnostics.statusLabel}</span>
      </div>

      {diagnostics.soldBlocked ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Объект продан — требуется снятие публикации на стороне провайдера
        </p>
      ) : null}

      <dl className="grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
        <div>
          <dt className="text-zinc-400">Базовая готовность</dt>
          <dd>{diagnostics.baseline.ready ? "Да" : "Нет"}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">Provider readiness</dt>
          <dd>Нет (serializer blocked)</dd>
        </div>
        <div>
          <dt className="text-zinc-400">В фиде</dt>
          <dd>NO</dd>
        </div>
        <div>
          <dt className="text-zinc-400">Serializer</dt>
          <dd>NOT_IMPLEMENTED</dd>
        </div>
        <div>
          <dt className="text-zinc-400">Status sync</dt>
          <dd className="font-mono">{diagnostics.capabilities.statusSync}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">Unpublish</dt>
          <dd className="font-mono">{diagnostics.capabilities.unpublish}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">Последняя попытка</dt>
          <dd>
            {publication?.lastAttemptAt ? formatDateTime(publication.lastAttemptAt) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-400">Успех</dt>
          <dd>
            {publication?.lastSuccessAt ? formatDateTime(publication.lastSuccessAt) : "—"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-400">Ошибка</dt>
          <dd>{publication?.lastError || "—"}</dd>
        </div>
      </dl>

      <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-700">
        {diagnostics.messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => router.refresh()}
        className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
      >
        Проверить
      </button>
    </article>
  );
}
