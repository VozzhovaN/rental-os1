# PRODUCTION_PHOTO_STORAGE_BACKUP_REQUIREMENT (Stage 13)

Local CRM stores property photo **bytes** under `storage/properties/{propertyId}/`.
SQLite / Prisma only store metadata (`PropertyPhoto.storageKey`, `url`, etc.).

Production backup and restore **must** include:

1. Database dump
2. Photo storage directory (or future object-storage bucket)

Restoring the database alone leaves broken `storageKey` references.
