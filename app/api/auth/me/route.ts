import { withApiAuth } from "@/lib/auth/with-api-auth";
import { jsonUtf8 } from "@/lib/api-json";
import { requireAuth } from "@/lib/auth/require-auth";

export const GET = withApiAuth(async (request: Request) => {
  const { user } = await requireAuth(request);
  return jsonUtf8({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  });
});
