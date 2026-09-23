export function integrationLog(event: {
  integration: string;
  operation: string;
  direction?: "IMPORT" | "EXPORT";
  externalId?: string | null;
  status: "SUCCESS" | "ERROR" | "STARTED" | "SKIPPED";
  durationMs?: number;
  errorCode?: string | null;
}) {
  console.info(
    JSON.stringify({
      integration: event.integration,
      operation: event.operation,
      direction: event.direction ?? null,
      externalId: event.externalId ?? null,
      status: event.status,
      durationMs: event.durationMs ?? null,
      errorCode: event.errorCode ?? null,
    }),
  );
}
