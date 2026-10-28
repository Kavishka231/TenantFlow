import { NextResponse } from "next/server";

import { getExpenseForUser } from "@/lib/expenses/data";
import { EXPENSE_RECEIPT_BUCKET } from "@/lib/expenses/receipts";
import { requireOrganizationPermission } from "@/lib/organizations/authorization";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, context: { params: Promise<{ organizationId: string; expenseId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  const { organizationId, expenseId } = await context.params;
  try { await requireOrganizationPermission(user.id, organizationId, "read_expenses"); }
  catch { return new NextResponse("Not found", { status: 404 }); }
  const expense = await getExpenseForUser(user.id, organizationId, expenseId);
  if (!expense?.receiptPath || !expense.receiptName) return new NextResponse("Not found", { status: 404 });
  const { data, error } = await supabase.storage.from(EXPENSE_RECEIPT_BUCKET).createSignedUrl(expense.receiptPath, 60, { download: expense.receiptName });
  if (error || !data) return new NextResponse("Receipt unavailable", { status: 502 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
}
