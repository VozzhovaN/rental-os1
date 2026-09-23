import { jsonUtf8 } from "@/lib/api-json";
import { getSaleListingById } from "@/lib/sale-listings";
import {
  createSalePublication,
  getSaleListingPublicationBundle,
  SalePublicationError,
  serializeSalePublication,
} from "@/lib/sale-publications";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  formatSalePublicationZodError,
  parseCreateSalePublication,
} from "@/lib/validations/sale-publication";

function salePublicationErrorResponse(error: unknown) {
  if (error instanceof SalePublicationError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400;
    return jsonUtf8({ error: error.message, code: error.code }, { status });
  }
  throw error;
}

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const bundle = await getSaleListingPublicationBundle(id);
  if (!bundle) {
    return jsonUtf8({ error: "Карточка продажи не найдена" }, { status: 404 });
  }

  return jsonUtf8({
    publications: bundle.publications,
    readiness: bundle.readiness,
    payloadHash: bundle.payloadHash,
  });
});

export const POST = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const listing = await getSaleListingById(id);
  if (!listing) {
    return jsonUtf8({ error: "Карточка продажи не найдена" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonUtf8({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = parseCreateSalePublication(body);
  if (!parsed.success) {
    return jsonUtf8(
      { error: "Ошибка валидации", details: formatSalePublicationZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const result = await createSalePublication({
      saleListingId: id,
      salesChannelId: parsed.data.salesChannelId,
    });
    return jsonUtf8(
      {
        publication: serializeSalePublication(result.publication),
        created: result.created,
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    return salePublicationErrorResponse(error);
  }
});
