import { jsonError } from "@/lib/api-json";
import { redactSecrets } from "@/lib/integrations/crypto";
import { IntegrationError } from "@/lib/integrations/types";

export function publicIntegrationMessage(error: unknown) {
  if (error instanceof IntegrationError) {
    return redactSecrets(error.message);
  }

  if (error instanceof Error && error.message && !looksInternal(error.message)) {
    return redactSecrets(error.message);
  }

  return "Не удалось выполнить операцию интеграции.";
}

function looksInternal(message: string) {
  return /token|secret|stack|at\s+\S+\s+\(/i.test(message) || message.length > 280;
}

export function integrationErrorStatus(error: IntegrationError) {
  if (error.httpStatus) {
    return error.httpStatus;
  }

  switch (error.code) {
    case "NOT_CONFIGURED":
    case "NOT_CONNECTED":
    case "VALIDATION":
      return 400;
    case "AUTH":
      return 401;
    case "CONFLICT":
      return 409;
    case "RATE_LIMIT":
      return 429;
    default:
      return 502;
  }
}

export function integrationErrorResponse(error: unknown) {
  if (error instanceof IntegrationError) {
    return jsonError(publicIntegrationMessage(error), integrationErrorStatus(error), {
      code: error.code === "CONFLICT" ? "CONFLICT" : "INTEGRATION_ERROR",
    });
  }

  return jsonError(publicIntegrationMessage(error), 500, { code: "INTERNAL_ERROR" });
}
