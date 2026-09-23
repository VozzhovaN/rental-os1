"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { LongTermListingDTO } from "@/lib/long-term-listings";
import { longTermListingUpdateFromFormData } from "@/lib/validations/long-term-listing";

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10";

export function LongTermForm({ listing }: { listing: LongTermListingDTO }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setPending(true);
    try {
      const payload = longTermListingUpdateFromFormData(form);
      if (payload.status === "ARCHIVED" && listing.status !== "ARCHIVED") {
        const confirmed = window.confirm(
          "Архивировать карточку? Восстановление на этом этапе невозможно.",
        );
        if (!confirmed) {
          setPending(false);
          return;
        }
      }
      const response = await fetch(`/api/long-term-listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string; details?: string[] };
      if (!response.ok) {
        throw new Error(result.details?.join(". ") || result.error || "Не удалось сохранить");
      }
      router.push(`/crm/long-term/${listing.id}`);
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
        ) : (
          <select name="status" defaultValue={listing.status} className={inputClassName}>
            <option value="DRAFT">Черновик</option>
            <option value="ACTIVE">Активно</option>
            <option value="PAUSED">На паузе</option>
            <option value="ARCHIVED">Архив</option>
          </select>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold">Условия аренды</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Цена в месяц, ₽</span>
            <input
              name="monthlyPrice"
              type="number"
              min={0}
              required
              defaultValue={listing.monthlyPrice}
              className={inputClassName}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Спецпредложение, ₽</span>
            <input
              name="specialOfferPrice"
              type="number"
              min={0}
              defaultValue={listing.specialOfferPrice ?? ""}
              className={inputClassName}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-zinc-600">Текст спецпредложения</span>
            <input
              name="specialOfferText"
              defaultValue={listing.specialOfferText ?? ""}
              placeholder="Скидка при аренде от 6 месяцев"
              className={inputClassName}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Залог, ₽</span>
            <input name="deposit" type="number" min={0} defaultValue={listing.deposit} className={inputClassName} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Комиссия, %</span>
            <input
              name="commission"
              type="number"
              min={0}
              step="0.1"
              defaultValue={listing.commission}
              className={inputClassName}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Минимальный срок, мес.</span>
            <input
              name="minimumRentalPeriod"
              type="number"
              min={1}
              defaultValue={listing.minimumRentalPeriod}
              className={inputClassName}
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">Условия проживания</span>
          <textarea name="rentalTerms" rows={4} defaultValue={listing.rentalTerms} className={inputClassName} />
        </label>
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold">Контакт для публикации</h2>
        <p className="text-xs text-zinc-500">
          Этот контакт показывается в объявлении. Это не гость, не владелец объекта и не покупатель.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-zinc-600">Имя</span>
            <input
              name="publicationContactName"
              defaultValue={listing.publicationContactName ?? ""}
              placeholder="Анна"
              className={inputClassName}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Код страны</span>
            <input
              name="publicationPhoneCountryCode"
              defaultValue={listing.publicationPhoneCountryCode ?? ""}
              placeholder="7"
              inputMode="numeric"
              className={inputClassName}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Номер телефона</span>
            <input
              name="publicationPhoneNumber"
              defaultValue={listing.publicationPhoneNumber ?? ""}
              placeholder="9001234567"
              inputMode="numeric"
              className={inputClassName}
            />
          </label>
        </div>
        <p className="text-xs text-zinc-500">Код страны и номер — цифры, без скобок и дефисов. Формат площадки не задаём.</p>
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold">Маркетинг</h2>
        <p className="text-xs text-zinc-500">
          Эти тексты относятся только к долгосрочной карточке и не меняют описание объекта.
        </p>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">Заголовок</span>
          <input name="marketingTitle" defaultValue={listing.marketingTitle} className={inputClassName} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">Описание</span>
          <textarea name="description" rows={6} defaultValue={listing.description} className={inputClassName} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">Инфраструктура</span>
          <textarea
            name="infrastructureDescription"
            rows={3}
            defaultValue={listing.infrastructureDescription}
            className={inputClassName}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">Безопасность</span>
          <textarea
            name="securityDescription"
            rows={3}
            defaultValue={listing.securityDescription}
            className={inputClassName}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">Парковка</span>
          <textarea
            name="parkingDescription"
            rows={3}
            defaultValue={listing.parkingDescription}
            className={inputClassName}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">Транспорт</span>
          <textarea
            name="transportDescription"
            rows={3}
            defaultValue={listing.transportDescription}
            className={inputClassName}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600">Дополнительные преимущества</span>
          <textarea
            name="advantagesDescription"
            rows={3}
            defaultValue={listing.advantagesDescription}
            className={inputClassName}
          />
        </label>
      </section>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Сохранение..." : "Сохранить"}
      </button>
    </form>
  );
}
