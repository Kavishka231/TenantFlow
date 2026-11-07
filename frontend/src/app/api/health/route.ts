import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    { service: "tenantflow-frontend", status: "ok" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
