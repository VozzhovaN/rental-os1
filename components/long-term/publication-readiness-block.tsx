import type { PublicationReadinessResult } from "@/lib/publications/readiness";

export function PublicationReadinessBlock({ readiness }: { readiness: PublicationReadinessResult }) {
  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Готовность к публикации</h2>
      <p className="text-sm font-medium">{readiness.ready ? "Готово к публикации" : "Требуется заполнить"}</p>
      <p className="text-xs text-zinc-500">
        Проверяется полнота внутренних данных. Это не готовность конкретной площадки.
      </p>
      {readiness.errors.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-800">
          {readiness.errors.map((item) => (
            <li key={`${item.code}:${item.field}`}>{item.message}</li>
          ))}
        </ul>
      ) : null}
      {readiness.warnings.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-zinc-500">Предупреждения</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
            {readiness.warnings.map((item) => (
              <li key={`${item.code}:${item.field}`}>{item.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
