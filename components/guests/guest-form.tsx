"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { formatGuestName } from "@/lib/format";
import type { GuestDTO } from "@/lib/guests";
import { normalizePhoneDigits } from "@/lib/guests";
import { MESSENGER_TYPES } from "@/lib/validations/guest";

type DuplicateHit = {
  id: string;
  label: string;
  reason: string;
};

const inputClassName =
  "w-full rounded-xl border border-[var(--finance-border)] bg-white px-3 py-2 text-sm text-[var(--finance-text)] outline-none focus:border-[var(--finance-blue)] focus:ring-2 focus:ring-[var(--finance-blue)]/15";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1.5 block text-sm font-medium text-[var(--finance-text)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="finance-card space-y-4 p-4 sm:p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--finance-text-muted)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

async function findDuplicates(input: {
  phone: string;
  email: string;
  excludeId?: string;
}): Promise<DuplicateHit[]> {
  const hits: DuplicateHit[] = [];
  const queries = [input.phone, input.email].filter(Boolean);

  for (const q of queries) {
    const response = await fetch(`/api/guests?q=${encodeURIComponent(q)}`);
    if (!response.ok) continue;
    const payload = (await response.json()) as {
      guests?: Array<{
        id: string;
        firstName: string;
        lastName: string | null;
        middleName?: string | null;
        phone: string | null;
        email: string | null;
      }>;
    };

    for (const guest of payload.guests ?? []) {
      if (input.excludeId && guest.id === input.excludeId) continue;
      const phoneMatch =
        input.phone &&
        guest.phone &&
        normalizePhoneDigits(guest.phone) === normalizePhoneDigits(input.phone) &&
        normalizePhoneDigits(input.phone).length >= 10;
      const emailMatch =
        input.email &&
        guest.email &&
        guest.email.trim().toLowerCase() === input.email.trim().toLowerCase();

      if (phoneMatch) {
        hits.push({
          id: guest.id,
          label: formatGuestName(guest),
          reason: "телефон",
        });
      } else if (emailMatch) {
        hits.push({
          id: guest.id,
          label: formatGuestName(guest),
          reason: "email",
        });
      }
    }
  }

  const unique = new Map<string, DuplicateHit>();
  for (const hit of hits) unique.set(hit.id, hit);
  return Array.from(unique.values());
}

export function GuestForm({ guest }: { guest?: GuestDTO }) {
  const router = useRouter();
  const isEdit = Boolean(guest);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [messengerType, setMessengerType] = useState(guest?.messengerType ?? "");
  const [duplicates, setDuplicates] = useState<DuplicateHit[]>([]);
  const skipDuplicateRef = useRef(false);

  async function save(payload: Record<string, unknown>) {
    const response = await fetch(
      isEdit ? `/api/guests/${guest?.id}` : "/api/guests",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const result = (await response.json()) as {
      error?: string;
      details?: string[];
      guest?: { id: string };
    };

    if (!response.ok) {
      throw new Error(
        result.details?.join(". ") ||
          result.error ||
          "Не удалось сохранить гостя",
      );
    }

    setSuccess(isEdit ? "Изменения сохранены" : "Гость создан");
    router.push(
      result.guest?.id
        ? `/crm/guests/${result.guest.id}`
        : guest
          ? `/crm/guests/${guest.id}`
          : "/crm/guests",
    );
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const phone = String(form.get("phone") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const payload = {
      firstName: String(form.get("firstName") ?? "").trim(),
      lastName: String(form.get("lastName") ?? "").trim(),
      middleName: String(form.get("middleName") ?? "").trim(),
      phone,
      email,
      messengerType: messengerType === "" ? null : messengerType,
      messengerContact: String(form.get("messengerContact") ?? "").trim(),
      comment: String(form.get("comment") ?? "").trim(),
    };

    try {
      if (!skipDuplicateRef.current && (phone || email)) {
        const found = await findDuplicates({
          phone,
          email,
          excludeId: guest?.id,
        });
        if (found.length > 0) {
          setDuplicates(found);
          setPending(false);
          return;
        }
      }

      skipDuplicateRef.current = false;
      await save(payload);
      setDuplicates([]);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось сохранить гостя",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <p
          className="rounded-xl bg-[var(--finance-red-light)] px-4 py-3 text-sm text-[var(--finance-red)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-xl bg-[var(--finance-green-light)] px-4 py-3 text-sm text-[var(--finance-green)]">
          {success}
        </p>
      ) : null}

      {duplicates.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">
            В CRM уже есть гость с таким{" "}
            {duplicates.map((d) => d.reason).join(" / ")}.
          </p>
          <ul className="mt-2 space-y-1">
            {duplicates.map((hit) => (
              <li key={hit.id}>
                <Link
                  href={`/crm/guests/${hit.id}`}
                  className="font-medium text-[var(--finance-blue)] hover:underline"
                >
                  Открыть: {hit.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                skipDuplicateRef.current = true;
                setDuplicates([]);
                (
                  document.getElementById(
                    "guest-form-submit",
                  ) as HTMLButtonElement | null
                )?.click();
              }}
              className="rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium"
            >
              Всё равно сохранить
            </button>
            <button
              type="button"
              onClick={() => setDuplicates([])}
              className="rounded-xl px-3 py-1.5 text-sm text-amber-900/70"
            >
              Отменить
            </button>
          </div>
        </div>
      ) : null}

      <Section title="Основное">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Фамилия" htmlFor="guest-last">
            <input
              id="guest-last"
              name="lastName"
              defaultValue={guest?.lastName ?? ""}
              className={inputClassName}
            />
          </Field>
          <Field label="Имя" htmlFor="guest-first">
            <input
              id="guest-first"
              name="firstName"
              required
              defaultValue={guest?.firstName}
              className={inputClassName}
            />
          </Field>
          <Field label="Отчество" htmlFor="guest-middle">
            <input
              id="guest-middle"
              name="middleName"
              defaultValue={guest?.middleName ?? ""}
              className={inputClassName}
            />
          </Field>
        </div>
      </Section>

      <Section title="Контакты">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Телефон" htmlFor="guest-phone">
            <input
              id="guest-phone"
              name="phone"
              defaultValue={guest?.phone ?? ""}
              className={inputClassName}
              onChange={() => {
                skipDuplicateRef.current = false;
                setDuplicates([]);
              }}
            />
          </Field>
          <Field label="Email" htmlFor="guest-email">
            <input
              id="guest-email"
              name="email"
              type="email"
              defaultValue={guest?.email ?? ""}
              className={inputClassName}
              onChange={() => {
                skipDuplicateRef.current = false;
                setDuplicates([]);
              }}
            />
          </Field>
        </div>
      </Section>

      <Section title="Мессенджер">
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
            Не указан
          </label>
        </div>
        <Field label="Контакт в мессенджере" htmlFor="guest-m-contact">
          <input
            id="guest-m-contact"
            name="messengerContact"
            placeholder="@username"
            defaultValue={guest?.messengerContact ?? ""}
            className={inputClassName}
          />
        </Field>
        <Field label="Комментарий" htmlFor="guest-comment">
          <textarea
            id="guest-comment"
            name="comment"
            rows={3}
            defaultValue={guest?.comment ?? ""}
            className={inputClassName}
          />
        </Field>
      </Section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Link
          href={guest ? `/crm/guests/${guest.id}` : "/crm/guests"}
          className="rounded-xl border border-[var(--finance-border)] bg-white px-4 py-2.5 text-sm font-medium hover:bg-[var(--finance-hover)]"
        >
          Отмена
        </Link>
        <button
          id="guest-form-submit"
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[var(--finance-blue)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending
            ? "Сохранение..."
            : isEdit
              ? "Сохранить изменения"
              : "Создать гостя"}
        </button>
      </div>
    </form>
  );
}
