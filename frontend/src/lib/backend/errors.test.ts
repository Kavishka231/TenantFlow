import { describe, expect, it } from "vitest";

import { BackendApiError, BackendConfigurationError } from "./client";
import { backendActionErrorMessage, backendRouteError } from "./errors";

describe("backend action error messages", () => {
  it("distinguishes expired sessions and denied permissions", () => {
    expect(
      backendActionErrorMessage(
        new BackendApiError(401, "invalid_access_token"),
        "Request failed.",
      ),
    ).toContain("session has expired");
    expect(
      backendActionErrorMessage(
        new BackendApiError(403, "permission_denied"),
        "Request failed.",
      ),
    ).toContain("do not have permission");
  });

  it("keeps safe validation messages and support references", () => {
    expect(
      backendActionErrorMessage(
        new BackendApiError(409, "payment_conflict", "Payment exceeds the balance."),
        "Request failed.",
      ),
    ).toBe("Payment exceeds the balance.");
    expect(
      backendActionErrorMessage(
        new BackendApiError(503, "unavailable", "Unavailable", "request-123"),
        "Request failed.",
      ),
    ).toBe("Request failed. Reference: request-123.");
  });

  it("reports fail-closed deployment configuration", () => {
    expect(
      backendActionErrorMessage(new BackendConfigurationError(), "Request failed."),
    ).toContain("not configured");
  });

  it("maps download failures without exposing cross-tenant resources", () => {
    expect(backendRouteError(new BackendApiError(401, "invalid_access_token"))).toMatchObject({
      status: 401,
    });
    expect(backendRouteError(new BackendApiError(403, "permission_denied"))).toEqual({
      message: "Not found",
      requestId: undefined,
      status: 404,
    });
    expect(backendRouteError(new BackendConfigurationError())).toMatchObject({
      status: 503,
    });
  });
});
