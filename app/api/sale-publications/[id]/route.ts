import { jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  getSalePublicationById,
  getSaleListingPublicationBundle,
  serializeSalePublication,
} from "@/lib/sale-publications";

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const publication = await getSalePublicationById(id);
  if (!publication) {
    return jsonUtf8({ error: "Публикация продажи не найдена" }, { status: 404 });
  }

  const bundle = await getSaleListingPublicationBundle(publication.saleListingId);
  const payloadHash = bundle?.payloadHash ?? null;

  return jsonUtf8({
    publication: serializeSalePublication(publication, { currentPayloadHash: payloadHash }),
    readiness: bundle?.readiness ?? null,
    payloadHash,
  });
});
