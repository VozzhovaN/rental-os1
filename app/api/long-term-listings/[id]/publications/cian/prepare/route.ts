import { jsonUtf8 } from "@/lib/api-json";
import { PublicationError } from "@/lib/publications";
import { prepareCianPublication } from "@/lib/publications/providers/cian";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const POST = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;

  try {
    const result = await prepareCianPublication(id);
    return jsonUtf8({
      publication: result.publication,
      ready: result.preview.ready,
      includedInFeed: true,
      blockers: result.blockers,
      message:
        "Карточка подготовлена к фиду ЦИАН (PUBLISHING). Статус PUBLISHED без подтверждения площадки не выставляется.",
    });
  } catch (error) {
    if (error instanceof PublicationError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return jsonUtf8({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
});
