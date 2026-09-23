import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyerForm } from "@/components/sales/buyer-form";
import { getBuyerById, serializeBuyer } from "@/lib/buyers";

export const dynamic = "force-dynamic";

export default async function EditSalesClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const buyer = await getBuyerById(id);
  if (!buyer) {
    notFound();
  }

  const card = serializeBuyer(buyer);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/crm/sales/clients/${card.id}`}
          className="text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← К карточке
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Редактирование клиента</h1>
      </div>
      <BuyerForm buyer={card} />
    </div>
  );
}
