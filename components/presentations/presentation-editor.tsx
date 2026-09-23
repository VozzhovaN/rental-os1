"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  presentationKindLabels,
  presentationSectionTypeLabels,
  presentationStatusLabels,
} from "@/lib/presentation-labels";
import { PRESENTATION_SECTION_TYPES } from "@/lib/presentations";
import type { PresentationSectionType } from "@prisma/client";

type EditorItem = {
  id: string;
  propertyId: string;
  propertyName: string;
  city: string;
  district: string;
  address: string;
  area: number;
  rooms: number;
  bedrooms: number;
  bathrooms: number;
  guests: number;
  floor: number | null;
  totalFloors: number | null;
  sortOrder: number;
  titleOverride: string | null;
  priceOverride: number | null;
  descriptionOverride: string | null;
  coverPhotoId: string | null;
  videoUrl: string | null;
  resolvedPrice: { amount: number | null; unit: string };
  poolPhotos: Array<{ id: string; url: string; isCover: boolean }>;
  selectedPhotoIds: string[];
  sections: Array<{
    id: string;
    type: PresentationSectionType;
    title: string;
    content: string;
    sortOrder: number;
    isVisible: boolean;
  }>;
};

export type EditorPresentation = {
  id: string;
  publicToken: string;
  kind: keyof typeof presentationKindLabels;
  status: keyof typeof presentationStatusLabels;
  title: string;
  subtitle: string | null;
  companyName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  internalNote: string | null;
  items: EditorItem[];
};

const inputClass =
  "w-full rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--finance-blue)]";

export function PresentationEditor({
  initial,
}: {
  initial: EditorPresentation;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [activeItemId, setActiveItemId] = useState(initial.items[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const activeItem = useMemo(
    () => data.items.find((item) => item.id === activeItemId) ?? data.items[0],
    [data.items, activeItemId],
  );

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/p/${data.publicToken}`
      : `/p/${data.publicToken}`;

  function patchItem(itemId: string, patch: Partial<EditorItem>) {
    setData((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item,
      ),
    }));
  }

  async function save(status?: EditorPresentation["status"]) {
    setError(null);
    setSuccess(null);
    setPending(true);
    try {
      const response = await fetch(`/api/presentations/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          subtitle: data.subtitle,
          companyName: data.companyName,
          contactName: data.contactName,
          contactPhone: data.contactPhone,
          contactEmail: data.contactEmail,
          internalNote: data.internalNote,
          status,
          items: data.items.map((item) => ({
            id: item.id,
            titleOverride: item.titleOverride,
            priceOverride: item.priceOverride,
            descriptionOverride: item.descriptionOverride,
            coverPhotoId: item.coverPhotoId,
            videoUrl: item.videoUrl,
            sortOrder: item.sortOrder,
            photoIds: item.selectedPhotoIds,
            sections: item.sections.map((section, index) => ({
              type: section.type,
              title: section.title,
              content: section.content,
              sortOrder: index,
              isVisible: section.isVisible,
            })),
          })),
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        details?: string[];
        presentation?: EditorPresentation;
      };
      if (!response.ok || !payload.presentation) {
        throw new Error(
          payload.details?.join(". ") ||
            payload.error ||
            "Не удалось сохранить",
        );
      }
      setData(payload.presentation);
      setSuccess(
        status === "PUBLISHED" || status === "READY"
          ? "Презентация опубликована"
          : "Черновик сохранён",
      );
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Не удалось сохранить",
      );
    } finally {
      setPending(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setSuccess("Ссылка скопирована");
    } catch {
      setError("Не удалось скопировать ссылку");
    }
  }

  const isPublic =
    data.status === "READY" || data.status === "PUBLISHED";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/crm/presentations"
            className="text-sm text-[var(--finance-text-secondary)]"
          >
            ← К списку
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--finance-text)]">
            {data.title || "Презентация"}
          </h1>
          <p className="mt-1 text-sm text-[var(--finance-text-secondary)]">
            {presentationKindLabels[data.kind]} ·{" "}
            {presentationStatusLabels[data.status]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => void save()}
            className="rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Сохранить черновик
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => void save("PUBLISHED")}
            className="rounded-xl bg-[var(--finance-blue)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Опубликовать
          </button>
          <a
            href={`/api/presentations/${data.id}/pdf`}
            className="rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm font-medium"
          >
            Скачать PDF
          </a>
          {isPublic ? (
            <>
              <a
                href={`/p/${data.publicToken}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm font-medium"
              >
                Открыть
              </a>
              <button
                type="button"
                onClick={() => void copyLink()}
                className="rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm font-medium"
              >
                Копировать ссылку
              </button>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-xl bg-[var(--finance-red-light)] px-4 py-3 text-sm text-[var(--finance-red)]">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-xl bg-[var(--finance-green-light)] px-4 py-3 text-sm text-[var(--finance-green)]">
          {success}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="finance-card space-y-3 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--finance-text-muted)]">
              Общие настройки
            </h2>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Название</span>
              <input
                className={inputClass}
                value={data.title}
                onChange={(e) =>
                  setData((c) => ({ ...c, title: e.target.value }))
                }
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Subtitle</span>
              <input
                className={inputClass}
                value={data.subtitle ?? ""}
                onChange={(e) =>
                  setData((c) => ({ ...c, subtitle: e.target.value }))
                }
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Компания</span>
                <input
                  className={inputClass}
                  value={data.companyName ?? ""}
                  onChange={(e) =>
                    setData((c) => ({ ...c, companyName: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Контакт</span>
                <input
                  className={inputClass}
                  value={data.contactName ?? ""}
                  onChange={(e) =>
                    setData((c) => ({ ...c, contactName: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Телефон</span>
                <input
                  className={inputClass}
                  value={data.contactPhone ?? ""}
                  onChange={(e) =>
                    setData((c) => ({ ...c, contactPhone: e.target.value }))
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Email</span>
                <input
                  className={inputClass}
                  value={data.contactEmail ?? ""}
                  onChange={(e) =>
                    setData((c) => ({ ...c, contactEmail: e.target.value }))
                  }
                />
              </label>
            </div>
          </section>

          {data.items.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto">
              {data.items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveItemId(item.id)}
                  className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-medium ${
                    activeItem?.id === item.id
                      ? "bg-[var(--finance-blue-light)] text-[var(--finance-blue)]"
                      : "border border-[var(--finance-border)]"
                  }`}
                >
                  Вариант {index + 1}
                </button>
              ))}
            </div>
          ) : null}

          {activeItem ? (
            <>
              <section className="finance-card space-y-3 p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--finance-text-muted)]">
                  Объект · {activeItem.propertyName}
                </h2>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Заголовок</span>
                  <input
                    className={inputClass}
                    value={activeItem.titleOverride ?? ""}
                    placeholder={activeItem.propertyName}
                    onChange={(e) =>
                      patchItem(activeItem.id, {
                        titleOverride: e.target.value || null,
                      })
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">
                    Цена (override, ₽)
                  </span>
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={activeItem.priceOverride ?? ""}
                    placeholder="Из объекта, если пусто"
                    onChange={(e) =>
                      patchItem(activeItem.id, {
                        priceOverride: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Описание</span>
                  <textarea
                    rows={4}
                    className={inputClass}
                    value={activeItem.descriptionOverride ?? ""}
                    onChange={(e) =>
                      patchItem(activeItem.id, {
                        descriptionOverride: e.target.value || null,
                      })
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">
                    Видео URL (https, опционально)
                  </span>
                  <input
                    className={inputClass}
                    value={activeItem.videoUrl ?? ""}
                    placeholder="PROPERTY_VIDEO_STORAGE_GAP"
                    onChange={(e) =>
                      patchItem(activeItem.id, {
                        videoUrl: e.target.value || null,
                      })
                    }
                  />
                </label>
              </section>

              <section className="finance-card space-y-3 p-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--finance-text-muted)]">
                  Фотографии (до 10)
                </h2>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {activeItem.poolPhotos.map((photo) => {
                    const selected = activeItem.selectedPhotoIds.includes(
                      photo.id,
                    );
                    const isCover = activeItem.coverPhotoId === photo.id;
                    return (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => {
                          const next = selected
                            ? activeItem.selectedPhotoIds.filter(
                                (id) => id !== photo.id,
                              )
                            : activeItem.selectedPhotoIds.length >= 10
                              ? activeItem.selectedPhotoIds
                              : [...activeItem.selectedPhotoIds, photo.id];
                          patchItem(activeItem.id, {
                            selectedPhotoIds: next,
                            coverPhotoId:
                              isCover && !next.includes(photo.id)
                                ? next[0] ?? null
                                : activeItem.coverPhotoId &&
                                    next.includes(activeItem.coverPhotoId)
                                  ? activeItem.coverPhotoId
                                  : next[0] ?? null,
                          });
                        }}
                        onDoubleClick={() =>
                          patchItem(activeItem.id, { coverPhotoId: photo.id })
                        }
                        className={`relative overflow-hidden rounded-lg border-2 ${
                          selected
                            ? "border-[var(--finance-blue)]"
                            : "border-transparent opacity-60"
                        }`}
                        title="Клик — выбрать, двойной клик — обложка"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
                          alt=""
                          className="aspect-[4/3] w-full object-cover"
                        />
                        {isCover ? (
                          <span className="absolute left-1 top-1 rounded bg-[var(--finance-blue)] px-1.5 py-0.5 text-[10px] text-white">
                            Cover
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="finance-card space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--finance-text-muted)]">
                    Содержание
                  </h2>
                  <button
                    type="button"
                    className="text-xs font-medium text-[var(--finance-blue)]"
                    onClick={() =>
                      patchItem(activeItem.id, {
                        sections: [
                          ...activeItem.sections,
                          {
                            id: `tmp-${Date.now()}`,
                            type: "CUSTOM",
                            title: "Новый раздел",
                            content: "",
                            sortOrder: activeItem.sections.length,
                            isVisible: true,
                          },
                        ],
                      })
                    }
                  >
                    + Добавить раздел
                  </button>
                </div>
                <div className="space-y-3">
                  {activeItem.sections.map((section, index) => (
                    <div
                      key={section.id}
                      className="rounded-xl border border-[var(--finance-border)] p-3"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={section.isVisible}
                            onChange={(e) => {
                              const sections = [...activeItem.sections];
                              sections[index] = {
                                ...section,
                                isVisible: e.target.checked,
                              };
                              patchItem(activeItem.id, { sections });
                            }}
                          />
                          Показать
                        </label>
                        <select
                          className="rounded-lg border border-[var(--finance-border)] px-2 py-1 text-xs"
                          value={section.type}
                          onChange={(e) => {
                            const type = e.target
                              .value as PresentationSectionType;
                            const sections = [...activeItem.sections];
                            sections[index] = {
                              ...section,
                              type,
                              title:
                                type === "CUSTOM"
                                  ? section.title
                                  : presentationSectionTypeLabels[type],
                            };
                            patchItem(activeItem.id, { sections });
                          }}
                        >
                          {PRESENTATION_SECTION_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {presentationSectionTypeLabels[type]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="ml-auto text-xs text-[var(--finance-red)]"
                          onClick={() =>
                            patchItem(activeItem.id, {
                              sections: activeItem.sections.filter(
                                (_, i) => i !== index,
                              ),
                            })
                          }
                        >
                          Удалить
                        </button>
                      </div>
                      <input
                        className={`${inputClass} mb-2`}
                        value={section.title}
                        onChange={(e) => {
                          const sections = [...activeItem.sections];
                          sections[index] = {
                            ...section,
                            title: e.target.value,
                          };
                          patchItem(activeItem.id, { sections });
                        }}
                      />
                      <textarea
                        rows={3}
                        className={inputClass}
                        value={section.content}
                        placeholder={
                          section.type === "ADVANTAGES"
                            ? "По одной строке: ✓ Вид на море"
                            : undefined
                        }
                        onChange={(e) => {
                          const sections = [...activeItem.sections];
                          sections[index] = {
                            ...section,
                            content: e.target.value,
                          };
                          patchItem(activeItem.id, { sections });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </div>

        <aside className="finance-card sticky top-16 h-fit space-y-3 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--finance-text-muted)]">
            Предпросмотр
          </h2>
          <p className="text-sm text-[var(--finance-text-secondary)]">
            После публикации откройте публичную ссылку для полного web-view и
            PDF.
          </p>
          {activeItem ? (
            <div className="space-y-2 rounded-xl bg-[var(--finance-hover)] p-3">
              <p className="font-semibold">
                {activeItem.titleOverride || activeItem.propertyName}
              </p>
              <p className="text-sm text-[var(--finance-blue)]">
                {activeItem.priceOverride != null
                  ? `${activeItem.priceOverride.toLocaleString("ru-RU")} ₽`
                  : activeItem.resolvedPrice.amount != null
                    ? `${activeItem.resolvedPrice.amount.toLocaleString("ru-RU")} ₽`
                    : "Цена не указана"}
              </p>
              <p className="text-xs text-[var(--finance-text-muted)]">
                {activeItem.city} · {activeItem.address}
              </p>
              <p className="text-xs text-[var(--finance-text-muted)]">
                Фото: {activeItem.selectedPhotoIds.length} · Разделов:{" "}
                {activeItem.sections.filter((s) => s.isVisible).length}
              </p>
            </div>
          ) : null}
          <p className="text-[11px] text-[var(--finance-text-muted)]">
            PROPERTY_COORDINATES_GAP: карта без lat/lng не встраивается.
          </p>
        </aside>
      </div>
    </div>
  );
}
