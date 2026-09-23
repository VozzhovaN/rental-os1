"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CianSalePublicationDiagnostics } from "@/components/sales/cian-sale-publication-diagnostics";
import { BlockedSaleProviderDiagnostics } from "@/components/sales/blocked-sale-provider-diagnostics";
import { formatDateTime } from "@/lib/format";
import { publicationStatusLabels } from "@/lib/publication-labels";
import type { PublicationReadinessResult } from "@/lib/publications/readiness";
import type {
  CianSaleListingPreviewResult,
  CianSalePublicationDiagnosticsView,
} from "@/lib/publications/providers/cian/sale";
import type { AvitoSaleDiagnosticsView } from "@/lib/publications/providers/avito/sale";
import type { DomclickSaleDiagnosticsView } from "@/lib/publications/providers/domclick/sale";
import type { SalePublicationDTO } from "@/lib/sale-publications";
import { SALE_PROVIDER_MAPPING_STATUS } from "@/lib/publications/sale-readiness";

type ChannelOption = {
  id: string;
  code: string;
  name: string;
};

export function SalePublicationPanel({
  saleListingId,
  listingStatus,
  publications,
  readiness,
  channels,
  cianPreview,
  cianDiagnostics,
  avitoDiagnostics,
  domclickDiagnostics,
}: {
  saleListingId: string;
  listingStatus: string;
  publications: SalePublicationDTO[];
  readiness: PublicationReadinessResult;
  channels: ChannelOption[];
  cianPreview?: CianSaleListingPreviewResult | null;
  cianDiagnostics?: CianSalePublicationDiagnosticsView | null;
  avitoDiagnostics?: AvitoSaleDiagnosticsView | null;
  domclickDiagnostics?: DomclickSaleDiagnosticsView | null;
}) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sold = listingStatus === "SOLD";
  const archived = listingStatus === "ARCHIVED";
  const canStartNew = !sold && !archived;

  async function ensurePublication(channelId: string) {
    setError(null);
    setPendingKey(`create:${channelId}`);
    try {
      const response = await fetch(`/api/sale-listings/${saleListingId}/publications`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ salesChannelId: channelId }),
      });
      const payload = (await response.json()) as { error?: string; details?: string[] };
      if (!response.ok) {
        throw new Error(payload.details?.join(". ") || payload.error || "Не удалось создать");
      }
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Не удалось создать");
    } finally {
      setPendingKey(null);
    }
  }

  async function prepare(publicationId: string) {
    setError(null);
    setPendingKey(`prepare:${publicationId}`);
    try {
      const response = await fetch(`/api/sale-publications/${publicationId}/prepare`, {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Не удалось подготовить");
      }
      router.refresh();
    } catch (prepareError) {
      setError(prepareError instanceof Error ? prepareError.message : "Не удалось подготовить");
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Публикация</h2>

      {sold ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Объект продан. Новая публикация недоступна.
        </p>
      ) : null}

      <div className="space-y-2 text-sm">
        <p className="font-medium">
          {readiness.ready ? "Базовая готовность: да" : "Базовая готовность: нет"}
        </p>
        {readiness.errors.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-zinc-800">
            {readiness.errors.map((item) => (
              <li key={`${item.code}:${item.field}`}>{item.message}</li>
            ))}
          </ul>
        ) : null}
        {readiness.warnings.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-zinc-600">
            {readiness.warnings.map((item) => (
              <li key={`${item.code}:${item.field}`}>{item.message}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="space-y-3">
        {channels.map((channel) => {
          if (channel.code === "CIAN" && cianPreview && cianDiagnostics) {
            return (
              <CianSalePublicationDiagnostics
                key={channel.id}
                preview={cianPreview}
                diagnostics={cianDiagnostics}
              />
            );
          }

          if (channel.code === "AVITO" && avitoDiagnostics) {
            return (
              <BlockedSaleProviderDiagnostics
                key={channel.id}
                title="Авито"
                diagnostics={avitoDiagnostics}
              />
            );
          }

          if (channel.code === "DOMCLICK" && domclickDiagnostics) {
            return (
              <BlockedSaleProviderDiagnostics
                key={channel.id}
                title="Домклик"
                diagnostics={domclickDiagnostics}
              />
            );
          }

          const publication = publications.find((item) => item.salesChannelId === channel.id);
          const canPrepare =
            readiness.ready &&
            publication &&
            (publication.status === "NOT_PUBLISHED" ||
              publication.status === "UNPUBLISHED" ||
              publication.status === "ERROR");

          return (
            <article
              key={channel.id}
              className="space-y-2 rounded-lg border border-zinc-200 p-3 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{channel.name}</p>
                  <p className="text-xs text-zinc-500">{SALE_PROVIDER_MAPPING_STATUS}</p>
                </div>
                <span className="font-medium">
                  {publication
                    ? publicationStatusLabels[publication.status]
                    : "Нет записи"}
                </span>
              </div>

              {publication ? (
                <dl className="grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
                  <div>
                    <dt className="text-zinc-400">Последняя попытка</dt>
                    <dd>
                      {publication.lastAttemptAt
                        ? formatDateTime(publication.lastAttemptAt)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-400">Успех</dt>
                    <dd>
                      {publication.lastSuccessAt
                        ? formatDateTime(publication.lastSuccessAt)
                        : "—"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-zinc-400">Ошибка</dt>
                    <dd>{publication.lastError || "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-zinc-400">Payload</dt>
                    <dd>
                      {publication.payloadChanged == null
                        ? "—"
                        : publication.payloadChanged
                          ? "Изменился с последней подготовки"
                          : "Без изменений"}
                    </dd>
                  </div>
                </dl>
              ) : null}

              {publication?.status === "PUBLISHING" ? (
                <p className="text-xs font-medium text-emerald-800">Подготовлено к отправке</p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {!publication && canStartNew ? (
                  <button
                    type="button"
                    disabled={pendingKey === `create:${channel.id}`}
                    onClick={() => void ensurePublication(channel.id)}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs disabled:opacity-50"
                  >
                    Создать запись публикации
                  </button>
                ) : null}
                {canPrepare && canStartNew ? (
                  <button
                    type="button"
                    disabled={pendingKey === `prepare:${publication!.id}`}
                    onClick={() => void prepare(publication!.id)}
                    className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                  >
                    Подготовить к публикации
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
