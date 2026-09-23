import { NextResponse } from "next/server";
import {
  getPresentationByPublicToken,
  isPubliclyAccessible,
} from "@/lib/presentations";
import { toPublicPresentationDTO } from "@/lib/presentation-public";
import { buildPresentationPdf } from "@/lib/presentation-pdf";

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
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const dto = toPublicPresentationDTO(presentation);
  if (!dto) {
    return NextResponse.json(
      { error: "Презентация недоступна" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const pdf = await buildPresentationPdf(dto);
  const filename = `presentation-${token.slice(0, 8)}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
