import "server-only";

import { BackendApiError, BackendConfigurationError } from "@/lib/backend/client";

export function backendActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof BackendConfigurationError) {
    return "The application service is not configured. Contact the administrator.";
  }
  if (!(error instanceof BackendApiError)) return fallback;
  if (error.status === 401) {
    return "Your session has expired. Sign in again before retrying.";
  }
  if (error.status === 403) {
    return "You do not have permission to perform this action.";
  }
  if (error.status === 409 || error.status === 422) return error.message;
  return error.requestId ? `${fallback} Reference: ${error.requestId}.` : fallback;
}

export function backendRouteError(error: unknown): {
  message: string;
  requestId?: string;
  status: number;
} {
  if (error instanceof BackendConfigurationError) {
    return { message: "Application service unavailable", status: 503 };
  }
  if (!(error instanceof BackendApiError)) {
    return { message: "Upstream service unavailable", status: 502 };
  }
  if (error.status === 401) {
    return {
      message: "Your session has expired. Sign in again.",
      requestId: error.requestId,
      status: 401,
    };
  }
  if (error.status === 403 || error.status === 404) {
    return { message: "Not found", requestId: error.requestId, status: 404 };
  }
  return {
    message: "Upstream service unavailable",
    requestId: error.requestId,
    status: 502,
  };
}
