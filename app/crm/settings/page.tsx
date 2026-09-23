import Link from "next/link";
import { PageHeader } from "@/components/crm/page-header";

export const dynamic = "force-dynamic";

const CARDS = [
  {
    href: "/crm/settings/integrations",
    title: "Интеграции",
    description: "Подключение внешних площадок: Авито, ЦИАН, Домклик",
  },
  {
    href: "/crm/settings/integrations",
    title: "Публикации",
    description: "XML-фиды и статусы подготовки объявлений на площадках",
    note: "Управление публикациями — в карточках долгосрочной аренды и продаж",
  },
] as const;

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Настройки"
        subtitle="Управление Rental OS и внешними сервисами"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="finance-card block p-5 transition-colors hover:border-[var(--finance-blue)]/40"
          >
            <h2 className="text-base font-semibold text-[var(--finance-text)]">{card.title}</h2>
            <p className="mt-1 text-sm text-[var(--finance-text-secondary)]">{card.description}</p>
            {"note" in card && card.note ? (
              <p className="mt-3 text-xs text-[var(--finance-text-muted)]">{card.note}</p>
            ) : null}
          </Link>
        ))}

        <div className="finance-card p-5">
          <h2 className="text-base font-semibold text-[var(--finance-text)]">Каналы продаж</h2>
          <p className="mt-1 text-sm text-[var(--finance-text-secondary)]">
            Источники бронирований (по рекомендации, сайт и др.) настраиваются в карточке
            объекта. Это не технические интеграции — кнопка «Подключить» для них не нужна.
          </p>
          <Link
            href="/crm/properties"
            className="mt-3 inline-flex text-sm font-medium text-[var(--finance-blue)] hover:underline"
          >
            Перейти к объектам
          </Link>
        </div>
      </div>
    </div>
  );
}
