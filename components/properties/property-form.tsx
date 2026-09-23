"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { PropertyDTO } from "@/lib/properties";
import {
  managementTypeLabels,
  propertyStatusLabels,
  propertyTypeLabels,
} from "@/lib/property-labels";
import {
  MANAGEMENT_TYPES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  RENT_COLLECTION_MODES,
} from "@/lib/validations/property";

type OwnerOption = { id: string; name: string; isActive: boolean };

type PropertyFormProps = {
  property?: PropertyDTO;
  owners?: OwnerOption[];
};

function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1.5 block text-sm font-medium text-[var(--finance-text)]">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="mt-1 block text-xs font-normal text-[var(--finance-text-muted)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="finance-card space-y-4 p-4 sm:p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--finance-text-muted)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

const inputClassName =
  "w-full rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm text-[var(--finance-text)] outline-none focus:border-[var(--finance-blue)] focus:ring-2 focus:ring-[var(--finance-blue)]/15";

function readNumber(form: FormData, key: string) {
  const value = String(form.get(key) ?? "").trim();
  if (!value) {
    return null;
  }

  return Number(value);
}

function requiredNumber(form: FormData, key: string) {
  return Number(String(form.get(key) ?? "").trim());
}

export function PropertyForm({ property, owners = [] }: PropertyFormProps) {
  const router = useRouter();
  const isEdit = Boolean(property);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [managementType, setManagementType] = useState(
    property?.managementType ?? "COMMISSION",
  );
  const [rentCollectionMode, setRentCollectionMode] = useState(
    property?.rentCollectionMode ?? "OPERATOR",
  );
  const [ownerId, setOwnerId] = useState(property?.ownerId ?? "");

  const activeOwners = owners.filter((o) => o.isActive);
  const isOwn = managementType === "OWN";

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const slugValue = String(form.get("slug") ?? "").trim();

    const payload = {
      name: String(form.get("name") ?? "").trim(),
      slug: slugValue || undefined,
      type: String(form.get("type") ?? ""),
      status: String(form.get("status") ?? ""),
      address: String(form.get("address") ?? "").trim(),
      city: String(form.get("city") ?? "").trim(),
      district: String(form.get("district") ?? "").trim(),
      area: requiredNumber(form, "area"),
      rooms: requiredNumber(form, "rooms"),
      bedrooms: requiredNumber(form, "bedrooms"),
      bathrooms: requiredNumber(form, "bathrooms"),
      floor: readNumber(form, "floor"),
      totalFloors: readNumber(form, "totalFloors"),
      guests: requiredNumber(form, "guests"),
      description: String(form.get("description") ?? "").trim(),
      shortDescription: String(form.get("shortDescription") ?? "").trim(),
      ownerName: String(form.get("ownerName") ?? "").trim(),
      ownerPhone: String(form.get("ownerPhone") ?? "").trim(),
      managementType,
      rentCollectionMode: isOwn ? "OPERATOR" : rentCollectionMode,
      ownerId: isOwn ? null : ownerId || null,
      dailyPrice: readNumber(form, "dailyPrice"),
      monthlyPrice: readNumber(form, "monthlyPrice"),
      commissionDaily: isOwn ? null : readNumber(form, "commissionDaily"),
      commissionMonthly: isOwn ? null : readNumber(form, "commissionMonthly"),
    };

    try {
      const response = await fetch(
        isEdit ? `/api/properties/${property?.id}` : "/api/properties",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const result = (await response.json()) as {
        error?: string;
        details?: string[];
        property?: { id: string };
      };

      if (!response.ok) {
        const details = result.details?.join(". ");
        throw new Error(details || result.error || "Не удалось сохранить объект");
      }

      setDirty(false);
      setSuccess(
        isEdit ? "Изменения сохранены" : "Объект создан",
      );

      const nextId = result.property?.id ?? property?.id;
      if (nextId) {
        router.push(`/crm/properties/${nextId}`);
      } else {
        router.push("/crm/properties");
      }
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось сохранить объект",
      );
    } finally {
      setPending(false);
    }
  }

  function onCancel() {
    if (dirty) {
      const leave = window.confirm(
        "Есть несохранённые изменения. Уйти без сохранения?",
      );
      if (!leave) return;
    }
    if (property) {
      router.push(`/crm/properties/${property.id}`);
    } else {
      router.push("/crm/properties");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onChange={() => setDirty(true)}
      className="space-y-4"
    >
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

      <Section title="Основное">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Название" htmlFor="prop-name">
            <input
              id="prop-name"
              name="name"
              required
              defaultValue={property?.name}
              className={inputClassName}
            />
          </Field>
          <Field
            label="Slug (необязательно)"
            htmlFor="prop-slug"
            hint="Если пусто — сгенерируется из названия"
          >
            <input
              id="prop-slug"
              name="slug"
              defaultValue={property?.slug}
              placeholder="sogeneriruyetsya-iz-nazvaniya"
              className={inputClassName}
            />
          </Field>
          <Field label="Тип" htmlFor="prop-type">
            <select
              id="prop-type"
              name="type"
              required
              defaultValue={property?.type ?? "APARTMENT"}
              className={inputClassName}
            >
              {PROPERTY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {propertyTypeLabels[type]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Статус" htmlFor="prop-status">
            <select
              id="prop-status"
              name="status"
              required
              defaultValue={property?.status ?? "ACTIVE"}
              className={inputClassName}
            >
              {PROPERTY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {propertyStatusLabels[status]}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Адрес">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Город" htmlFor="prop-city">
            <input
              id="prop-city"
              name="city"
              required
              defaultValue={property?.city}
              className={inputClassName}
            />
          </Field>
          <Field label="Район" htmlFor="prop-district">
            <input
              id="prop-district"
              name="district"
              required
              defaultValue={property?.district}
              className={inputClassName}
            />
          </Field>
          <Field label="Адрес" htmlFor="prop-address">
            <input
              id="prop-address"
              name="address"
              required
              defaultValue={property?.address}
              className={inputClassName}
            />
          </Field>
        </div>
      </Section>

      <Section title="Характеристики">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Площадь, м²" htmlFor="prop-area">
            <input
              id="prop-area"
              name="area"
              type="number"
              min="0.1"
              step="0.1"
              required
              defaultValue={property?.area}
              className={inputClassName}
            />
          </Field>
          <Field label="Комнаты" htmlFor="prop-rooms">
            <input
              id="prop-rooms"
              name="rooms"
              type="number"
              min="0"
              required
              defaultValue={property?.rooms}
              className={inputClassName}
            />
          </Field>
          <Field label="Спальни" htmlFor="prop-bedrooms">
            <input
              id="prop-bedrooms"
              name="bedrooms"
              type="number"
              min="0"
              required
              defaultValue={property?.bedrooms}
              className={inputClassName}
            />
          </Field>
          <Field label="Ванные" htmlFor="prop-bathrooms">
            <input
              id="prop-bathrooms"
              name="bathrooms"
              type="number"
              min="0"
              required
              defaultValue={property?.bathrooms}
              className={inputClassName}
            />
          </Field>
          <Field label="Этаж" htmlFor="prop-floor">
            <input
              id="prop-floor"
              name="floor"
              type="number"
              min="0"
              defaultValue={property?.floor ?? ""}
              className={inputClassName}
            />
          </Field>
          <Field label="Этажность" htmlFor="prop-total-floors">
            <input
              id="prop-total-floors"
              name="totalFloors"
              type="number"
              min="0"
              defaultValue={property?.totalFloors ?? ""}
              className={inputClassName}
            />
          </Field>
        </div>
      </Section>

      <Section title="Вместимость">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Гостей" htmlFor="prop-guests">
            <input
              id="prop-guests"
              name="guests"
              type="number"
              min="1"
              required
              defaultValue={property?.guests}
              className={inputClassName}
            />
          </Field>
        </div>
      </Section>

      <Section title="Цены">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Цена посуточно, ₽" htmlFor="prop-daily">
            <input
              id="prop-daily"
              name="dailyPrice"
              type="number"
              min="0"
              defaultValue={property?.dailyPrice ?? ""}
              className={inputClassName}
            />
          </Field>
          <Field
            label="Цена помесячно, ₽"
            htmlFor="prop-monthly"
            hint="Ориентир объекта. Цена долгосрочной карточки задаётся отдельно."
          >
            <input
              id="prop-monthly"
              name="monthlyPrice"
              type="number"
              min="0"
              defaultValue={property?.monthlyPrice ?? ""}
              className={inputClassName}
            />
          </Field>
        </div>
      </Section>

      <Section title="Управление">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Тип управления" htmlFor="prop-mgmt">
            <select
              id="prop-mgmt"
              name="managementType"
              required
              value={managementType}
              onChange={(e) => {
                const next = e.target.value as (typeof MANAGEMENT_TYPES)[number];
                setManagementType(next);
                setDirty(true);
                if (next === "OWN") {
                  setOwnerId("");
                  setRentCollectionMode("OPERATOR");
                }
              }}
              className={inputClassName}
            >
              {MANAGEMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type === "OWN"
                    ? "Собственный объект"
                    : "Объект в управлении"}{" "}
                  ({managementTypeLabels[type]})
                </option>
              ))}
            </select>
          </Field>
          {!isOwn ? (
            <Field label="Сбор аренды" htmlFor="prop-rent-mode">
              <select
                id="prop-rent-mode"
                name="rentCollectionMode"
                value={rentCollectionMode}
                onChange={(e) => {
                  setRentCollectionMode(
                    e.target.value as (typeof RENT_COLLECTION_MODES)[number],
                  );
                  setDirty(true);
                }}
                className={inputClassName}
              >
                <option value="OPERATOR">Оператор собирает аренду</option>
                <option value="OWNER_DIRECT">
                  Собственник собирает напрямую
                </option>
              </select>
            </Field>
          ) : null}
          {!isOwn ? (
            <>
              <Field label="Комиссия посуточно, %" htmlFor="prop-comm-daily">
                <input
                  id="prop-comm-daily"
                  name="commissionDaily"
                  type="number"
                  min="0"
                  step="0.1"
                  defaultValue={property?.commissionDaily ?? ""}
                  className={inputClassName}
                />
              </Field>
              <Field label="Комиссия помесячно, %" htmlFor="prop-comm-monthly">
                <input
                  id="prop-comm-monthly"
                  name="commissionMonthly"
                  type="number"
                  min="0"
                  step="0.1"
                  defaultValue={property?.commissionMonthly ?? ""}
                  className={inputClassName}
                />
              </Field>
            </>
          ) : null}
        </div>
      </Section>

      <Section title="Собственник">
        {isOwn ? (
          <p className="text-sm text-[var(--finance-text-secondary)]">
            Собственный объект — structured Owner не используется.
          </p>
        ) : (
          <Field label="Собственник (Owner)" htmlFor="prop-owner">
            <select
              id="prop-owner"
              value={ownerId}
              onChange={(e) => {
                setOwnerId(e.target.value);
                setDirty(true);
              }}
              className={inputClassName}
            >
              <option value="">— не выбран —</option>
              {activeOwners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field
            label="Имя владельца (legacy)"
            htmlFor="prop-owner-name"
            hint="Сохраняется отдельно от Owner"
          >
            <input
              id="prop-owner-name"
              name="ownerName"
              required
              defaultValue={property?.ownerName}
              className={inputClassName}
            />
          </Field>
          <Field label="Телефон владельца (legacy)" htmlFor="prop-owner-phone">
            <input
              id="prop-owner-phone"
              name="ownerPhone"
              required
              defaultValue={property?.ownerPhone}
              className={inputClassName}
            />
          </Field>
        </div>
      </Section>

      <Section title="Описания">
        <div className="space-y-4">
          <Field label="Краткое описание" htmlFor="prop-short">
            <input
              id="prop-short"
              name="shortDescription"
              required
              defaultValue={property?.shortDescription}
              className={inputClassName}
            />
          </Field>
          <Field label="Полное описание" htmlFor="prop-desc">
            <textarea
              id="prop-desc"
              name="description"
              required
              rows={5}
              defaultValue={property?.description}
              className={inputClassName}
            />
          </Field>
        </div>
      </Section>

      {!isEdit ? (
        <p className="text-sm text-[var(--finance-text-secondary)]">
          Фотографии можно добавить после создания объекта.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-[var(--finance-border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--finance-text)] hover:bg-[var(--finance-hover)]"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[var(--finance-blue)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending
            ? "Сохранение..."
            : isEdit
              ? "Сохранить изменения"
              : "Создать объект"}
        </button>
      </div>

      {isEdit && property ? (
        <DangerZone property={property} />
      ) : null}
    </form>
  );
}

function DangerZone({ property }: { property: PropertyDTO }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Удалить объект «${property.name}»? Это действие нельзя отменить.`,
    );
    if (!confirmed) return;

    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/properties/${property.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось удалить объект");
      }
      router.push("/crm/properties");
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось удалить объект",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="finance-card mt-6 border-[var(--finance-red-light)] p-4 sm:p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--finance-red)]">
        Опасная зона
      </h2>
      <p className="mt-2 text-sm text-[var(--finance-text-secondary)]">
        Удаление блокируется, если есть бронирования, каналы или карточка
        долгосрочной аренды.
      </p>
      {error ? (
        <p className="mt-3 rounded-lg bg-[var(--finance-red-light)] px-3 py-2 text-sm text-[var(--finance-red)]">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={pending}
        className="mt-4 rounded-xl border border-[var(--finance-red)]/30 px-4 py-2 text-sm font-medium text-[var(--finance-red)] hover:bg-[var(--finance-red-light)] disabled:opacity-50"
      >
        {pending ? "Удаление..." : "Удалить объект"}
      </button>
    </section>
  );
}
