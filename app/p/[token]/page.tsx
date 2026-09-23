import { notFound } from "next/navigation";
import { PublicPresentationView } from "@/components/presentations/public-presentation-view";
import {
  getPresentationByPublicToken,
  isPubliclyAccessible,
} from "@/lib/presentations";
import { toPublicPresentationDTO } from "@/lib/presentation-public";

export const dynamic = "force-dynamic";

export default async function PublicPresentationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 16) notFound();

  const presentation = await getPresentationByPublicToken(token);
  if (!presentation || !isPubliclyAccessible(presentation.status)) {
    notFound();
  }

  const dto = toPublicPresentationDTO(presentation);
  if (!dto) notFound();

  return <PublicPresentationView presentation={dto} />;
}
