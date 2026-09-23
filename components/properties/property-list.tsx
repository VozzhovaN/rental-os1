"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PropertyDTO } from "@/lib/properties";
import {
  formatArea,
  formatMoney,
  managementTypeLabels,
  propertyStatusLabels,
  propertyTypeLabels,
} from "@/lib/property-labels";

function StatusBadge({ status }: { status: PropertyDTO["status"] }) {
  const styles = {
    ACTIVE: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
    INACTIVE: "bg-zinc-100 text-zinc-700 ring-zinc-500/20",
    ARCHIVED: "bg-amber-50 text-amber-800 ring-amber-600/20",
  } as const;

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status]}`}
    >
      {propertyStatusLabels[status]}
    </span>
  );
}

export function PropertyList({ properties }: { properties: PropertyDTO[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(property: PropertyDTO) {
    const confirmed = window.confirm(
      `Удалить объект «${property.name}»? Это действие нельзя отменить.`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setPendingId(property.id);

    try {
      const response = await fetch(`/api/properties/${property.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Не удалось удалить объект");
      }

      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось удалить объект",
      );
    } finally {
      setPendingId(null);
    }
  }

  if (properties.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center">
        <p className="text-zinc-700">Объектов пока нет.</p>
        <Link
          href="/crm/properties/new"
          className="mt-4 inline-flex rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Добавить первый объект
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="hidden overflow-hidden rounded-xl border border-zinc-200 bg-white md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Фото</th>
              <th className="px-4 py-3 font-medium">Название</th>
              <th className="px-4 py-3 font-medium">Тип</th>
              <th className="px-4 py-3 font-medium">Город / район</th>
              <th className="px-4 py-3 font-medium">Площадь</th>
              <th className="px-4 py-3 font-medium">Комн. / спальни</th>
              <th className="px-4 py-3 font-medium">Гости</th>
              <th className="px-4 py-3 font-medium">Посуточно</th>
              <th className="px-4 py-3 font-medium">Помесячно</th>
              <th className="px-4 py-3 font-medium">Управление</th>
              <th className="px-4 py-3 font-medium">Статус</th>
              <th className="px-4 py-3 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {properties.map((property) => (
              <tr key={property.id} className="text-zinc-800">
                <td className="px-4 py-3">
                  {property.coverPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={property.coverPhotoUrl}
                      alt=""
                      className="h-12 w-16 rounded object-cover bg-zinc-100"
                    />
                  ) : (
                    <div
                      className="flex h-12 w-16 items-center justify-center rounded bg-zinc-100 text-[10px] text-zinc-400"
                      aria-hidden
                    >
                      Нет фото
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 font-medium">{property.name}</td>
                <td className="px-4 py-3">{propertyTypeLabels[property.type]}</td>
                <td className="px-4 py-3">
                  {property.city}, {property.district}
                </td>
                <td className="px-4 py-3">{formatArea(property.area)}</td>
                <td className="px-4 py-3">
                  {property.rooms} / {property.bedrooms}
                </td>
                <td className="px-4 py-3">{property.guests}</td>
                <td className="px-4 py-3">{formatMoney(property.dailyPrice)}</td>
                <td className="px-4 py-3">{formatMoney(property.monthlyPrice)}</td>
                <td className="px-4 py-3">
                  {managementTypeLabels[property.managementType]}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={property.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link
                      href={`/crm/properties/${property.id}/edit`}
                      className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      Редактировать
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(property)}
                      disabled={pendingId === property.id}
                      className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      {pendingId === property.id ? "Удаление..." : "Удалить"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {properties.map((property) => (
          <article
            key={property.id}
            className="rounded-xl border border-zinc-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {property.coverPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={property.coverPhotoUrl}
                    alt=""
                    className="h-14 w-20 shrink-0 rounded object-cover bg-zinc-100"
                  />
                ) : (
                  <div className="flex h-14 w-16 shrink-0 items-center justify-center rounded bg-zinc-100 text-[10px] text-zinc-400">
                    Нет фото
                  </div>
                )}
                <div>
                  <h2 className="font-medium text-zinc-900">{property.name}</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {propertyTypeLabels[property.type]} · {property.city},{" "}
                    {property.district}
                  </p>
                </div>
              </div>
              <StatusBadge status={property.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-zinc-700">
              <div>
                <dt className="text-xs text-zinc-500">Площадь</dt>
                <dd>{formatArea(property.area)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Комн. / спальни</dt>
                <dd>
                  {property.rooms} / {property.bedrooms}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Гости</dt>
                <dd>{property.guests}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Управление</dt>
                <dd>{managementTypeLabels[property.managementType]}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Посуточно</dt>
                <dd>{formatMoney(property.dailyPrice)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Помесячно</dt>
                <dd>{formatMoney(property.monthlyPrice)}</dd>
              </div>
            </dl>
            <div className="mt-4 flex gap-2">
              <Link
                href={`/crm/properties/${property.id}/edit`}
                className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-center text-sm font-medium text-zinc-700"
              >
                Редактировать
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(property)}
                disabled={pendingId === property.id}
                className="flex-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
              >
                {pendingId === property.id ? "Удаление..." : "Удалить"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
