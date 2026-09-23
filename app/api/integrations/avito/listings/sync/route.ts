import { NextResponse } from "next/server";
import { syncListings } from "@/lib/integrations/avito-service";
import { integrationErrorResponse } from "@/lib/integrations/errors";
import { withApiAuth } from "@/lib/auth/with-api-auth";

export const POST = withApiAuth(async (_request: Request) => {
  try {
    const listings = await syncListings();
    return NextResponse.json({ listings, count: listings.length });
  } catch (error) {
    return integrationErrorResponse(error);
  }
});
