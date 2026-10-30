import "server-only";

import { randomUUID } from "node:crypto";

import { getServerEnv } from "@/lib/env/server";

export type BackendResult =
  | { enabled: false }
  | { enabled: true; data: unknown };

export class BackendApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
  ) {
    super(`FastAPI request failed (${status}).`);
    this.name = "BackendApiError";
  }
}

export async function backendRequest(
  path: string,
  accessToken: string | undefined,
  init: RequestInit = {},
): Promise<BackendResult> {
  const { FASTAPI_INTERNAL_URL } = getServerEnv();
  if (!FASTAPI_INTERNAL_URL) {
    return { enabled: false };
  }
  if (!accessToken) {
    throw new Error("An authenticated Supabase session is required.");
  }

  const response = await fetch(new URL(path, FASTAPI_INTERNAL_URL), {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Request-ID": randomUUID(),
      ...init.headers,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const code =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "object" &&
      body.error !== null &&
      "code" in body.error &&
      typeof body.error.code === "string"
        ? body.error.code
        : undefined;
    throw new BackendApiError(response.status, code);
  }
  if (response.status === 204) {
    return { enabled: true, data: null };
  }
  return { enabled: true, data: await response.json() };
}
