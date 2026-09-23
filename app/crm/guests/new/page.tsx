import Link from "next/link";
import { GuestForm } from "@/components/guests/guest-form";

export default function NewGuestPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/crm/guests"
          className="text-sm text-[var(--finance-text-secondary)] hover:text-[var(--finance-text)]"
        >
          ← К списку гостей
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--finance-text)]">
          Новый гость
        </h1>
        <p className="mt-1 text-sm text-[var(--finance-text-secondary)]">
          Имя, контакты и мессенджер. Фото не требуется.
        </p>
      </div>
      <GuestForm />
    </div>
  );
}
