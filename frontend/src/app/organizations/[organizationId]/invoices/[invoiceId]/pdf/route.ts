import { getInvoicePdfThroughBackend } from "@/lib/backend/invoices";
import { backendRouteError } from "@/lib/backend/errors";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ organizationId: string; invoiceId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { organizationId, invoiceId } = await params;
  let organization;
  try {
    organization = await requireOrganizationPermission(user.id, organizationId, "read_invoices");
  } catch {
    return new Response("Not found", { status: 404 });
  }
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const download = await getInvoicePdfThroughBackend(user.id, session?.access_token, organization.id, invoiceId, organization.name);
    if (!download) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(download.pdf), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": download.contentDisposition,
        "Content-Type": "application/pdf",
      },
    });
  } catch (error) {
    const failure = backendRouteError(error);
    return new Response(failure.message, {
      headers: failure.requestId ? { "X-Request-ID": failure.requestId } : undefined,
      status: failure.status,
    });
  }
}
