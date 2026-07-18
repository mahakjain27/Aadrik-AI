import calendar
from io import BytesIO
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
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

NAVY = colors.HexColor("#1F3B64")
BORDER_GREY = colors.HexColor("#c9ccd1")
MUTED_GREY = colors.HexColor("#666666")

LOGO_PATH = Path(__file__).resolve().parent.parent / "logo.jpeg"


def _fmt_date(iso: str | None) -> str:
    if not iso:
        return "-"

    try:
        return iso[:10]
    except (TypeError, IndexError):
        return "-"


def _fmt_amount(value) -> str:
    return f"Rs. {value:.2f}" if value is not None else "-"


def generate_monthly_report_pdf(data: dict) -> BytesIO:
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
    company_block_style = ParagraphStyle(
        "CompanyBlock",
        parent=normal,
        fontName="Helvetica-Bold",
        fontSize=15,
        textColor=NAVY,
        leading=18,
        alignment=TA_LEFT,
    )
    section_header_style = ParagraphStyle(
        "SectionHeader",
        parent=normal,
        fontName="Helvetica-Bold",
        fontSize=10,
        textColor=colors.white,
    )
    stat_label_style = ParagraphStyle(
        "StatLabel",
        parent=normal,
        fontSize=8.5,
        textColor=MUTED_GREY,
    )
    stat_value_style = ParagraphStyle(
        "StatValue",
        parent=normal,
        fontName="Helvetica-Bold",
        fontSize=14,
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
        fontSize=9,
    )
    footer_style = ParagraphStyle(
        "Footer",
        parent=normal,
        alignment=TA_CENTER,
        fontSize=7.5,
        textColor=MUTED_GREY,
    )
    empty_style = ParagraphStyle(
        "Empty",
        parent=normal,
        fontSize=9,
        textColor=MUTED_GREY,
        alignment=TA_CENTER,
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

    def stat_cell(label, value):
        return Paragraph(
            f"<font color='#666666' size='8.5'>{label}</font><br/>"
            f"<font size='14'><b>{value}</b></font>",
            table_cell_style,
        )

    def data_table(headers, rows, col_widths, empty_message):
        if not rows:
            return Table(
                [[Paragraph(empty_message, empty_style)]],
                colWidths=[width],
            )

        table_data = [[Paragraph(h, table_header_style) for h in headers]] + [
            [Paragraph(str(cell), table_cell_style) for cell in row] for row in rows
        ]

        table = Table(table_data, colWidths=col_widths)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                    ("BOX", (0, 0), (-1, -1), 0.75, BORDER_GREY),
                    ("INNERGRID", (0, 0), (-1, -1), 0.75, BORDER_GREY),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7f7f9")]),
                ]
            )
        )
        return table

    story = []

    month_name = calendar.month_name[data["month"]]
    period_label = f"{month_name} {data['year']}"

    # ---------- Header ----------
    if LOGO_PATH.exists():
        logo_height = 1.0 * inch
        logo_width = logo_height * (453 / 413)
        logo_cell = Image(str(LOGO_PATH), width=logo_width, height=logo_height)
        logo_cell.hAlign = "CENTER"
        logo_box = Table([[logo_cell]], colWidths=[width * 0.28], rowHeights=[1.0 * inch])
        logo_box.setStyle(
            TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER"), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")])
        )
    else:
        logo_box = Table(
            [[Paragraph("AADRIK", logo_placeholder_style)]],
            colWidths=[width * 0.28],
            rowHeights=[0.6 * inch],
        )
        logo_box.setStyle(
            TableStyle([("BOX", (0, 0), (-1, -1), 1, NAVY), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")])
        )

    company_block = Paragraph(
        f"{COMPANY['name']}<br/>"
        f"<font size='9' color='#666666'>Monthly Business Report</font>",
        company_block_style,
    )

    header = Table([[logo_box, company_block]], colWidths=[width * 0.28, width * 0.72])
    header.setStyle(
        TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (1, 0), (1, 0), 12)])
    )
    story.append(header)
    story.append(Spacer(1, 0.12 * inch))
    story.append(HRFlowable(width="100%", thickness=1.4, color=NAVY))

    story.append(Spacer(1, 0.12 * inch))
    story.append(section_bar(f"REPORT PERIOD: {period_label.upper()}"))

    # ---------- Executive Summary ----------
    story.append(Spacer(1, 0.15 * inch))
    story.append(section_bar("EXECUTIVE SUMMARY"))

    s = data["summary"]
    stat_rows = [
        [
            stat_cell("Total Enquiries", s["total_enquiries"]),
            stat_cell("New Customers", s["new_customers"]),
            stat_cell("Quotations Created", s["quotations_created"]),
            stat_cell("Quotations Approved", s["quotations_approved"]),
        ],
        [
            stat_cell("Quotations Rejected", s["quotations_rejected"]),
            stat_cell("Conversion Rate", f"{s['conversion_rate']}%"),
            stat_cell("AI Conversations", s["ai_conversations"]),
            stat_cell("Human Handoffs", s["human_handoffs"]),
        ],
    ]
    stat_table = Table(stat_rows, colWidths=[width / 4.0] * 4)
    stat_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.75, BORDER_GREY),
                ("INNERGRID", (0, 0), (-1, -1), 0.75, BORDER_GREY),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(stat_table)

    # ---------- Customer Activity ----------
    story.append(Spacer(1, 0.18 * inch))
    story.append(section_bar("CUSTOMER ACTIVITY"))
    story.append(Spacer(1, 0.06 * inch))
    story.append(
        data_table(
            ["Company", "Date", "Product", "Status"],
            [
                [
                    row["company_name"],
                    _fmt_date(row["created_at"]),
                    row["product_name"],
                    row["status"],
                ]
                for row in data["customer_activity"]
            ],
            [width * 0.30, width * 0.15, width * 0.35, width * 0.20],
            "No quotations were created this month.",
        )
    )

    # ---------- Converted Customers ----------
    story.append(Spacer(1, 0.18 * inch))
    story.append(section_bar("CONVERTED CUSTOMERS"))
    story.append(Spacer(1, 0.06 * inch))
    story.append(
        data_table(
            ["Company", "Product", "Amount", "Date"],
            [
                [
                    row["company_name"],
                    row["product_name"],
                    _fmt_amount(row["subtotal"]),
                    _fmt_date(row["closed_at"]),
                ]
                for row in data["converted_customers"]
            ],
            [width * 0.30, width * 0.35, width * 0.20, width * 0.15],
            "No quotations were won this month.",
        )
    )

    # ---------- Lost Opportunities ----------
    story.append(Spacer(1, 0.18 * inch))
    story.append(section_bar("LOST OPPORTUNITIES"))
    story.append(Spacer(1, 0.06 * inch))
    story.append(
        data_table(
            ["Company", "Product", "Reason"],
            [
                [row["company_name"], row["product_name"], row["reason"]]
                for row in data["lost_opportunities"]
            ],
            [width * 0.35, width * 0.40, width * 0.25],
            "No lost or stale opportunities this month.",
        )
    )

    # ---------- Top Products ----------
    story.append(Spacer(1, 0.18 * inch))
    story.append(section_bar("TOP PRODUCTS"))
    story.append(Spacer(1, 0.06 * inch))
    story.append(
        data_table(
            ["Product", "Enquiries"],
            [[row["product_name"], row["enquiries"]] for row in data["top_products"]],
            [width * 0.75, width * 0.25],
            "No product enquiries this month.",
        )
    )

    # ---------- AI Performance ----------
    story.append(Spacer(1, 0.18 * inch))
    story.append(section_bar("AI PERFORMANCE"))
    story.append(Spacer(1, 0.06 * inch))

    ai = data["ai_performance"]
    ai_rows = [
        [
            stat_cell("Total Conversations", ai["total_conversations"]),
            stat_cell("Resolved by AI", ai["resolved_by_ai"]),
            stat_cell("Escalated to Sales", ai["escalated_to_sales"]),
        ],
    ]
    ai_table = Table(ai_rows, colWidths=[width / 3.0] * 3)
    ai_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.75, BORDER_GREY),
                ("INNERGRID", (0, 0), (-1, -1), 0.75, BORDER_GREY),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(ai_table)

    # ---------- Footer ----------
    story.append(Spacer(1, 0.3 * inch))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_GREY))
    story.append(Spacer(1, 0.06 * inch))
    story.append(
        Paragraph(
            f"This report is computer generated by Aadrik AI for {period_label}.",
            footer_style,
        )
    )

    doc.build(story)
    buffer.seek(0)

    return buffer
