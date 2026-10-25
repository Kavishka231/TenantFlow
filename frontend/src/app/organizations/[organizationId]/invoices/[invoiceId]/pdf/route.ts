import { getInvoiceForUser } from "@/lib/invoices/get";
import { buildInvoicePdf } from "@/lib/invoices/pdf";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ organizationId: string; invoiceId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { organizationId, invoiceId } = await params;
  try {
    const organization = await requireOrganizationPermission(user.id, organizationId, "read_invoices");
    const invoice = await getInvoiceForUser(user.id, organization.id, invoiceId);
    if (!invoice) return new Response("Not found", { status: 404 });
    const pdf = buildInvoicePdf(invoice, organization.name);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
        "Content-Type": "application/pdf",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
