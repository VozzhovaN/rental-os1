"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { GuestDTO } from "@/lib/guests";
import { MESSENGER_TYPES } from "@/lib/validations/guest";

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-900/10 focus:border-zinc-400 focus:ring-2";

function subscribeNever() {
  return () => {};
}

export function QuickGuestForm({
  onCreated,
  onClose,
}: {
  onCreated: (guest: GuestDTO) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [messengerType, setMessengerType] = useState("");
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      firstName: String(form.get("firstName") ?? "").trim(),
      lastName: String(form.get("lastName") ?? "").trim() || null,
      phone: String(form.get("phone") ?? "").trim() || null,
      email: String(form.get("email") ?? "").trim() || null,
      messengerType: messengerType === "" ? null : messengerType,
      messengerContact: String(form.get("messengerContact") ?? "").trim() || null,
    };

    try {
      const response = await fetch("/api/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        error?: string;
        details?: string[];
        guest?: GuestDTO;
      };

      if (!response.ok || !result.guest) {
        throw new Error(result.details?.join(". ") || result.error || "Не удалось создать гостя");
      }

      onCreated(result.guest);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось создать гостя");
    } finally {
      setPending(false);
    }
  }

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Новый гость</h2>
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-zinc-700">Имя</span>
          <input name="firstName" required className={inputClassName} />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-zinc-700">Фамилия</span>
          <input name="lastName" className={inputClassName} />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-zinc-700">Телефон</span>
          <input name="phone" className={inputClassName} />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-zinc-700">Email</span>
          <input name="email" type="email" className={inputClassName} />
        </label>
        <div className="flex flex-wrap gap-3 text-sm">
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
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-zinc-700">Контакт в мессенджере</span>
          <input name="messengerContact" placeholder="@username" className={inputClassName} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Сохранение..." : "Создать гостя"}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm">
            Закрыть
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
