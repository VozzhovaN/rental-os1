/**
 * PRODUCTION_PHOTO_STORAGE_BACKUP_REQUIREMENT (Stage 13)
 *
 * Local CRM photo bytes live under `/storage/properties/...` (not in SQLite).
 * Any production backup / restore must include:
 *   1) DATABASE dump
 *   2) PHOTO STORAGE directory (or object-storage bucket)
 *
 * Restoring DB without photo storage leaves orphaned PropertyPhoto.storageKey rows.
 */

export type SavedPhotoObject = {
  storageKey: string;
  absolutePath: string;
  mimeType: string;
  sizeBytes: number;
  extension: string;
};

export type PhotoStorage = {
  /** Persist bytes; returns opaque storageKey (never use client filename). */
  save(input: {
    propertyId: string;
    bytes: Buffer;
    mimeType: string;
    extension: string;
  }): Promise<SavedPhotoObject>;
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
  /** Absolute filesystem path for local reads; throws if key invalid. */
  resolveAbsolutePath(storageKey: string): string;
  /** Relative CRM file URL path segment helper — business layer builds full API URL. */
  getLocalPreviewPath(storageKey: string): string;
};
