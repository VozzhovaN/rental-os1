"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { GuestDTO } from "@/lib/guests";
import { MESSENGER_TYPES } from "@/lib/validations/guest";

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-900/10 focus:border-zinc-400 focus:ring-2";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-700">{label}</span>
      {children}
    </label>
  );
}

export function GuestForm({ guest }: { guest?: GuestDTO }) {
  const router = useRouter();
  const isEdit = Boolean(guest);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [messengerType, setMessengerType] = useState(guest?.messengerType ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      firstName: String(form.get("firstName") ?? "").trim(),
      lastName: String(form.get("lastName") ?? "").trim(),
      middleName: String(form.get("middleName") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      messengerType: messengerType === "" ? null : messengerType,
      messengerContact: String(form.get("messengerContact") ?? "").trim(),
      comment: String(form.get("comment") ?? "").trim(),
    };

    try {
      const response = await fetch(isEdit ? `/api/guests/${guest?.id}` : "/api/guests", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string; details?: string[]; guest?: { id: string } };

      if (!response.ok) {
        throw new Error(result.details?.join(". ") || result.error || "Не удалось сохранить гостя");
      }

      router.push(result.guest?.id ? `/crm/guests/${result.guest.id}` : "/crm/guests");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось сохранить гостя");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold">Контакты</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Фамилия">
            <input name="lastName" defaultValue={guest?.lastName ?? ""} className={inputClassName} />
          </Field>
          <Field label="Имя">
            <input name="firstName" required defaultValue={guest?.firstName} className={inputClassName} />
          </Field>
          <Field label="Отчество">
            <input name="middleName" defaultValue={guest?.middleName ?? ""} className={inputClassName} />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Телефон">
            <input name="phone" defaultValue={guest?.phone ?? ""} className={inputClassName} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" defaultValue={guest?.email ?? ""} className={inputClassName} />
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold">Основной мессенджер</h2>
        <p className="text-sm text-zinc-500">
          Это канал общения с гостем, отдельно от канала продаж.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          {MESSENGER_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2">
              <input
                type="radio"
                name="messengerType"
                value={type}
                checked={messengerType === type}
                onChange={() => setMessengerType(type)}
              />
              {type === "TELEGRAM" ? "Telegram" : "MAX"}
            </label>
          ))}
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="messengerType"
              value=""
              checked={messengerType === ""}
              onChange={() => setMessengerType("")}
            />
            Не выбран
          </label>
        </div>
        <Field label="Контакт в мессенджере">
          <input
            name="messengerContact"
            placeholder="@username"
            defaultValue={guest?.messengerContact ?? ""}
            className={inputClassName}
          />
        </Field>
        <Field label="Комментарий">
          <textarea name="comment" rows={3} defaultValue={guest?.comment ?? ""} className={inputClassName} />
        </Field>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Сохранение..." : isEdit ? "Сохранить" : "Создать гостя"}
        </button>
        <Link
          href={guest ? `/crm/guests/${guest.id}` : "/crm/guests"}
          className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700"
        >
          Отмена
        </Link>
      </div>
    </form>
  );
}
