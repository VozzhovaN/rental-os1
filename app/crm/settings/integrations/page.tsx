import Link from "next/link";

export const dynamic = "force-dynamic";

export default function IntegrationsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Интеграции</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Реальная синхронизация на этом этапе реализована только для Авито.
        </p>
      </div>
      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="font-medium">Авито</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Подключение аккаунта, объявления, импорт броней и выгрузка занятости.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/crm/settings/integrations/avito"
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
          >
            Открыть Авито
          </Link>
          <Link
            href="/crm/settings/integrations/logs"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium"
          >
            Журнал
          </Link>
        </div>
      </section>
    </div>
  );
}
