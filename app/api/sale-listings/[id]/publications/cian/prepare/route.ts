import { jsonUtf8 } from "@/lib/api-json";
import {
  prepareCianSalePublication,
} from "@/lib/publications/providers/cian/sale";
import { SalePublicationError } from "@/lib/sale-publications";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const POST = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;

  try {
    const result = await prepareCianSalePublication(id);
    return jsonUtf8({
      publication: result.publication,
      prepared: true,
      published: false,
      message: "Подготовлено к отправке",
      cianPayloadHash: result.preview.cianPayloadHash,
      normalizedHash: result.preview.normalizedHash,
      blockers: result.blockers,
    });
  } catch (error) {
    if (error instanceof SalePublicationError) {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400;
      return jsonUtf8({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
});
