import { FinanceView } from "@/components/finance/finance-view";
import {
  getFinanceSummary,
  listFinanceQuerySchema,
  listFinancialTransactions,
} from "@/lib/finance";
import { getProperties } from "@/lib/properties";

export const dynamic = "force-dynamic";

export default async function FinanceOperationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = listFinanceQuerySchema.safeParse({
    propertyId: typeof raw.propertyId === "string" ? raw.propertyId : undefined,
    type: typeof raw.type === "string" ? raw.type : undefined,
    category: typeof raw.category === "string" ? raw.category : undefined,
    dateFrom: typeof raw.dateFrom === "string" ? raw.dateFrom : undefined,
    dateTo: typeof raw.dateTo === "string" ? raw.dateTo : undefined,
  });
  const filters = parsed.success ? parsed.data : {};

  const [transactions, summary, properties] = await Promise.all([
    listFinancialTransactions(filters),
    getFinanceSummary(filters),
    getProperties(),
  ]);

  return (
      <FinanceView
        initialTransactions={transactions}
        initialSummary={summary}
        properties={properties.map((p) => ({ id: p.id, name: p.name }))}
        filters={filters}
        basePath="/crm/finance/operations"
      />
  );
}
