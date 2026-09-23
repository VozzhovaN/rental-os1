import { jsonUtf8 } from "@/lib/api-json";
import { buildCianSaleListingPreview } from "@/lib/publications/providers/cian/sale";
import { getSaleListingById } from "@/lib/sale-listings";
import { toSalePublicationListingSource } from "@/lib/sale-publications";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const listing = await getSaleListingById(id);

  if (!listing) {
    return jsonUtf8({ error: "Карточка продажи не найдена" }, { status: 404 });
  }

  const preview = buildCianSaleListingPreview(toSalePublicationListingSource(listing));
  const download = new URL(request.url).searchParams.get("download") === "1";

  if (!preview.ready) {
    return jsonUtf8(
      {
        ready: false,
        listingId: preview.listingId,
        errors: preview.errors,
        warnings: preview.warnings,
        baseline: preview.baseline,
        cian: preview.cian,
        normalizedHash: preview.normalizedHash,
        xml: null,
      },
      { status: 422 },
    );
  }

  if (download) {
    return new Response(preview.xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${preview.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return jsonUtf8({
    ready: true,
    listingId: preview.listingId,
    fileName: preview.fileName,
    normalizedHash: preview.normalizedHash,
    cianPayloadHash: preview.cianPayloadHash,
    warnings: preview.cian.warnings,
    xml: preview.xml,
  });
});
