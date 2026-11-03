from app.invoices.schemas import InvoiceDetailResponse


def pdf_text(value: str) -> str:
    return (
        value.encode("ascii", "replace")
        .decode("ascii")
        .replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
    )


def build_invoice_pdf(invoice: InvoiceDetailResponse, organization_name: str) -> bytes:
    lines = [
        organization_name,
        f"INVOICE {invoice.invoice_number}",
        "",
        f"Customer: {invoice.customer_name}",
        f"Issue date: {invoice.issue_date.isoformat()}",
        f"Due date: {invoice.due_date.isoformat()}",
        f"Status: {invoice.status.value.replace('_', ' ').upper()}",
        "",
        "ITEMS",
    ]
    for item in invoice.items:
        lines.extend(
            (
                f"{item.quantity} x {item.description}",
                f"    {item.line_total_minor} {invoice.currency} minor units",
            )
        )
    lines.extend(
        (
            "",
            f"Subtotal: {invoice.subtotal_minor} {invoice.currency} minor units",
            f"Discount: {invoice.discount_minor} {invoice.currency} minor units",
            f"Tax: {invoice.tax_minor} {invoice.currency} minor units",
            f"Total: {invoice.total_minor} {invoice.currency} minor units",
            f"Paid: {invoice.paid_minor} {invoice.currency} minor units",
            "Outstanding: "
            f"{invoice.total_minor - invoice.paid_minor} "
            f"{invoice.currency} minor units",
        )
    )
    if invoice.notes:
        lines.extend(("", "NOTES", *invoice.notes.splitlines()))
    pages = [lines[index : index + 48] for index in range(0, len(lines), 48)] or [[]]
    page_ids = [4 + index * 2 for index in range(len(pages))]
    objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids ["
        + " ".join(f"{item} 0 R" for item in page_ids)
        + f"] /Count {len(pages)} >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    for page_id, page_lines in zip(page_ids, pages, strict=True):
        commands = (
            "BT /F1 10 Tf 50 790 Td 14 TL "
            + " ".join(f"({pdf_text(line)}) Tj T*" for line in page_lines)
            + " ET"
        )
        while len(objects) < page_id + 1:
            objects.append("")
        objects[page_id - 1] = (
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            "/Resources << /Font << /F1 3 0 R >> >> "
            f"/Contents {page_id + 1} 0 R >>"
        )
        objects[page_id] = (
            f"<< /Length {len(commands.encode('ascii'))} >>\nstream\n{commands}\nendstream"
        )
    output = b"%PDF-1.4\n%TenantFlow\n"
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(output))
        output += f"{index} 0 obj\n{obj}\nendobj\n".encode("ascii")
    xref = len(output)
    output += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    output += b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets[1:])
    output += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    )
    return output
