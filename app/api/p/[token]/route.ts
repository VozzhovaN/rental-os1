import { NextResponse } from "next/server";
import {
  getPresentationByPublicToken,
  isPubliclyAccessible,
} from "@/lib/presentations";
import { toPublicPresentationDTO } from "@/lib/presentation-public";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const presentation = await getPresentationByPublicToken(token);
  if (!presentation || !isPubliclyAccessible(presentation.status)) {
    return NextResponse.json(
      { error: "Презентация недоступна" },
      {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const dto = toPublicPresentationDTO(presentation);
  if (!dto) {
    return NextResponse.json(
      { error: "Презентация недоступна" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { presentation: dto },
    {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    },
  );
}
