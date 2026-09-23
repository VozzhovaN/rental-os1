import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { prepareTestDatabase, resetFixtures } from "../helpers/db";
import {
  createPresentation,
  getPresentationByPublicToken,
  isPubliclyAccessible,
  updatePresentation,
} from "@/lib/presentations";
import { toPublicPresentationDTO } from "@/lib/presentation-public";
import { buildPresentationPdf } from "@/lib/presentation-pdf";
import { prisma } from "@/lib/prisma";

describe("presentations (stage 12.6.4)", () => {
  before(async () => {
    await prepareTestDatabase();
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it("creates presentation with public token; draft not public; publish exposes DTO without owner", async () => {
    const { property } = await resetFixtures();

    const created = await createPresentation({
      kind: "SHORT_TERM",
      propertyIds: [property.id],
      title: "Тест презентации",
    });

    assert.ok(created.publicToken.length >= 24);
    assert.equal(created.status, "DRAFT");
    assert.equal(isPubliclyAccessible(created.status), false);
    assert.equal(toPublicPresentationDTO(created), null);

    const published = await updatePresentation(created.id, {
      status: "PUBLISHED",
      contactName: "Менеджер",
      contactPhone: "+7 900 000-00-00",
    });
    assert.ok(published);
    assert.equal(isPubliclyAccessible(published.status), true);

    const dto = toPublicPresentationDTO(published);
    assert.ok(dto);
    assert.equal(dto.title, "Тест презентации");
    assert.equal(dto.contactName, "Менеджер");
    assert.ok(!JSON.stringify(dto).includes(property.ownerPhone));
    assert.ok(!JSON.stringify(dto).includes("commission"));
    assert.ok(!("internalNote" in dto));

    const byToken = await getPresentationByPublicToken(created.publicToken);
    assert.ok(byToken);

    const archived = await updatePresentation(created.id, { status: "ARCHIVED" });
    assert.ok(archived);
    assert.equal(toPublicPresentationDTO(archived), null);
  });

  it("builds PDF buffer with Cyrillic title", async () => {
    const { property } = await resetFixtures();
    const created = await createPresentation({
      kind: "SHORT_TERM",
      propertyIds: [property.id],
      title: "Ришелье Шато · Ялта",
    });
    await updatePresentation(created.id, { status: "READY" });
    const ready = await getPresentationByPublicToken(created.publicToken);
    assert.ok(ready);
    const dto = toPublicPresentationDTO(ready);
    assert.ok(dto);
    const pdf = await buildPresentationPdf(dto);
    assert.ok(pdf.length > 500);
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  });
});
