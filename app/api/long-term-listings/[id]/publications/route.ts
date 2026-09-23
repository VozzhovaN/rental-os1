import { jsonUtf8 } from "@/lib/api-json";
import {
  createPublication,
  getPublicationsForListing,
  PublicationError,
  serializePublication,
} from "@/lib/publications";
import { getLongTermListingById } from "@/lib/long-term-listings";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  formatPublicationZodError,
  parseCreatePublication,
} from "@/lib/validations/publication";

function publicationErrorResponse(error: unknown) {
  if (error instanceof PublicationError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400;
    return jsonUtf8({ error: error.message, code: error.code }, { status });
  }

  throw error;
}

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const listing = await getLongTermListingById(id);

  if (!listing) {
    return jsonUtf8({ error: "Карточка долгосрочной аренды не найдена" }, { status: 404 });
  }

  const publications = (await getPublicationsForListing(id)).map(serializePublication);
  return jsonUtf8({ publications });
});

export const POST = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonUtf8({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = parseCreatePublication(body);

  if (!parsed.success) {
    return jsonUtf8(
      { error: "Ошибка валидации", details: formatPublicationZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const result = await createPublication({
      longTermListingId: id,
      salesChannelId: parsed.data.salesChannelId,
    });
    return jsonUtf8(
      { publication: serializePublication(result.publication), created: result.created },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    return publicationErrorResponse(error);
  }
});
