import { AvitoSettings } from "@/components/integrations/avito-settings";

export const dynamic = "force-dynamic";

export default async function AvitoSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Авито</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Подключение аккаунта и синхронизация существующих объявлений. Создание
          объявлений на Авито на этом этапе не выполняется.
        </p>
      </div>
      <AvitoSettings
        initialError={params.error}
        connected={params.connected === "1"}
      />
    </div>
  );
}
