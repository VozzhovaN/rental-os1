"use client";

import { useRouter } from "next/navigation";
import { CianSalePrepareAction } from "@/components/sales/cian-sale-prepare-action";
import { CianSaleXmlPreviewActions } from "@/components/sales/cian-sale-xml-preview-actions";
import { formatDateTime } from "@/lib/format";
import { publicationStatusLabels } from "@/lib/publication-labels";
import type {
  CianSaleListingPreviewResult,
  CianSalePublicationDiagnosticsView,
} from "@/lib/publications/providers/cian/sale";

function IssueList({
  title,
  items,
}: {
  title: string;
  items: Array<{ code: string; field: string; message: string }>;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-zinc-500">{title}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-800">
        {items.map((item) => (
          <li key={`${item.code}:${item.field}`}>{item.message}</li>
        ))}
      </ul>
    </div>
  );
}

function statusLabel(diagnostics: CianSalePublicationDiagnosticsView) {
  const status = diagnostics.publication?.status;
  if (!status) {
    return "Нет SalePublication";
  }
  if (status === "PUBLISHED") {
    if (diagnostics.publication?.lastSuccessAt) {
      return publicationStatusLabels.PUBLISHED;
    }
    return "PUBLISHED (ожидает подтверждения площадки)";
  }
  return publicationStatusLabels[status];
}

export function CianSalePublicationDiagnostics({
  preview,
  diagnostics,
}: {
  preview: CianSaleListingPreviewResult;
  diagnostics: CianSalePublicationDiagnosticsView;
}) {
  const router = useRouter();
  const errors = preview.ready ? [] : preview.errors;
  const warnings = preview.ready ? preview.cian.warnings : preview.warnings;
  const publication = diagnostics.publication;

  return (
    <article className="space-y-3 rounded-lg border border-zinc-200 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">ЦИАН</p>
          <p className="text-xs text-zinc-500">Category=flatSale · Feed_Version=2</p>
        </div>
        <span className="font-medium">{statusLabel(diagnostics)}</span>
      </div>

      {diagnostics.soldBlocked ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Объект продан — требуется снятие публикации на стороне провайдера
        </p>
      ) : null}

      <dl className="grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
        <div>
          <dt className="text-zinc-400">Базовая готовность</dt>
          <dd>{preview.baseline.ready ? "Да" : "Нет"}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">CIAN readiness</dt>
          <dd>{preview.cian.valid ? "Да" : "Нет"}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">В фиде</dt>
          <dd>{diagnostics.includedInFeed ? "YES" : "NO"}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">Payload changed</dt>
          <dd>{diagnostics.payloadChanged ? "Да" : "Нет"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-400">Normalized hash</dt>
          <dd className="break-all font-mono">{preview.normalizedHash}</dd>
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
        <div>
          <dt className="text-zinc-400">Status sync</dt>
          <dd className="font-mono">{diagnostics.statusSync}</dd>
        </div>
        <div>
          <dt className="text-zinc-400">Unpublish</dt>
          <dd className="font-mono">{diagnostics.unpublish}</dd>
        </div>
      </dl>

      <IssueList title="Ошибки" items={errors} />
      <IssueList title="Предупреждения" items={warnings} />

      {publication?.status === "PUBLISHING" ? (
        <p className="text-xs font-medium text-emerald-800">Подготовлено к отправке</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => router.refresh()}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
        >
          Проверить
        </button>
      </div>

      <CianSalePrepareAction
        saleListingId={preview.listingId}
        canPrepare={diagnostics.canPrepare}
      />
      <CianSaleXmlPreviewActions
        saleListingId={preview.listingId}
        ready={preview.ready}
      />
    </article>
  );
}
