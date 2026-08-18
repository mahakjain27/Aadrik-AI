from datetime import datetime, timedelta
from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.core.company import COMPANY
from app.services.lead_scoring import _parse_quantity
from app.services.quotation_pricing import aggregate_quotation_totals, compute_quotation_totals

NAVY = colors.HexColor("#1F3B64")
BORDER_GREY = colors.HexColor("#c9ccd1")
MUTED_GREY = colors.HexColor("#666666")

LOGO_PATH = Path(__file__).resolve().parent.parent / "logo.jpeg"


def generate_quotation_pdf(lead, items):
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=0.6 * inch,
        rightMargin=0.6 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch,
    )

    width = doc.width

    styles = getSampleStyleSheet()
    normal = styles["Normal"]

    logo_placeholder_style = ParagraphStyle(
        "LogoPlaceholder",
        parent=normal,
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
        fontSize=12,
        textColor=NAVY,
    )
    company_name_style = ParagraphStyle(
        "CompanyName",
        parent=normal,
        fontName="Helvetica-Bold",
        fontSize=15,
        textColor=NAVY,
        leading=18,
    )
    meta_value_style = ParagraphStyle(
        "MetaValue",
        parent=normal,
        fontName="Helvetica-Bold",
        fontSize=13,
    )
    section_header_style = ParagraphStyle(
        "SectionHeader",
        parent=normal,
        fontName="Helvetica-Bold",
        fontSize=10,
        textColor=colors.white,
    )
    field_value_style = ParagraphStyle(
        "FieldValue",
        parent=normal,
        fontSize=10,
    )
    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=normal,
        fontName="Helvetica-Bold",
        fontSize=9,
        textColor=colors.white,
        alignment=TA_CENTER,
    )
    table_cell_style = ParagraphStyle(
        "TableCell",
        parent=normal,
        fontSize=9.5,
        alignment=TA_CENTER,
    )
    totals_label_style = ParagraphStyle(
        "TotalsLabel",
        parent=normal,
        fontSize=9.5,
        alignment=TA_RIGHT,
    )
    totals_value_style = ParagraphStyle(
        "TotalsValue",
        parent=normal,
        fontSize=9.5,
        alignment=TA_RIGHT,
        fontName="Helvetica-Bold",
    )
    term_style = ParagraphStyle(
        "Term",
        parent=normal,
        fontSize=9,
        leading=13,
    )
    sign_style = ParagraphStyle(
        "Sign",
        parent=normal,
        alignment=TA_RIGHT,
        fontSize=10,
    )
    footer_style = ParagraphStyle(
        "Footer",
        parent=normal,
        alignment=TA_CENTER,
        fontSize=7.5,
        textColor=MUTED_GREY,
    )

    def field(label, value):
        return Paragraph(
            f"<font color='#666666' size='8'>{label}</font><br/>"
            f"<b>{value if value else '-'}</b>",
            field_value_style,
        )

    def section_bar(text):
        bar = Table([[Paragraph(text, section_header_style)]], colWidths=[width])
        bar.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), NAVY),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        return bar

    story = []

    quote_no = f"AD-{lead['created_at'][:4]}-{str(lead['id']).zfill(4)}"
    quote_date = datetime.strptime(lead["created_at"][:10], "%Y-%m-%d")
    valid_till = quote_date + timedelta(days=COMPANY["validity_days"])

    # ---------- Header: logo + company block ----------
    if LOGO_PATH.exists():
        logo_height = 1.2 * inch
        logo_width = logo_height * (453 / 413)  # logo.jpeg's native aspect ratio
        logo_cell = Image(str(LOGO_PATH), width=logo_width, height=logo_height)
        logo_cell.hAlign = "CENTER"
        logo_box = Table(
            [[logo_cell]],
            colWidths=[width * 0.28],
            rowHeights=[1.2 * inch],
        )
        logo_box.setStyle(
            TableStyle(
                [
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
    else:
        logo_box = Table(
            [[Paragraph("AADRIK", logo_placeholder_style)]],
            colWidths=[width * 0.28],
            rowHeights=[0.65 * inch],
        )
        logo_box.setStyle(
            TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 1, NAVY),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )

    company_block = Paragraph(
        f"{COMPANY['name']}<br/>"
        f"<font size='9' color='#666666'>{COMPANY['tagline']}</font><br/>"
        f"<font size='9' color='#666666'>{COMPANY['address']}</font><br/>"
        f"<font size='9' color='#666666'>{COMPANY['phone']}</font><br/>"
        f"<font size='9' color='#666666'>{', '.join(COMPANY['email'])}</font>",
        ParagraphStyle(
            "CompanyBlock",
            parent=company_name_style,
            alignment=TA_LEFT,
        ),
    )

    header = Table(
        [[logo_box, company_block]],
        colWidths=[width * 0.28, width * 0.72],
    )
    header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (1, 0), (1, 0), 12),
            ]
        )
    )
    story.append(header)

    story.append(Spacer(1, 0.12 * inch))
    story.append(HRFlowable(width="100%", thickness=1.4, color=NAVY))

    # ---------- Quotation title bar ----------
    story.append(Spacer(1, 0.12 * inch))
    story.append(section_bar("QUOTATION"))

    if lead["approval_status"] != "Approved":
        story.append(Spacer(1, 0.08 * inch))
        story.append(
            Paragraph(
                "PRELIMINARY - PENDING MANAGER APPROVAL, NOT YET FINAL",
                ParagraphStyle(
                    "PreliminaryNotice",
                    parent=normal,
                    alignment=TA_CENTER,
                    fontName="Helvetica-Bold",
                    fontSize=9,
                    textColor=colors.HexColor("#b23b1f"),
                ),
            )
        )

    meta = Table(
        [
            [
                Paragraph(
                    f"<font color='#666666' size='8.5'>QUOTATION NO.</font><br/>"
                    f"{quote_no}",
                    meta_value_style,
                ),
                Paragraph(
                    f"<font color='#666666' size='8.5'>DATE</font><br/>"
                    f"{quote_date.strftime('%d %b %Y')}",
                    meta_value_style,
                ),
                Paragraph(
                    f"<font color='#666666' size='8.5'>VALID TILL</font><br/>"
                    f"{valid_till.strftime('%d %b %Y')}",
                    meta_value_style,
                ),
            ]
        ],
        colWidths=[width / 3.0] * 3,
    )
    meta.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.75, BORDER_GREY),
                ("INNERGRID", (0, 0), (-1, -1), 0.75, BORDER_GREY),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(meta)

    # ---------- Customer details ----------
    story.append(Spacer(1, 0.15 * inch))
    story.append(section_bar("CUSTOMER DETAILS"))

    customer = Table(
        [
            [
                field("COMPANY", lead["company_name"]),
                field("CONTACT PERSON", lead["contact_person"]),
            ],
            [field("PHONE", lead["phone"]), field("EMAIL", lead["email"])],
            [
                field("GST NUMBER", lead["gst_number"]),
                field("DELIVERY CITY", lead["delivery_city"]),
            ],
        ],
        colWidths=[width / 2.0] * 2,
    )
    customer.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.75, BORDER_GREY),
                ("INNERGRID", (0, 0), (-1, -1), 0.75, BORDER_GREY),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(customer)

    # ---------- Product details ----------
    story.append(Spacer(1, 0.15 * inch))
    story.append(section_bar("PRODUCT DETAILS"))

    product_header = ["Description", "Brand", "Size", "Qty", "Unit", "Rate", "Amount"]

    item_totals = []
    product_rows = []
    for item in items:
        quantity_number = _parse_quantity(item["quantity"])
        totals = (
            compute_quotation_totals(
                unit_price=item["unit_price"],
                quantity=quantity_number,
                gst_percent=item["gst_percent"] or 18,
                discount_type=item["discount_type"] or "percent",
                discount_percent=item["discount_percent"] or 0,
                discount_amount=item["discount_amount"] or 0,
                special_discount_percent=item["special_discount_percent"] or 0,
                special_discount_amount=item["special_discount_amount"] or 0,
            )
            if item["unit_price"] is not None and quantity_number
            else None
        )
        if totals:
            item_totals.append(totals)

        product_rows.append(
            [
                item["product_name"] or "-",
                item["brand"] or "-",
                item["size"] or "-",
                item["quantity"] or "-",
                "-",
                f"Rs. {item['unit_price']:.2f}" if item["unit_price"] is not None else "-",
                f"Rs. {totals['subtotal']:.2f}" if totals else "-",
            ]
        )

    product_table = Table(
        [
            [Paragraph(h, table_header_style) for h in product_header],
            *[
                [Paragraph(str(v), table_cell_style) for v in row]
                for row in product_rows
            ],
        ],
        colWidths=[
            width * 0.26,
            width * 0.14,
            width * 0.11,
            width * 0.10,
            width * 0.10,
            width * 0.14,
            width * 0.15,
        ],
    )
    product_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("BOX", (0, 0), (-1, -1), 0.75, BORDER_GREY),
                ("INNERGRID", (0, 0), (-1, -1), 0.75, BORDER_GREY),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(product_table)

    # ---------- Totals ----------
    agg = aggregate_quotation_totals(item_totals) if item_totals else None

    subtotal = agg["subtotal"] if agg else lead["subtotal"]
    gst_amount = agg["gst_amount"] if agg else None
    grand_total = agg["grand_total"] if agg else lead["grand_total"]

    totals_rows = []

    if agg and agg["normal_discount_amount"] > 0:
        totals_rows.append(
            [
                Paragraph("Original Price", totals_label_style),
                Paragraph(f"Rs. {agg['original_subtotal']:.2f}", totals_value_style),
            ]
        )
        totals_rows.append(
            [
                Paragraph("Normal Discount", totals_label_style),
                Paragraph(
                    f"- Rs. {agg['normal_discount_amount']:.2f}",
                    totals_value_style,
                ),
            ]
        )

    if agg and agg["special_discount_percent_amount"] > 0:
        totals_rows.append(
            [
                Paragraph("Special Discount (%)", totals_label_style),
                Paragraph(
                    f"- Rs. {agg['special_discount_percent_amount']:.2f}",
                    totals_value_style,
                ),
            ]
        )

    if agg and agg["special_discount_flat_amount"] > 0:
        totals_rows.append(
            [
                Paragraph("Special Discount (Flat)", totals_label_style),
                Paragraph(
                    f"- Rs. {agg['special_discount_flat_amount']:.2f}",
                    totals_value_style,
                ),
            ]
        )

    totals_rows.append(
        [
            Paragraph("Subtotal", totals_label_style),
            Paragraph(
                f"Rs. {subtotal:.2f}" if subtotal is not None else "-",
                totals_value_style,
            ),
        ]
    )
    totals_rows.append(
        [
            Paragraph("GST", totals_label_style),
            Paragraph(
                f"Rs. {gst_amount:.2f}" if gst_amount is not None else "-",
                totals_value_style,
            ),
        ]
    )
    totals_rows.append(
        [
            Paragraph("Grand Total", totals_label_style),
            Paragraph(
                f"Rs. {grand_total:.2f}" if grand_total is not None else "-",
                totals_value_style,
            ),
        ]
    )

    totals = Table(
        totals_rows,
        colWidths=[width * 0.80, width * 0.20],
    )
    totals.setStyle(
        TableStyle(
            [
                ("LINEABOVE", (0, len(totals_rows) - 1), (-1, len(totals_rows) - 1), 0.75, BORDER_GREY),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(totals)

    # ---------- Terms & conditions ----------
    story.append(Spacer(1, 0.15 * inch))
    story.append(section_bar("TERMS &amp; CONDITIONS"))

    terms = [
        f"Prices valid for {COMPANY['validity_days']} days from the quotation date."
    ]
    terms += list(COMPANY["terms"])
    terms.append(f"Payment Terms: {COMPANY['payment_terms']}")
    terms.append(f"Delivery Terms: {COMPANY['delivery_terms']}")

    terms_box = Table(
        [
            [
                Paragraph(
                    "<br/>".join(f"&bull; {t}" for t in terms),
                    term_style,
                )
            ]
        ],
        colWidths=[width],
    )
    terms_box.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.75, BORDER_GREY),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(terms_box)

    # ---------- Signatory ----------
    story.append(Spacer(1, 0.5 * inch))
    story.append(Paragraph(f"For <b>{COMPANY['name']}</b>", sign_style))
    story.append(Spacer(1, 0.45 * inch))
    story.append(Paragraph("<b>Authorized Signatory</b>", sign_style))

    # ---------- Footer ----------
    story.append(Spacer(1, 0.3 * inch))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_GREY))
    story.append(Spacer(1, 0.06 * inch))
    story.append(
        Paragraph(
            "This quotation is computer generated and does not require a physical signature.",
            footer_style,
        )
    )

    doc.build(story)

    buffer.seek(0)

    return buffer
