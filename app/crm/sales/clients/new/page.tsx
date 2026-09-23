import Link from "next/link";
import { BuyerForm } from "@/components/sales/buyer-form";

export default function NewSalesClientPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/crm/sales/clients" className="text-sm text-zinc-500 hover:text-zinc-800">
          ← К списку
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Новый клиент продажи</h1>
      </div>
      <BuyerForm />
    </div>
  );
}
