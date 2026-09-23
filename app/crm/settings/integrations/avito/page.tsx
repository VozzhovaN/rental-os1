import { AvitoSettings } from "@/components/integrations/avito-settings";
import { PageHeader } from "@/components/crm/page-header";
import { getAvitoChannelListings } from "@/lib/channel-listings";
import { getAvitoPublicStatus } from "@/lib/integrations/avito-service";
import { isAvitoConfigured } from "@/lib/integrations/env";

export const dynamic = "force-dynamic";

export default async function AvitoSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const params = await searchParams;
  const [status, listings] = await Promise.all([
    getAvitoPublicStatus(),
    getAvitoChannelListings(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Авито"
        subtitle="Подключение аккаунта, привязка объявлений, импорт броней и синхронизация занятости"
      />
      <AvitoSettings
        initialStatus={{ ...status, configured: isAvitoConfigured() }}
        initialError={params.error}
        connected={params.connected === "1"}
        boundListings={listings.map((listing) => ({
          id: listing.id,
          propertyId: listing.propertyId,
          propertyName: listing.property.name,
          externalId: listing.externalId,
          status: listing.status,
          syncStatus: listing.syncStatus,
          lastSyncAt: listing.lastSyncAt?.toISOString() ?? null,
          syncError: listing.syncError,
        }))}
      />
    </div>
  );
}
