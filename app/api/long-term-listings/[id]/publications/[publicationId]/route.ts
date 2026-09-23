import { jsonUtf8 } from "@/lib/api-json";
import { getLongTermListingById } from "@/lib/long-term-listings";
import { getPublicationForListing, serializePublication } from "@/lib/publications";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string; publicationId: string }> },) => {
  const { id, publicationId } = await context.params;
  const listing = await getLongTermListingById(id);

  if (!listing) {
    return jsonUtf8({ error: "Карточка долгосрочной аренды не найдена" }, { status: 404 });
  }

  const publication = await getPublicationForListing(id, publicationId);

  if (!publication) {
    return jsonUtf8({ error: "Публикация не найдена" }, { status: 404 });
  }

  return jsonUtf8({ publication: serializePublication(publication) });
});
