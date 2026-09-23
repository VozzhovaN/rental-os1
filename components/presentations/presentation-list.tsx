"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconPlus } from "@/components/crm/icons";
import {
  presentationKindLabels,
  presentationStatusLabels,
} from "@/lib/presentation-labels";
import { formatDateTime } from "@/lib/format";

export type PresentationListRow = {
  id: string;
  publicToken: string;
  kind: keyof typeof presentationKindLabels;
  status: keyof typeof presentationStatusLabels;
  title: string;
  itemCount: number;
  properties: Array<{ id: string; name: string; city: string }>;
  createdAt: string;
  publishedAt: string | null;
};

const statusClass = {
  DRAFT: "bg-[#F1F5F9] text-[#64748B]",
  READY: "bg-[var(--finance-blue-light)] text-[var(--finance-blue)]",
  PUBLISHED: "bg-[var(--finance-green-light)] text-[var(--finance-green)]",
  ARCHIVED: "bg-[#FFF7ED] text-[#C2410C]",
} as const;

export function PresentationList({
  presentations,
}: {
  presentations: PresentationListRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function archive(id: string) {
    if (!window.confirm("Архивировать презентацию? Публичная ссылка перестанет работать.")) {
      return;
    }
    setError(null);
    const response = await fetch(`/api/presentations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error || "Не удалось архивировать");
      return;
    }
    router.refresh();
  }

  if (presentations.length === 0) {
    return (
      <div className="finance-card px-6 py-14 text-center">
        <h2 className="text-lg font-semibold text-[var(--finance-text)]">
          Нет презентаций
        </h2>
        <p className="mt-1 text-sm text-[var(--finance-text-secondary)]">
          Создайте предложение для клиента из карточки объекта или здесь.
        </p>
        <Link
          href="/crm/presentations/new"
          className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--finance-blue)] px-4 py-2.5 text-sm font-medium text-white"
        >
          <IconPlus size={16} />
          Создать
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-xl bg-[var(--finance-red-light)] px-4 py-3 text-sm text-[var(--finance-red)]">
          {error}
        </p>
      ) : null}
      <div className="finance-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--finance-border)] text-[11px] uppercase tracking-wide text-[#94A3B8]">
              <tr>
                <th className="px-3 py-2.5 font-medium">Название</th>
                <th className="px-3 py-2.5 font-medium">Тип</th>
                <th className="px-3 py-2.5 font-medium">Объекты</th>
                <th className="px-3 py-2.5 font-medium">Статус</th>
                <th className="px-3 py-2.5 font-medium">Дата</th>
                <th className="px-3 py-2.5 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {presentations.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[var(--finance-border)] last:border-0 hover:bg-[var(--finance-hover)]"
                >
                  <td className="px-3 py-2.5 font-medium">
                    <Link
                      href={`/crm/presentations/${row.id}`}
                      className="hover:text-[var(--finance-blue)]"
                    >
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    {presentationKindLabels[row.kind]}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--finance-text-secondary)]">
                    {row.itemCount}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${statusClass[row.status]}`}
                    >
                      {presentationStatusLabels[row.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--finance-text-muted)]">
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/crm/presentations/${row.id}`}
                        className="rounded-lg border border-[var(--finance-border)] px-2 py-1 text-xs font-medium"
                      >
                        Редактор
                      </Link>
                      {row.status === "READY" || row.status === "PUBLISHED" ? (
                        <>
                          <a
                            href={`/p/${row.publicToken}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-[var(--finance-border)] px-2 py-1 text-xs font-medium"
                          >
                            Открыть
                          </a>
                          <a
                            href={`/api/p/${row.publicToken}/pdf`}
                            className="rounded-lg border border-[var(--finance-border)] px-2 py-1 text-xs font-medium"
                          >
                            PDF
                          </a>
                        </>
                      ) : (
                        <a
                          href={`/api/presentations/${row.id}/pdf`}
                          className="rounded-lg border border-[var(--finance-border)] px-2 py-1 text-xs font-medium"
                        >
                          PDF
                        </a>
                      )}
                      {row.status !== "ARCHIVED" ? (
                        <button
                          type="button"
                          onClick={() => void archive(row.id)}
                          className="rounded-lg border border-[var(--finance-border)] px-2 py-1 text-xs font-medium text-[var(--finance-text-secondary)]"
                        >
                          Архив
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
