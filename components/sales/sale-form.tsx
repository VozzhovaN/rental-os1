"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { SaleListingDTO } from "@/lib/sale-listings";
import {
  parseUpdateSaleListing,
  formatSaleListingZodError,
  saleListingUpdateFromFormData,
} from "@/lib/validations/sale-listing";

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10";

export function SaleForm({ listing }: { listing: SaleListingDTO }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusLocked = listing.status === "ARCHIVED" || listing.status === "SOLD";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setPending(true);
    try {
      let payload;
      if (listing.status === "SOLD") {
        const parsed = parseUpdateSaleListing({
          crmOwnerName: String(form.get("crmOwnerName") ?? ""),
          crmOwnerPhone: String(form.get("crmOwnerPhone") ?? ""),
          crmComment: String(form.get("crmComment") ?? ""),
        });
        if (!parsed.success) {
          throw new Error(formatSaleListingZodError(parsed.error).join(". "));
        }
        payload = parsed.data;
      } else {
        payload = saleListingUpdateFromFormData(form);
        if (payload.status === "ARCHIVED" && listing.status !== "ARCHIVED") {
          const confirmed = window.confirm(
            "Архивировать карточку продажи? Восстановление на этом этапе невозможно.",
          );
          if (!confirmed) {
            setPending(false);
            return;
          }
        }
      }
      const response = await fetch(`/api/sale-listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string; details?: string[] };
      if (response.status === 409) {
        throw new Error(result.error || "Конфликт данных");
      }
      if (!response.ok) {
        throw new Error(result.details?.join(". ") || result.error || "Не удалось сохранить");
      }
      router.push(`/crm/sales/properties/${listing.id}`);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold">Статус</h2>
        {listing.status === "ARCHIVED" ? (
          <>
            <input type="hidden" name="status" value="ARCHIVED" />
            <p className="text-sm text-zinc-600">Архив</p>
            <p className="text-xs text-zinc-500">Архивная карточка не восстанавливается на этом этапе.</p>
          </>
        ) : listing.status === "SOLD" ? (
          <>
            <p className="text-sm text-zinc-600">Продан</p>
            <p className="text-xs text-zinc-500">
              Статус «Продан» задаётся workflow покупки. Ручное изменение через UI недоступно.
            </p>
          </>
        ) : (
          <select name="status" defaultValue={listing.status} className={inputClassName}>
            <option value="DRAFT">Черновик</option>
            <option value="ACTIVE">Активен</option>
            <option value="PAUSED">Приостановлен</option>
            <option value="ARCHIVED">Архив</option>
          </select>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold">Цена продажи</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Цена продажи, ₽</span>
            <input
              name="price"
              type="number"
              min={0}
              required
              defaultValue={listing.price}
              disabled={statusLocked && listing.status === "SOLD"}
              className={inputClassName}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Специальная цена, ₽</span>
            <input
              name="specialOfferPrice"
              type="number"
              min={0}
              defaultValue={listing.specialOfferPrice ?? ""}
              disabled={statusLocked && listing.status === "SOLD"}
              className={inputClassName}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-zinc-600">Текст спецпредложения</span>
            <input
              name="specialOfferText"
              defaultValue={listing.specialOfferText ?? ""}
              placeholder="Скидка при быстрой сделке"
              disabled={statusLocked && listing.status === "SOLD"}
              className={inputClassName}
            />
          </label>
        </div>
        <p className="text-xs text-zinc-500">
          Базовая цена продажи всегда сохраняется отдельно от специальной цены.
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold">Маркетинг продажи</h2>
        <p className="text-xs text-zinc-500">
          Эти поля относятся только к карточке продажи и не меняют Property.
        </p>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">Заголовок</span>
          <input
            name="marketingTitle"
            defaultValue={listing.marketingTitle ?? ""}
            disabled={statusLocked && listing.status === "SOLD"}
            className={inputClassName}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">Описание для публикации</span>
          <textarea
            name="description"
            rows={6}
            defaultValue={listing.description ?? ""}
            disabled={statusLocked && listing.status === "SOLD"}
            className={inputClassName}
          />
          <span className="mt-1 block text-xs text-zinc-500">
            Маркетинговое описание карточки продажи. Описание объекта берётся из Property.
          </span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">Преимущества</span>
          <textarea
            name="advantages"
            rows={3}
            defaultValue={listing.advantages ?? ""}
            disabled={statusLocked && listing.status === "SOLD"}
            className={inputClassName}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">Инфраструктура</span>
          <textarea
            name="infrastructure"
            rows={3}
            defaultValue={listing.infrastructure ?? ""}
            disabled={statusLocked && listing.status === "SOLD"}
            className={inputClassName}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">Безопасность</span>
          <textarea
            name="security"
            rows={3}
            defaultValue={listing.security ?? ""}
            disabled={statusLocked && listing.status === "SOLD"}
            className={inputClassName}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">Парковка</span>
          <textarea
            name="parking"
            rows={3}
            defaultValue={listing.parking ?? ""}
            disabled={statusLocked && listing.status === "SOLD"}
            className={inputClassName}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">Транспорт</span>
          <textarea
            name="transport"
            rows={3}
            defaultValue={listing.transport ?? ""}
            disabled={statusLocked && listing.status === "SOLD"}
            className={inputClassName}
          />
        </label>
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold">CRM: собственник и комментарий</h2>
        <p className="text-xs text-zinc-500">
          Только для внутреннего CRM. Не публикуется во внешние каналы и не меняет карточку Property.
        </p>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Описание объекта (Property)
          </p>
          <p className="mt-1 whitespace-pre-wrap">
            {listing.property.description?.trim() || "—"}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Имя собственника</span>
            <input
              name="crmOwnerName"
              defaultValue={listing.crmOwnerName ?? ""}
              className={inputClassName}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Телефон собственника</span>
            <input
              name="crmOwnerPhone"
              defaultValue={listing.crmOwnerPhone ?? ""}
              className={inputClassName}
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">Комментарий (CRM)</span>
          <textarea
            name="crmComment"
            rows={4}
            defaultValue={listing.crmComment ?? ""}
            placeholder="Внутренняя заметка по объекту продажи"
            className={inputClassName}
          />
        </label>
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold">Контакт для публикации</h2>
        <p className="text-xs text-zinc-500">
          Отдельный контакт карточки продажи. Не связан с LongTermListing и не является покупателем.
        </p>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">Имя</span>
          <input
            name="publicationContactName"
            defaultValue={listing.publicationContactName ?? ""}
            disabled={statusLocked && listing.status === "SOLD"}
            className={inputClassName}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Код страны</span>
            <input
              name="publicationPhoneCountryCode"
              defaultValue={listing.publicationPhoneCountryCode ?? ""}
              placeholder="7"
              disabled={statusLocked && listing.status === "SOLD"}
              className={inputClassName}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Телефон</span>
            <input
              name="publicationPhoneNumber"
              defaultValue={listing.publicationPhoneNumber ?? ""}
              placeholder="9001234567"
              disabled={statusLocked && listing.status === "SOLD"}
              className={inputClassName}
            />
          </label>
        </div>
      </section>

      {listing.status === "SOLD" ? (
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Сохранение..." : "Сохранить CRM-поля"}
        </button>
      ) : (
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Сохранение..." : "Сохранить"}
        </button>
      )}
    </form>
  );
}
