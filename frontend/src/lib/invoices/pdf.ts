import type { InvoiceDetail } from "./get";
import { formatMinorUnits } from "./money";

function pdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/([\\()])/g, "\\$1");
}

function invoiceLines(invoice: InvoiceDetail, organizationName: string) {
  const lines = [
    organizationName,
    `INVOICE ${invoice.invoiceNumber}`,
    "",
    `Customer: ${invoice.customerName}`,
    `Issue date: ${invoice.issueDate}`,
    `Due date: ${invoice.dueDate}`,
    `Status: ${invoice.status.replace("_", " ").toUpperCase()}`,
    "",
    "ITEMS",
    ...invoice.items.flatMap((item) => [
      `${item.quantity} x ${item.description}`,
      `    ${formatMinorUnits(item.lineTotalMinor, invoice.currency)}`,
    ]),
    "",
    `Subtotal: ${formatMinorUnits(invoice.subtotalMinor, invoice.currency)}`,
    `Discount: ${formatMinorUnits(invoice.discountMinor, invoice.currency)}`,
    `Tax: ${formatMinorUnits(invoice.taxMinor, invoice.currency)}`,
    `Total: ${formatMinorUnits(invoice.totalMinor, invoice.currency)}`,
    `Paid: ${formatMinorUnits(invoice.paidMinor, invoice.currency)}`,
    `Outstanding: ${formatMinorUnits(invoice.totalMinor - invoice.paidMinor, invoice.currency)}`,
  ];
  if (invoice.notes) lines.push("", "NOTES", ...invoice.notes.split(/\r?\n/));
  return lines;
}

export function buildInvoicePdf(invoice: InvoiceDetail, organizationName: string) {
  const allLines = invoiceLines(invoice, organizationName);
  const pages: string[][] = [];
  for (let index = 0; index < allLines.length; index += 48) pages.push(allLines.slice(index, index + 48));

  const pageIds = pages.map((_, index) => 4 + index * 2);
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  pages.forEach((lines, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const commands = `BT /F1 10 Tf 50 790 Td 14 TL ${lines.map((line) => `(${pdfText(line)}) Tj T*`).join(" ")} ET`;
    objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId - 1] = `<< /Length ${Buffer.byteLength(commands, "ascii")} >>\nstream\n${commands}\nendstream`;
  });

  let output = "%PDF-1.4\n%TenantFlow\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(output, "ascii");
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(output, "ascii");
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(output, "ascii");
}
