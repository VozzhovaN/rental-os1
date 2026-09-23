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
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href={`/crm/guests/${guest.id}`} className="text-sm text-zinc-500 hover:text-zinc-800">
          ← К карточке гостя
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Редактирование гостя</h1>
      </div>
      <GuestForm guest={serializeGuest(guest)} />
    </div>
  );
}
