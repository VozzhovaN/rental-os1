import Link from "next/link";
import { notFound } from "next/navigation";
import { OwnerDetail } from "@/components/finance/owner-detail";
import {
  FinanceDomainError,
  calculateOwnerBalance,
  getOwner,
  listOwnerPayouts,
  listOwnerSettlements,
  serializeFinancialTransaction,
} from "@/lib/finance";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FinanceOwnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let owner;
  try {
    owner = await getOwner(id);
  } catch (error) {
    if (error instanceof FinanceDomainError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const [balance, payouts, settlements, txRows] = await Promise.all([
    calculateOwnerBalance(id),
    listOwnerPayouts(id),
    listOwnerSettlements(id),
    prisma.financialTransaction.findMany({
      where: { ownerId: id },
      include: { property: { select: { name: true } } },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/crm/finance/owners" className="text-sm text-zinc-500 hover:text-zinc-800">
        ← К собственникам
      </Link>
      <OwnerDetail
        owner={{
          id: owner.id,
          name: owner.name,
          phone: owner.phone,
          email: owner.email,
          notes: owner.notes,
          isActive: owner.isActive,
          properties: owner.properties,
        }}
        balance={balance}
        payouts={payouts.map((p) => ({
          id: p.id,
          amount: p.amount,
          paidAt: p.paidAt.toISOString(),
          method: p.method,
          note: p.note,
          allocations: p.allocations.map((a) => ({
            id: a.id,
            amount: a.amount,
            property: a.property,
          })),
        }))}
        settlements={settlements.map((s) => ({
          id: s.id,
          periodStart: s.periodStart.toISOString(),
          periodEnd: s.periodEnd.toISOString(),
          status: s.status,
          notes: s.notes,
          closedAt: s.closedAt?.toISOString() ?? null,
        }))}
        transactions={txRows.map(serializeFinancialTransaction)}
      />
    </div>
  );
}
