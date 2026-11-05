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
