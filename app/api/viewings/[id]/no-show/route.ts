import { jsonUtf8 } from "@/lib/api-json";
import { markViewingNoShow, serializeViewing, ViewingError } from "@/lib/viewings";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const POST = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  try {
    const viewing = await markViewingNoShow(id);
    return jsonUtf8({ viewing: serializeViewing(viewing) });
  } catch (error) {
    if (error instanceof ViewingError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return jsonUtf8({ error: error.message }, { status });
    }
    throw error;
  }
});
