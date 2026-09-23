"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { BuyerDTO } from "@/lib/buyers";
import { MESSENGER_TYPES } from "@/lib/validations/buyer";

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-700">{label}</span>
      {children}
    </label>
  );
}

export function BuyerForm({ buyer }: { buyer?: BuyerDTO }) {
  const router = useRouter();
  const isEdit = Boolean(buyer);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [messengerType, setMessengerType] = useState(buyer?.messengerType ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      messengerType: messengerType === "" ? null : messengerType,
      messengerContact: String(form.get("messengerContact") ?? "").trim(),
      notes: String(form.get("notes") ?? "").trim(),
    };

    try {
      const response = await fetch(isEdit ? `/api/buyers/${buyer?.id}` : "/api/buyers", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        error?: string;
        details?: string[];
        buyer?: { id: string };
      };
      if (!response.ok || !result.buyer) {
        throw new Error(result.details?.join(". ") || result.error || "Не удалось сохранить");
      }
      router.push(`/crm/sales/clients/${result.buyer.id}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось сохранить");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold">Контакты</h2>
        <Field label="Имя / ФИО">
          <input name="name" required defaultValue={buyer?.name ?? ""} className={inputClassName} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Телефон">
            <input name="phone" defaultValue={buyer?.phone ?? ""} className={inputClassName} />
          </Field>
          <Field label="Email">
            <input
              name="email"
              type="email"
              defaultValue={buyer?.email ?? ""}
              className={inputClassName}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold">Мессенджер</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="messengerTypeRadio"
              checked={messengerType === ""}
              onChange={() => setMessengerType("")}
            />
            Не указан
          </label>
          {MESSENGER_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2">
              <input
                type="radio"
                name="messengerTypeRadio"
                checked={messengerType === type}
                onChange={() => setMessengerType(type)}
              />
              {type === "TELEGRAM" ? "Telegram" : "MAX"}
            </label>
          ))}
        </div>
        <Field label="Контакт в мессенджере">
          <input
            name="messengerContact"
            defaultValue={buyer?.messengerContact ?? ""}
            className={inputClassName}
          />
        </Field>
      </section>

      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="font-semibold">Заметки</h2>
        <textarea name="notes" rows={4} defaultValue={buyer?.notes ?? ""} className={inputClassName} />
      </section>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Сохранение..." : isEdit ? "Сохранить" : "Создать клиента"}
      </button>
    </form>
  );
}
