import sharp from "sharp";

export const PROPERTY_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PROPERTY_PHOTO_MAX_EDGE = 2400;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export class PropertyPhotoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PropertyPhotoValidationError";
  }
}

function detectMimeFromMagic(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export type ProcessedPropertyPhoto = {
  bytes: Buffer;
  mimeType: string;
  extension: string;
  width: number;
  height: number;
  sizeBytes: number;
};

/**
 * Validate magic bytes + MIME, normalize orientation, downscale large edges.
 * Does not upscale small images.
 */
export async function processPropertyPhotoUpload(
  input: Buffer,
  claimedMime?: string | null,
): Promise<ProcessedPropertyPhoto> {
  if (!input.length) {
    throw new PropertyPhotoValidationError("Выберите файл изображения");
  }
  if (input.length > PROPERTY_PHOTO_MAX_BYTES) {
    throw new PropertyPhotoValidationError("Файл слишком большой. Максимальный размер — 10 МБ.");
  }

  const magicMime = detectMimeFromMagic(input);
  if (!magicMime || !ALLOWED_MIME.has(magicMime)) {
    throw new PropertyPhotoValidationError("Формат файла не поддерживается.");
  }

  if (claimedMime) {
    const normalized = claimedMime.toLowerCase() === "image/jpg" ? "image/jpeg" : claimedMime.toLowerCase();
    if (normalized && normalized !== magicMime && ALLOWED_MIME.has(normalized) === false) {
      throw new PropertyPhotoValidationError("Формат файла не поддерживается.");
    }
    // Prefer magic over client MIME when they disagree within allowed set
    if (normalized && ALLOWED_MIME.has(normalized) && normalized !== magicMime) {
      // keep magicMime — client lied about type
    }
  }

  let pipeline = sharp(input, { failOn: "error" }).rotate();
  const meta = await pipeline.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    throw new PropertyPhotoValidationError("Формат файла не поддерживается.");
  }

  const largest = Math.max(width, height);
  if (largest > PROPERTY_PHOTO_MAX_EDGE) {
    pipeline = pipeline.resize({
      width: width >= height ? PROPERTY_PHOTO_MAX_EDGE : undefined,
      height: height > width ? PROPERTY_PHOTO_MAX_EDGE : undefined,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  let mimeType = magicMime;
  let extension = "jpg";
  let output: Buffer;

  if (magicMime === "image/png") {
    output = await pipeline.png({ compressionLevel: 8 }).toBuffer();
    extension = "png";
  } else if (magicMime === "image/webp") {
    output = await pipeline.webp({ quality: 82 }).toBuffer();
    extension = "webp";
  } else {
    output = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    mimeType = "image/jpeg";
    extension = "jpg";
  }

  if (output.length > PROPERTY_PHOTO_MAX_BYTES) {
    throw new PropertyPhotoValidationError("Файл слишком большой. Максимальный размер — 10 МБ.");
  }

  const outMeta = await sharp(output).metadata();
  return {
    bytes: output,
    mimeType,
    extension,
    width: outMeta.width ?? width,
    height: outMeta.height ?? height,
    sizeBytes: output.length,
  };
}
