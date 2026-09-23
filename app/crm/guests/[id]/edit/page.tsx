import Link from "next/link";
import { notFound } from "next/navigation";
import { GuestForm } from "@/components/guests/guest-form";
import { getGuestById, serializeGuest } from "@/lib/guests";

export const dynamic = "force-dynamic";

export default async function EditGuestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const guest = await getGuestById(id);

  if (!guest) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href={`/crm/guests/${guest.id}`}
          className="text-sm text-[var(--finance-text-secondary)] hover:text-[var(--finance-text)]"
        >
          ← К карточке гостя
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--finance-text)]">
          Редактирование гостя
        </h1>
      </div>
      <GuestForm guest={serializeGuest(guest)} />
    </div>
  );
}
