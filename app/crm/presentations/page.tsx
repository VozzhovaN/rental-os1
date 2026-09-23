import Link from "next/link";
import { IconPlus } from "@/components/crm/icons";
import { PresentationList } from "@/components/presentations/presentation-list";
import { getPresentations } from "@/lib/presentations";
import { serializePresentationListItem } from "@/lib/presentation-public";

export const dynamic = "force-dynamic";

export default async function PresentationsPage() {
  const presentations = (await getPresentations()).map(
    serializePresentationListItem,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--finance-text)]">
            Презентации
          </h1>
          <p className="mt-1 text-sm text-[var(--finance-text-secondary)]">
            Клиентские предложения и подборки объектов
          </p>
        </div>
        <Link
          href="/crm/presentations/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--finance-blue)] px-4 py-2.5 text-sm font-medium text-white"
        >
          <IconPlus size={16} />
          Создать
        </Link>
      </div>
      <PresentationList presentations={presentations} />
    </div>
  );
}
