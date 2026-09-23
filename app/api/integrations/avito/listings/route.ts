import { NextResponse } from "next/server";
import { getAvitoListings } from "@/lib/integrations/avito-service";
import { integrationErrorResponse } from "@/lib/integrations/errors";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const GET = withApiAuth(async (_request: Request) => {
  try {
    const listings = await getAvitoListings();
    return NextResponse.json({ listings });
  } catch (error) {
    return integrationErrorResponse(error);
  }
});
