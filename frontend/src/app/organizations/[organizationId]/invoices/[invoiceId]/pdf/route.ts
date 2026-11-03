import { getInvoicePdfThroughBackend } from "@/lib/backend/invoices";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ organizationId: string; invoiceId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { organizationId, invoiceId } = await params;
  try {
    const organization = await requireOrganizationPermission(user.id, organizationId, "read_invoices");
    const { data: { session } } = await supabase.auth.getSession();
    const pdf = await getInvoicePdfThroughBackend(user.id, session?.access_token, organization.id, invoiceId, organization.name);
    if (!pdf) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": "attachment; filename=invoice.pdf",
        "Content-Type": "application/pdf",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
