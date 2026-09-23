import { jsonUtf8 } from "@/lib/api-json";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import {
  prepareSalePublication,
  SalePublicationError,
  serializeSalePublication,
} from "@/lib/sale-publications";

export const POST = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;

  try {
    const result = await prepareSalePublication(id);
    return jsonUtf8({
      publication: serializeSalePublication(result.publication, {
        currentPayloadHash: result.payloadHash,
      }),
      readiness: result.readiness,
      payloadHash: result.payloadHash,
      prepared: true,
      published: false,
      message: "Подготовлено к отправке",
      providerMappingStatus: result.providerMappingStatus,
    });
  } catch (error) {
    if (error instanceof SalePublicationError) {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "CONFLICT" ? 409 : 400;
      return jsonUtf8({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
});
