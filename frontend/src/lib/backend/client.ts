import "server-only";

import { randomUUID } from "node:crypto";

import { getServerEnv } from "@/lib/env/server";

export type BackendResult =
  | { enabled: false }
  | { enabled: true; data: unknown };

export type BackendBinaryResult =
  | { enabled: false }
  | { enabled: true; data: ArrayBuffer; headers: Headers };

export class BackendApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message = `FastAPI request failed (${status}).`,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "BackendApiError";
  }
}

export class BackendConfigurationError extends Error {
  constructor() {
    super(
      "TENANTFLOW_BACKEND is set to fastapi, but FASTAPI_INTERNAL_URL is not configured.",
    );
    this.name = "BackendConfigurationError";
  }
}

type ErrorEnvelope = {
  error?: { code?: unknown; message?: unknown };
  request_id?: unknown;
};

function backendUrl(path: string, baseUrl: string): URL {
  if (!path.startsWith("/api/v1/")) {
    throw new Error("FastAPI adapter paths must start with /api/v1/.");
  }
  return new URL(path, baseUrl);
}

function requestHeaders(accessToken: string, initHeaders?: HeadersInit): Headers {
  const headers = new Headers(initHeaders);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("X-Request-ID", randomUUID());
  return headers;
}

async function apiError(response: Response): Promise<BackendApiError> {
  const body = (await response.json().catch(() => null)) as ErrorEnvelope | null;
  const code = typeof body?.error?.code === "string" ? body.error.code : undefined;
  const message =
    typeof body?.error?.message === "string"
      ? body.error.message
      : `FastAPI request failed (${response.status}).`;
  const requestId =
    typeof body?.request_id === "string"
      ? body.request_id
      : response.headers.get("X-Request-ID") ?? undefined;
  return new BackendApiError(response.status, code, message, requestId);
}

function configuredBackend() {
  const { FASTAPI_INTERNAL_URL, TENANTFLOW_BACKEND } = getServerEnv();
  if (TENANTFLOW_BACKEND === "typescript") return null;
  if (!FASTAPI_INTERNAL_URL) throw new BackendConfigurationError();
  return FASTAPI_INTERNAL_URL;
}

export async function backendRequest(
  path: string,
  accessToken: string | undefined,
  init: RequestInit = {},
): Promise<BackendResult> {
  const FASTAPI_INTERNAL_URL = configuredBackend();
  if (!FASTAPI_INTERNAL_URL) return { enabled: false };
  if (!accessToken) {
    throw new BackendApiError(
      401,
      "session_required",
      "Your session has expired. Sign in and try again.",
    );
  }

  const response = await fetch(backendUrl(path, FASTAPI_INTERNAL_URL), {
    ...init,
    cache: "no-store",
    headers: requestHeaders(accessToken, init.headers),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw await apiError(response);
  }
  if (response.status === 204) {
    return { enabled: true, data: null };
  }
  return { enabled: true, data: await response.json() };
}

export async function backendBinaryRequest(
  path: string,
  accessToken: string | undefined,
): Promise<BackendBinaryResult> {
  const FASTAPI_INTERNAL_URL = configuredBackend();
  if (!FASTAPI_INTERNAL_URL) return { enabled: false };
  if (!accessToken) {
    throw new BackendApiError(
      401,
      "session_required",
      "Your session has expired. Sign in and try again.",
    );
  }
  const response = await fetch(backendUrl(path, FASTAPI_INTERNAL_URL), {
    cache: "no-store",
    headers: requestHeaders(accessToken),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw await apiError(response);
  return { enabled: true, data: await response.arrayBuffer(), headers: response.headers };
}
