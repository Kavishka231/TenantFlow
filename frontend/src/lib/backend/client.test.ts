import { afterEach, describe, expect, it, vi } from "vitest";

import { backendRequest, BackendApiError } from "./client";

const databaseUrl = "postgresql://runtime:secret@localhost:5432/postgres";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("FastAPI server adapter", () => {
  it("uses the TypeScript fallback when FastAPI is not configured", async () => {
    vi.stubEnv("DATABASE_URL", databaseUrl);
    delete process.env.FASTAPI_INTERNAL_URL;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await backendRequest("/api/v1/organizations", undefined);

    expect(result).toEqual({ enabled: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("forwards the Supabase bearer token only from the server", async () => {
    vi.stubEnv("DATABASE_URL", databaseUrl);
    vi.stubEnv("FASTAPI_INTERNAL_URL", "http://127.0.0.1:8000");
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: "organization" }]), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const result = await backendRequest("/api/v1/organizations", "access-token");

    expect(result).toEqual({ enabled: true, data: [{ id: "organization" }] });
    const [, request] = fetchSpy.mock.calls[0] as [URL, RequestInit];
    expect(request.headers).toMatchObject({
      Authorization: "Bearer access-token",
    });
    expect(request.cache).toBe("no-store");
  });

  it("preserves stable FastAPI error codes", async () => {
    vi.stubEnv("DATABASE_URL", databaseUrl);
    vi.stubEnv("FASTAPI_INTERNAL_URL", "http://127.0.0.1:8000");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "organization_not_found", message: "Not found" },
          }),
          { headers: { "Content-Type": "application/json" }, status: 404 },
        ),
      ),
    );

    await expect(
      backendRequest("/api/v1/organizations/missing", "access-token"),
    ).rejects.toMatchObject<Partial<BackendApiError>>({
      code: "organization_not_found",
      status: 404,
    });
  });
});
