import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/auth/with-api-auth";
import { jsonError } from "@/lib/api-json";
import { getPresentationById } from "@/lib/presentations";
import { toPublicPresentationDTO } from "@/lib/presentation-public";
import { buildPresentationPdf } from "@/lib/presentation-pdf";

export const GET = withApiAuth(async (
  _request: Request,
  context: { params: Promise<{ id: string }> },
) => {
  const { id } = await context.params;
  const presentation = await getPresentationById(id);
  if (!presentation) {
    return jsonError("Презентация не найдена", 404, { code: "NOT_FOUND" });
  }

  // CRM preview PDF allowed for any status except we still build public-shaped DTO.
  // Force public DTO by temporarily treating as READY for serialization shape only.
  const dto = toPublicPresentationDTO({
    ...presentation,
    status: "READY",
  });
  if (!dto) {
    return jsonError("Не удалось сформировать PDF", 400, {
      code: "VALIDATION_ERROR",
    });
  }

  const pdf = await buildPresentationPdf(dto);
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="presentation-${id.slice(0, 8)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});
