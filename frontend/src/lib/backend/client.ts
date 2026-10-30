import "server-only";

import { randomUUID } from "node:crypto";

import { getServerEnv } from "@/lib/env/server";

export type BackendResult =
  | { enabled: false }
  | { enabled: true; data: unknown };

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
    throw new Error(`FastAPI request failed (${response.status}).`);
  }
  if (response.status === 204) {
    return { enabled: true, data: null };
  }
  return { enabled: true, data: await response.json() };
}
