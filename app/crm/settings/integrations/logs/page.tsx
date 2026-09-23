import { IntegrationLogs } from "@/components/integrations/integration-logs";
import { PageHeader } from "@/components/crm/page-header";

export const dynamic = "force-dynamic";

export default function IntegrationLogsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Журнал синхронизации"
        subtitle="История импорта и экспорта без секретов доступа"
      />
      <IntegrationLogs />
    </div>
  );
}
