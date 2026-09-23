import Link from "next/link";
import { GuestForm } from "@/components/guests/guest-form";

export default function NewGuestPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/crm/guests" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← К списку гостей
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Новый гость</h1>
      </div>
      <GuestForm />
    </div>
  );
}
