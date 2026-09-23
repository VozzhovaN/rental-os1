"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
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
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-700">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-900/10 focus:border-zinc-400 focus:ring-2";

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
  const [pending, setPending] = useState(false);
  const [managementType, setManagementType] = useState(
    property?.managementType ?? "COMMISSION",
  );
  const [rentCollectionMode, setRentCollectionMode] = useState(
    property?.rentCollectionMode ?? "OPERATOR",
  );
  const [ownerId, setOwnerId] = useState(property?.ownerId ?? "");

  const activeOwners = owners.filter((o) => o.isActive);
  const isOwn = managementType === "OWN";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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
      commissionDaily: readNumber(form, "commissionDaily"),
      commissionMonthly: readNumber(form, "commissionMonthly"),
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
      };

      if (!response.ok) {
        const details = result.details?.join(". ");
        throw new Error(details || result.error || "Не удалось сохранить объект");
      }

      router.push("/crm/properties");
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

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Основное</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Название">
            <input
              name="name"
              required
              defaultValue={property?.name}
              className={inputClassName}
            />
          </Field>
          <Field label="Slug (необязательно)">
            <input
              name="slug"
              defaultValue={property?.slug}
              placeholder="sogeneriruyetsya-iz-nazvaniya"
              className={inputClassName}
            />
          </Field>
          <Field label="Тип">
            <select
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
          <Field label="Статус">
            <select
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
          <Field label="Тип управления">
            <select
              name="managementType"
              required
              value={managementType}
              onChange={(e) => {
                const next = e.target.value as (typeof MANAGEMENT_TYPES)[number];
                setManagementType(next);
                if (next === "OWN") {
                  setOwnerId("");
                  setRentCollectionMode("OPERATOR");
                }
              }}
              className={inputClassName}
            >
              {MANAGEMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {managementTypeLabels[type]}
                </option>
              ))}
            </select>
          </Field>
          {!isOwn ? (
            <Field label="Сбор аренды">
              <select
                name="rentCollectionMode"
                value={rentCollectionMode}
                onChange={(e) =>
                  setRentCollectionMode(
                    e.target.value as (typeof RENT_COLLECTION_MODES)[number],
                  )
                }
                className={inputClassName}
              >
                <option value="OPERATOR">Оператор собирает аренду</option>
                <option value="OWNER_DIRECT">Собственник собирает напрямую</option>
              </select>
            </Field>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Расположение</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Город">
            <input
              name="city"
              required
              defaultValue={property?.city}
              className={inputClassName}
            />
          </Field>
          <Field label="Район">
            <input
              name="district"
              required
              defaultValue={property?.district}
              className={inputClassName}
            />
          </Field>
          <Field label="Адрес">
            <input
              name="address"
              required
              defaultValue={property?.address}
              className={inputClassName}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Параметры</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Площадь, м²">
            <input
              name="area"
              type="number"
              min="0.1"
              step="0.1"
              required
              defaultValue={property?.area}
              className={inputClassName}
            />
          </Field>
          <Field label="Комнаты">
            <input
              name="rooms"
              type="number"
              min="0"
              required
              defaultValue={property?.rooms}
              className={inputClassName}
            />
          </Field>
          <Field label="Спальни">
            <input
              name="bedrooms"
              type="number"
              min="0"
              required
              defaultValue={property?.bedrooms}
              className={inputClassName}
            />
          </Field>
          <Field label="Санузлы">
            <input
              name="bathrooms"
              type="number"
              min="0"
              required
              defaultValue={property?.bathrooms}
              className={inputClassName}
            />
          </Field>
          <Field label="Этаж">
            <input
              name="floor"
              type="number"
              min="0"
              defaultValue={property?.floor ?? ""}
              className={inputClassName}
            />
          </Field>
          <Field label="Этажей в доме">
            <input
              name="totalFloors"
              type="number"
              min="0"
              defaultValue={property?.totalFloors ?? ""}
              className={inputClassName}
            />
          </Field>
          <Field label="Гостей">
            <input
              name="guests"
              type="number"
              min="1"
              required
              defaultValue={property?.guests}
              className={inputClassName}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Цены и комиссия</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Цена посуточно, ₽">
            <input
              name="dailyPrice"
              type="number"
              min="0"
              defaultValue={property?.dailyPrice ?? ""}
              className={inputClassName}
            />
          </Field>
          <Field label="Цена помесячно, ₽">
            <input
              name="monthlyPrice"
              type="number"
              min="0"
              defaultValue={property?.monthlyPrice ?? ""}
              className={inputClassName}
            />
            <span className="mt-1 block text-xs font-normal text-zinc-500">
              Ориентир объекта. Цена долгосрочной карточки задаётся отдельно и не
              синхронизируется.
            </span>
          </Field>
          <Field label="Комиссия посуточно, %">
            <input
              name="commissionDaily"
              type="number"
              min="0"
              step="0.1"
              defaultValue={property?.commissionDaily ?? ""}
              className={inputClassName}
            />
          </Field>
          <Field label="Комиссия помесячно, %">
            <input
              name="commissionMonthly"
              type="number"
              min="0"
              step="0.1"
              defaultValue={property?.commissionMonthly ?? ""}
              className={inputClassName}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Описание</h2>
        <Field label="Краткое описание">
          <input
            name="shortDescription"
            required
            defaultValue={property?.shortDescription}
            className={inputClassName}
          />
        </Field>
        <Field label="Полное описание">
          <textarea
            name="description"
            required
            rows={5}
            defaultValue={property?.description}
            className={inputClassName}
          />
        </Field>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-zinc-900">Владелец</h2>
        {isOwn ? (
          <p className="text-sm text-zinc-600">Собственный объект — structured Owner не используется.</p>
        ) : (
          <Field label="Собственник (COMMISSION)">
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
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
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Имя владельца (legacy)">
            <input
              name="ownerName"
              required
              defaultValue={property?.ownerName}
              className={inputClassName}
            />
          </Field>
          <Field label="Телефон владельца (legacy)">
            <input
              name="ownerPhone"
              required
              defaultValue={property?.ownerPhone}
              className={inputClassName}
            />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending
            ? "Сохранение..."
            : isEdit
              ? "Сохранить изменения"
              : "Создать объект"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/crm/properties")}
          className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
