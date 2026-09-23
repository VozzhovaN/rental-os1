import PDFDocument from "pdfkit";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { PublicPresentationDTO } from "@/lib/presentation-public";
import { getPhotoStorage } from "@/lib/photo-storage";
import { prisma } from "@/lib/prisma";

const FONT_REGULAR = join(process.cwd(), "assets/fonts/PresentationSans.ttf");
const FONT_BOLD = join(process.cwd(), "assets/fonts/PresentationSans-Bold.ttf");

function hasFonts() {
  return existsSync(FONT_REGULAR) && existsSync(FONT_BOLD);
}

async function loadPhotoBuffer(photoId: string): Promise<Buffer | null> {
  const photo = await prisma.propertyPhoto.findUnique({ where: { id: photoId } });
  if (!photo) return null;

  if (photo.storageKey) {
    try {
      const absolute = getPhotoStorage().resolveAbsolutePath(photo.storageKey);
      return readFileSync(absolute);
    } catch {
      return null;
    }
  }

  if (photo.url.startsWith("http://") || photo.url.startsWith("https://")) {
    // SSRF guard: do not fetch arbitrary URLs for PDF.
    return null;
  }

  return null;
}

export async function buildPresentationPdf(
  dto: PublicPresentationDTO,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 48, bottom: 48, left: 48, right: 48 },
    autoFirstPage: true,
    info: {
      Title: dto.title,
      Author: dto.companyName || "Rental OS",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  if (hasFonts()) {
    doc.registerFont("Sans", FONT_REGULAR);
    doc.registerFont("SansBold", FONT_BOLD);
  }

  const font = hasFonts() ? "Sans" : "Helvetica";
  const fontBold = hasFonts() ? "SansBold" : "Helvetica-Bold";

  // Cover
  doc.font(fontBold).fontSize(11).fillColor("#64748B").text("ПЕРСОНАЛЬНОЕ ПРЕДЛОЖЕНИЕ", {
    align: "left",
  });
  doc.moveDown(0.4);
  doc.font(fontBold).fontSize(22).fillColor("#0F172A").text(dto.title, {
    align: "left",
  });
  if (dto.subtitle) {
    doc.moveDown(0.3);
    doc.font(font).fontSize(12).fillColor("#64748B").text(dto.subtitle);
  }

  const coverItem = dto.items[0];
  if (coverItem?.photos[0]) {
    const buf = await loadPhotoBuffer(coverItem.photos[0].id);
    if (buf) {
      doc.moveDown(0.8);
      try {
        doc.image(buf, {
          fit: [500, 280],
          align: "center",
        });
      } catch {
        // skip broken image
      }
    }
  }

  doc.moveDown(1);
  const cities = [...new Set(dto.items.map((i) => i.city).filter(Boolean))];
  doc.font(font).fontSize(11).fillColor("#475569").text(cities.join(" · ") || "");
  doc.moveDown(0.3);
  doc
    .font(font)
    .fontSize(10)
    .fillColor("#94A3B8")
    .text(
      `${new Date().toLocaleDateString("ru-RU")} · ${dto.companyName || "Rental OS"}`,
    );

  for (const [index, item] of dto.items.entries()) {
    doc.addPage();
    doc.font(fontBold).fontSize(10).fillColor("#64748B").text(`Вариант ${index + 1}`);
    doc.moveDown(0.3);

    const titleY = doc.y;
    doc.font(fontBold).fontSize(18).fillColor("#0F172A").text(item.title, {
      width: 300,
      continued: false,
    });
    if (item.priceLabel) {
      doc
        .font(fontBold)
        .fontSize(14)
        .fillColor("#3977F6")
        .text(item.priceLabel, 350, titleY, { width: 150, align: "right" });
    }
    doc.moveDown(0.6);

    const cover = item.photos[0];
    if (cover) {
      const buf = await loadPhotoBuffer(cover.id);
      if (buf) {
        try {
          doc.image(buf, { fit: [500, 260], align: "center" });
          doc.moveDown(0.6);
        } catch {
          /* skip */
        }
      }
    }

    const facts = [
      item.areaLabel,
      item.rooms != null ? `${item.rooms} комн.` : null,
      item.bedrooms != null ? `${item.bedrooms} спальни` : null,
      item.guests != null ? `до ${item.guests} гостей` : null,
      item.floor != null
        ? item.totalFloors != null
          ? `${item.floor}/${item.totalFloors} этаж`
          : `${item.floor} этаж`
        : null,
    ].filter(Boolean) as string[];

    if (facts.length) {
      doc.font(font).fontSize(11).fillColor("#334155").text(facts.join("  ·  "));
      doc.moveDown(0.5);
    }

    if (item.description) {
      doc.font(fontBold).fontSize(12).fillColor("#0F172A").text("Об объекте");
      doc.moveDown(0.25);
      doc.font(font).fontSize(10).fillColor("#334155").text(item.description, {
        align: "left",
        lineGap: 2,
      });
      doc.moveDown(0.6);
    }

    // Photo grid page
    const gridPhotos = item.photos.slice(1, 5);
    if (gridPhotos.length > 0) {
      if (doc.y > 620) doc.addPage();
      doc.font(fontBold).fontSize(12).fillColor("#0F172A").text("Фотографии");
      doc.moveDown(0.4);
      let x = doc.page.margins.left;
      let y = doc.y;
      const cellW = 240;
      const cellH = 150;
      for (let i = 0; i < gridPhotos.length; i += 1) {
        const photo = gridPhotos[i]!;
        const buf = await loadPhotoBuffer(photo.id);
        if (buf) {
          try {
            doc.image(buf, x, y, { fit: [cellW, cellH] });
          } catch {
            /* skip */
          }
        }
        if (i % 2 === 0) {
          x = doc.page.margins.left + cellW + 16;
        } else {
          x = doc.page.margins.left;
          y += cellH + 12;
        }
      }
      doc.y = y + (gridPhotos.length % 2 === 1 ? cellH + 12 : 0);
    }

    for (const section of item.sections) {
      if (!section.content.trim()) continue;
      if (doc.y > 680) doc.addPage();
      doc.moveDown(0.5);
      doc.font(fontBold).fontSize(12).fillColor("#0F172A").text(section.title);
      doc.moveDown(0.25);
      const lines = section.content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          doc.moveDown(0.2);
          continue;
        }
        if (doc.y > 760) doc.addPage();
        if (/^[•\-✓*]/.test(trimmed) || /^\d+\./.test(trimmed)) {
          doc.font(font).fontSize(10).fillColor("#334155").text(`  ${trimmed}`, {
            lineGap: 2,
          });
        } else {
          doc.font(font).fontSize(10).fillColor("#334155").text(trimmed, {
            lineGap: 2,
          });
        }
      }
    }
  }

  // Contacts
  doc.addPage();
  doc.font(fontBold).fontSize(16).fillColor("#0F172A").text("Свяжитесь с нами");
  doc.moveDown(0.5);
  doc
    .font(font)
    .fontSize(11)
    .fillColor("#475569")
    .text(
      "Понравился этот вариант? Поможем уточнить детали и организовать просмотр или бронирование.",
    );
  doc.moveDown(0.8);
  if (dto.contactName) {
    doc.font(fontBold).fontSize(11).fillColor("#0F172A").text(dto.contactName);
  }
  if (dto.contactPhone) {
    doc.font(font).fontSize(11).fillColor("#334155").text(dto.contactPhone);
  }
  if (dto.contactEmail) {
    doc.font(font).fontSize(11).fillColor("#334155").text(dto.contactEmail);
  }
  doc.moveDown(1);
  doc.font(font).fontSize(9).fillColor("#94A3B8").text(dto.companyName || "Rental OS");

  // Comparison for multi
  if (dto.items.length > 1) {
    doc.addPage();
    doc.font(fontBold).fontSize(16).fillColor("#0F172A").text("Сравнение вариантов");
    doc.moveDown(0.6);
    const headers = ["", ...dto.items.map((_, i) => `№${i + 1}`)];
    const rows: string[][] = [
      ["Цена", ...dto.items.map((i) => i.priceLabel || "—")],
      ["Площадь", ...dto.items.map((i) => i.areaLabel || "—")],
      ["Комнаты", ...dto.items.map((i) => (i.rooms != null ? String(i.rooms) : "—"))],
      ["Спальни", ...dto.items.map((i) => (i.bedrooms != null ? String(i.bedrooms) : "—"))],
      ["Гостей", ...dto.items.map((i) => (i.guests != null ? String(i.guests) : "—"))],
      ["Локация", ...dto.items.map((i) => i.city || "—")],
    ];

    const colW = 110;
    doc.font(fontBold).fontSize(9).fillColor("#64748B");
    headers.forEach((h, idx) => {
      doc.text(h, 48 + idx * colW, doc.y, { width: colW - 6, continued: idx < headers.length - 1 });
    });
    doc.text("");
    doc.moveDown(0.3);

    for (const row of rows) {
      if (doc.y > 760) doc.addPage();
      doc.font(font).fontSize(9).fillColor("#0F172A");
      row.forEach((cell, idx) => {
        doc.text(cell, 48 + idx * colW, doc.y, {
          width: colW - 6,
          continued: idx < row.length - 1,
        });
      });
      doc.text("");
      doc.moveDown(0.35);
    }
  }

  doc.end();
  return done;
}
