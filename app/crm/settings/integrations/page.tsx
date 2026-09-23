import Link from "next/link";
import { IntegrationCard } from "@/components/integrations/integration-card";
import { PageHeader } from "@/components/crm/page-header";
import { formatDateTime } from "@/lib/format";
import { getAvitoPublicStatus } from "@/lib/integrations/avito-service";
import { isAvitoConfigured } from "@/lib/integrations/env";
import { integrationStatusLabels } from "@/lib/integrations/labels";
import { integrationStatusTone } from "@/lib/integrations/status-tone";
import { providerCapabilityLabels } from "@/lib/provider-capability-labels";
import { CIAN_SALE_CAPABILITIES } from "@/lib/publications/providers/cian/sale/lifecycle";
import { DOMCLICK_SALE_CAPABILITIES } from "@/lib/publications/providers/domclick/sale/capabilities";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const avito = await getAvitoPublicStatus();
  const avitoConfigured = isAvitoConfigured();
  const avitoStatus = avito?.status ?? "DISCONNECTED";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Интеграции"
        subtitle="Подключение Rental OS к внешним площадкам"
        actions={
          <Link
            href="/crm/settings/integrations/logs"
            className="inline-flex items-center justify-center rounded-xl border border-[var(--finance-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--finance-text)] hover:bg-[var(--finance-hover)]"
          >
            Журнал синхронизации
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <IntegrationCard
          title="Авито"
          purpose="Бронирования и календарь занятости"
          statusLabel={
            !avitoConfigured && avitoStatus === "DISCONNECTED"
              ? "Не настроено"
              : integrationStatusLabels[avitoStatus]
          }
          statusTone={
            !avitoConfigured && avitoStatus === "DISCONNECTED"
              ? "neutral"
              : integrationStatusTone(avitoStatus)
          }
          capabilities={[
            "Привязка существующего объявления",
            "Импорт бронирований",
            "Синхронизация занятости",
          ]}
          lastSuccess={
            avito?.lastSuccessAt ? formatDateTime(avito.lastSuccessAt) : null
          }
          actionHref="/crm/settings/integrations/avito"
          actionLabel="Настроить"
          note="Создание объявления из CRM текущей интеграцией не поддерживается."
        />

        <IntegrationCard
          title="ЦИАН"
          purpose="XML-фиды долгосрочной аренды и продаж"
          statusLabel="XML-фид готов"
          statusTone="success"
          capabilities={[
            `Долгосрочная аренда: ${providerCapabilityLabels.READY}`,
            `Продажи: ${providerCapabilityLabels.READY}`,
            `Статус с площадки: ${providerCapabilityLabels[CIAN_SALE_CAPABILITIES.statusSync]}`,
            `Снятие с публикации: ${providerCapabilityLabels[CIAN_SALE_CAPABILITIES.unpublish]}`,
          ]}
          actionHref="/crm/settings/integrations#cian"
          actionLabel="Подробнее"
          secondaryHref="/api/feeds/cian/long-term.xml"
          secondaryLabel="Открыть фид"
          note="Автоматическое получение статуса требует доступа провайдера. Синхронизация статуса в CRM недоступна."
        />

        <IntegrationCard
          title="Домклик"
          purpose="Публикация объектов продажи"
          statusLabel="Ожидает подтверждения"
          statusTone="warning"
          capabilities={[
            `Публикация: ${providerCapabilityLabels[DOMCLICK_SALE_CAPABILITIES.feed]}`,
            `Предпросмотр: ${providerCapabilityLabels[DOMCLICK_SALE_CAPABILITIES.preview]}`,
          ]}
          actionHref="/crm/settings/integrations#domclick"
          actionLabel="Подробнее"
          note="Интеграция подготовлена архитектурно. Публикация ожидается после подтверждения схемы партнёра."
        />
      </div>

      <section id="cian" className="finance-card scroll-mt-24 space-y-4 p-5">
        <h2 className="text-base font-semibold text-[var(--finance-text)]">ЦИАН — детали</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--finance-text-muted)]">Долгосрочная аренда</dt>
            <dd className="font-medium text-[var(--finance-text)]">XML-фид реализован</dd>
          </div>
          <div>
            <dt className="text-[var(--finance-text-muted)]">Продажи</dt>
            <dd className="font-medium text-[var(--finance-text)]">XML-фид реализован</dd>
          </div>
          <div>
            <dt className="text-[var(--finance-text-muted)]">Получение статуса</dt>
            <dd className="text-[var(--finance-text)]">
              {providerCapabilityLabels.BLOCKED_BY_PROVIDER_ACCESS}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--finance-text-muted)]">Снятие с публикации</dt>
            <dd className="text-[var(--finance-text)]">
              {providerCapabilityLabels.BLOCKED_BY_PROVIDER_CONFIRMATION}
            </dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/feeds/cian/long-term.xml"
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-xl border border-[var(--finance-border)] px-3 py-2 text-sm font-medium hover:bg-[var(--finance-hover)]"
          >
            Фид долгосрочной аренды
          </a>
          <a
            href="/api/feeds/cian/sale.xml"
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-xl border border-[var(--finance-border)] px-3 py-2 text-sm font-medium hover:bg-[var(--finance-hover)]"
          >
            Фид продаж
          </a>
        </div>
        <p className="text-xs text-[var(--finance-text-muted)]">
          Подготовка объявления к фиду выполняется в карточке долгосрочной аренды или продажи.
          Действие «Синхронизировать статус» недоступно.
        </p>
      </section>

      <section id="domclick" className="finance-card scroll-mt-24 space-y-3 p-5">
        <h2 className="text-base font-semibold text-[var(--finance-text)]">Домклик — детали</h2>
        <p className="text-sm text-[var(--finance-text-secondary)]">
          Интеграция подготовлена архитектурно. Публикация: ожидается подтверждение схемы
          партнёра. Serializer и публичный фид не реализованы — статус «Подключено» не
          отображается.
        </p>
        <ul className="space-y-1 text-sm text-[var(--finance-text)]">
          <li>
            Фид: {providerCapabilityLabels[DOMCLICK_SALE_CAPABILITIES.feed]}
          </li>
          <li>
            Статус: {providerCapabilityLabels[DOMCLICK_SALE_CAPABILITIES.statusSync]}
          </li>
          <li>
            Снятие: {providerCapabilityLabels[DOMCLICK_SALE_CAPABILITIES.unpublish]}
          </li>
        </ul>
      </section>
    </div>
  );
}
