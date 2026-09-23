import { CianPrepareAction } from "@/components/long-term/cian-prepare-action";
import { CianXmlPreviewActions } from "@/components/long-term/cian-xml-preview-actions";
import { formatDateTime } from "@/lib/format";
import { publicationStatusLabels } from "@/lib/publication-labels";
import type { CianPublicationDiagnosticsView } from "@/lib/publications/providers/cian";
import type { CianListingPreviewResult } from "@/lib/publications/providers/cian";

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

function statusLabel(diagnostics: CianPublicationDiagnosticsView) {
  const status = diagnostics.publication?.status;
  if (!status) {
    return "Нет Publication";
  }
  // «Опубликовано» только при подтверждённом успехе провайдера (lastSuccessAt).
  // Пока CIAN_STATUS_SYNC заблокирован, feed inclusion ≠ PUBLISHED.
  if (status === "PUBLISHED") {
    if (diagnostics.publication?.lastSuccessAt) {
      return publicationStatusLabels.PUBLISHED;
    }
    return "PUBLISHED (ожидает подтверждения площадки)";
  }
  return publicationStatusLabels[status];
}

export function CianPublicationDiagnostics({
  preview,
  diagnostics,
}: {
  preview: CianListingPreviewResult;
  diagnostics: CianPublicationDiagnosticsView;
}) {
  const errors = preview.ready ? [] : preview.errors;
  const warnings = preview.ready ? preview.cian.warnings : preview.warnings;
  const publication = diagnostics.publication;

  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        ЦИАН — публикация
      </h2>
      <p className="text-sm font-medium">
        {preview.ready ? "READY FOR CIAN XML" : "NOT READY FOR CIAN XML"}
      </p>
      <p className="text-xs text-zinc-500">
        Один аккаунт ЦИАН → один фид → несколько объявлений. «Опубликовано» только после
        подтверждения площадки (сейчас sync заблокирован).
      </p>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Статус Publication</dt>
          <dd>{statusLabel(diagnostics)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">В фиде</dt>
          <dd>{diagnostics.includedInFeed ? "Да" : "Нет"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Базовые данные</dt>
          <dd>{preview.baseline.ready ? "Готовы" : "Не готовы"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">CIAN readiness</dt>
          <dd>{preview.cian.valid ? "Ок" : "Ошибки"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Payload изменился</dt>
          <dd>{diagnostics.payloadChanged ? "Да" : "Нет"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Последняя синхронизация</dt>
          <dd>
            {publication?.lastSyncAt ? formatDateTime(publication.lastSyncAt) : "—"}
            {publication?.externalStatus ? ` (${publication.externalStatus})` : ""}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">Последняя ошибка</dt>
          <dd className={publication?.lastError ? "text-red-700" : undefined}>
            {publication?.lastError || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Status sync</dt>
          <dd className="font-mono text-xs">{diagnostics.statusSync}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Unpublish</dt>
          <dd className="font-mono text-xs">{diagnostics.unpublish}</dd>
        </div>
      </dl>

      <IssueList title="Ошибки" items={errors} />
      <IssueList title="Предупреждения" items={warnings} />

      <CianPrepareAction listingId={preview.listingId} canPrepare={diagnostics.canPrepare} />
      <CianXmlPreviewActions listingId={preview.listingId} ready={preview.ready} />
    </section>
  );
}
