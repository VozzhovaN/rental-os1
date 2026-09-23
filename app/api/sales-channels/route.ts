import { NextResponse } from "next/server";
import { getActiveSalesChannels, serializeSalesChannel } from "@/lib/sales-channels";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const GET = withApiAuth(async (_request: Request) => {
  const salesChannels = (await getActiveSalesChannels()).map(serializeSalesChannel);
  return NextResponse.json({ salesChannels });
});
