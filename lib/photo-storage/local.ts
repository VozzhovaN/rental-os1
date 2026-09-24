import { randomUUID } from "crypto";
import { access, mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import type { PhotoStorage, SavedPhotoObject } from "@/lib/photo-storage/types";

/**
 * Storage root for uploaded photo bytes.
 * Configurable via PHOTO_STORAGE_ROOT so deployments (e.g. a course demo on a
 * persistent volume) can point uploads at durable storage. Local dev falls back
 * to <cwd>/storage. Domain logic never hardcodes a platform-specific path.
 */
const STORAGE_ROOT = process.env.PHOTO_STORAGE_ROOT?.trim()
  ? path.resolve(process.env.PHOTO_STORAGE_ROOT.trim())
  : path.join(process.cwd(), "storage");

function assertSafePropertyId(propertyId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(propertyId)) {
    throw new Error("Некорректный идентификатор объекта");
  }
}

/**
 * Validate storageKey: must be properties/{id}/{uuid}.{ext} with no traversal.
 */
export function assertSafeStorageKey(storageKey: string): string {
  const normalized = storageKey.replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    normalized.includes("..") ||
    normalized.includes("\0") ||
    path.isAbsolute(normalized) ||
    !/^properties\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\.(jpe?g|png|webp)$/i.test(normalized)
  ) {
    throw new Error("Некорректный storageKey");
  }
  return normalized;
}

export class LocalPhotoStorage implements PhotoStorage {
  async save(input: {
    propertyId: string;
    bytes: Buffer;
    mimeType: string;
    extension: string;
  }): Promise<SavedPhotoObject> {
    assertSafePropertyId(input.propertyId);
    const extension = input.extension.toLowerCase().replace(/^\./, "");
    if (!["jpg", "jpeg", "png", "webp"].includes(extension)) {
      throw new Error("Недопустимое расширение");
    }
    const safeExt = extension === "jpeg" ? "jpg" : extension;
    const fileName = `${randomUUID()}.${safeExt}`;
    const storageKey = assertSafeStorageKey(`properties/${input.propertyId}/${fileName}`);
    const absolutePath = path.join(STORAGE_ROOT, ...storageKey.split("/"));
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.bytes, { flag: "wx" });
    return {
      storageKey,
      absolutePath,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.length,
      extension: safeExt,
    };
  }

  async delete(storageKey: string): Promise<void> {
    const absolutePath = this.resolveAbsolutePath(storageKey);
    try {
      await unlink(absolutePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw error;
      }
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await access(this.resolveAbsolutePath(storageKey));
      return true;
    } catch {
      return false;
    }
  }

  resolveAbsolutePath(storageKey: string): string {
    const safe = assertSafeStorageKey(storageKey);
    const absolutePath = path.join(STORAGE_ROOT, ...safe.split("/"));
    const resolved = path.resolve(absolutePath);
    const root = path.resolve(STORAGE_ROOT);
    if (!resolved.startsWith(root + path.sep) && resolved !== root) {
      throw new Error("Некорректный storageKey");
    }
    return resolved;
  }

  getLocalPreviewPath(storageKey: string): string {
    return assertSafeStorageKey(storageKey);
  }
}

let singleton: LocalPhotoStorage | null = null;

export function getPhotoStorage(): PhotoStorage {
  if (!singleton) {
    singleton = new LocalPhotoStorage();
  }
  return singleton;
}
