def compute_quotation_totals(
    *,
    unit_price: float,
    quantity: float,
    gst_percent: float,
    discount_type: str = "percent",
    discount_percent: float = 0.0,
    discount_amount: float = 0.0,
    special_discount_percent: float = 0.0,
    special_discount_amount: float = 0.0,
) -> dict:
    """Single source of truth for quotation pricing math - the pricing API,
    the PDF generator, and anything else that needs a total all call this
    instead of recomputing it themselves, so they can never disagree.

    Order: unit price x quantity -> normal discount (a % OR a flat Rs,
    never both - discount_type picks which) -> special discount (a % AND
    a flat Rs, both apply) -> GST on what's left -> grand total."""

    original_subtotal = round(unit_price * quantity, 2)

    if discount_type == "amount":
        normal_discount_amount = round(
            min(max(discount_amount, 0), original_subtotal), 2
        )
    else:
        normal_discount_amount = round(
            original_subtotal * max(discount_percent, 0) / 100, 2
        )
        normal_discount_amount = min(normal_discount_amount, original_subtotal)

    subtotal_after_normal_discount = round(
        original_subtotal - normal_discount_amount, 2
    )

    special_discount_percent_amount = round(
        subtotal_after_normal_discount * max(special_discount_percent, 0) / 100, 2
    )
    remaining_after_special_percent = max(
        subtotal_after_normal_discount - special_discount_percent_amount, 0
    )
    special_discount_flat_amount = round(
        min(max(special_discount_amount, 0), remaining_after_special_percent), 2
    )

    subtotal = round(
        max(
            subtotal_after_normal_discount
            - special_discount_percent_amount
            - special_discount_flat_amount,
            0,
        ),
        2,
    )

    gst_amount = round(subtotal * max(gst_percent, 0) / 100, 2)
    grand_total = round(subtotal + gst_amount, 2)

    return {
        "original_subtotal": original_subtotal,
        "normal_discount_amount": normal_discount_amount,
        "subtotal_after_normal_discount": subtotal_after_normal_discount,
        "special_discount_percent_amount": special_discount_percent_amount,
        "special_discount_flat_amount": special_discount_flat_amount,
        "subtotal": subtotal,
        "gst_amount": gst_amount,
        "grand_total": grand_total,
    }


def aggregate_quotation_totals(item_totals: list[dict]) -> dict:
    """Sums a list of per-item compute_quotation_totals() results into
    quotation-level totals, for a multi-line-item quotation's display/PDF/
    WhatsApp-caption grand total. Each line is priced independently (its
    own discount/GST) via compute_quotation_totals - this just adds up the
    results, it doesn't reapply any pricing logic itself."""

    keys = [
        "original_subtotal",
        "normal_discount_amount",
        "subtotal_after_normal_discount",
        "special_discount_percent_amount",
        "special_discount_flat_amount",
        "subtotal",
        "gst_amount",
        "grand_total",
    ]
    return {key: round(sum(t[key] for t in item_totals), 2) for key in keys}
