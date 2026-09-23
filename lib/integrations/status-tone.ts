import type { IntegrationStatus, SyncLogStatus } from "@prisma/client";
import type { StatusBadgeTone } from "@/components/crm/status-badge";

export function integrationStatusTone(status: IntegrationStatus): StatusBadgeTone {
  switch (status) {
    case "CONNECTED":
    case "SYNCING":
      return "success";
    case "CONNECTING":
      return "info";
    case "ERROR":
      return "danger";
    case "DISCONNECTED":
    default:
      return "neutral";
  }
}

export function syncLogStatusTone(status: SyncLogStatus): StatusBadgeTone {
  switch (status) {
    case "SUCCESS":
      return "success";
    case "ERROR":
      return "danger";
    case "STARTED":
      return "info";
    case "SKIPPED":
    default:
      return "neutral";
  }
}
