from datetime import datetime, timedelta
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.core.company import COMPANY

NAVY = colors.HexColor("#1F3B64")
BORDER_GREY = colors.HexColor("#c9ccd1")
MUTED_GREY = colors.HexColor("#666666")


def generate_quotation_pdf(lead):
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
        f"<font size='9' color='#666666'>{COMPANY['email']}</font>",
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
    product_row = [
        lead["product_name"] or "-",
        lead["brand"] or "-",
        lead["size"] or "-",
        lead["quantity"] or "-",
        "-",
        "-",
        "-",
    ]
    product_table = Table(
        [
            [Paragraph(h, table_header_style) for h in product_header],
            [Paragraph(str(v), table_cell_style) for v in product_row],
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
    gst_rate = COMPANY["gst_rate_percent"]
    totals = Table(
        [
            [
                Paragraph("Subtotal", totals_label_style),
                Paragraph("-", totals_value_style),
            ],
            [
                Paragraph(f"GST ({gst_rate}%)", totals_label_style),
                Paragraph("-", totals_value_style),
            ],
            [
                Paragraph("Grand Total", totals_label_style),
                Paragraph("-", totals_value_style),
            ],
        ],
        colWidths=[width * 0.80, width * 0.20],
    )
    totals.setStyle(
        TableStyle(
            [
                ("LINEABOVE", (0, 2), (-1, 2), 0.75, BORDER_GREY),
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
