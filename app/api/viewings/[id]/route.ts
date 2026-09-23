import { jsonUtf8 } from "@/lib/api-json";
import { getViewingById, serializeViewing } from "@/lib/viewings";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const GET = withApiAuth(async (request: Request,
  context: { params: Promise<{ id: string }> },) => {
  const { id } = await context.params;
  const viewing = await getViewingById(id);
  if (!viewing) {
    return jsonUtf8({ error: "Показ не найден" }, { status: 404 });
  }
  return jsonUtf8({ viewing: serializeViewing(viewing) });
});
