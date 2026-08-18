"""
Rule-based lead priority scoring (0-100) and follow-up urgency, the single
source of truth for the CRM dashboard, AI Insights, and (once wired up)
WhatsApp/ERP automations that need to reuse the same signals server-side.

To add a new signal once a new data source exists (WhatsApp engagement, ERP
payment reliability, etc.): write a `_signal(lead, ctx) -> (points, reason)`
function below and append it to SIGNAL_FUNCTIONS. Nothing else has to change.
"""

import re
from datetime import datetime, timezone

CLOSED_STATUSES = {"Won", "Lost"}

STATUS_BASE_SCORE = {
    "New": 40,
    "Pending": 40,
    "Contacted": 55,
    "Quotation Sent": 70,
}

# Quantity units differ by product line and aren't comparable to each other
# (kg vs. boxes vs. coils vs. packets) - same categories as the frontend's
# productQuantity.js, kept in sync by hand since they encode the same rules.
QUANTITY_CATEGORIES = [
    ("coils", re.compile(r"\bmig\b|\bmag\b", re.I), "coil order", "Coils"),
    ("kg", re.compile(r"\btig\b", re.I), "order size", "Kg"),
    ("boxes", re.compile(r"6013", re.I), "box order", "Boxes"),
]
PACKETS_CATEGORY = ("packets", "packet order", "Packets")

QUANTITY_NUMBER_RE = re.compile(r"[\d.]+")

FOLLOW_UP_DAYS = 2
OVERDUE_DAYS = 5


def categorize_quantity(product_name: str | None) -> tuple[str, str, str]:
    """Returns (key, label, unit) for a product name."""

    name = product_name or ""

    for key, pattern, label, unit in QUANTITY_CATEGORIES:
        if pattern.search(name):
            return key, label, unit

    return PACKETS_CATEGORY


def _parse_quantity(raw) -> float:
    if not raw:
        return 0.0

    match = QUANTITY_NUMBER_RE.search(str(raw))
    return float(match.group()) if match else 0.0


def days_since(date_str: str | None) -> float:
    if not date_str:
        return 0.0

    try:
        parsed = datetime.fromisoformat(str(date_str).replace("Z", "+00:00"))
    except ValueError:
        return 0.0

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    return (datetime.now(timezone.utc) - parsed).total_seconds() / 86400


def is_open_lead(lead: dict) -> bool:
    return lead.get("status") not in CLOSED_STATUSES


def _priority_from_score(score: int) -> str:
    if score >= 70:
        return "High"
    if score >= 45:
        return "Medium"
    return "Low"


def _lead_items(lead: dict) -> list[dict]:
    """A lead's product lines - the real quotation_items if attached, or a
    single synthetic item wrapping the legacy scalar fields as a fallback
    for any caller that hasn't attached `items` yet."""

    return lead.get("items") or [
        {"product_name": lead.get("product_name"), "quantity": lead.get("quantity")}
    ]


def _build_context(leads: list[dict]) -> dict:
    company_counts: dict[str, int] = {}
    category_max: dict[str, float] = {}

    for lead in leads:
        company = lead.get("company_name")
        if company:
            company_counts[company] = company_counts.get(company, 0) + 1

        for item in _lead_items(lead):
            key, _label, _unit = categorize_quantity(item.get("product_name"))
            qty = _parse_quantity(item.get("quantity"))
            category_max[key] = max(category_max.get(key, 1.0), qty)

    return {"company_counts": company_counts, "category_max": category_max}


# ---- signals ---------------------------------------------------------
# Each signal takes (lead, ctx) and returns (points, reason | None). ctx
# carries batch-level context (company counts, per-category max quantity) so
# a signal can compare a lead against the rest of the pipeline.

def _quantity_signal(lead: dict, ctx: dict):
    # A lead with several line items scores on its single largest one - "this
    # lead contains a large order" - rather than summing bonuses across every
    # line, which would let many small products outscore one big order.
    best_bonus, best_label = 0.0, None

    for item in _lead_items(lead):
        key, label, _unit = categorize_quantity(item.get("product_name"))
        category_max = ctx["category_max"].get(key) or 1.0
        bonus = (_parse_quantity(item.get("quantity")) / category_max) * 15
        if bonus > best_bonus:
            best_bonus, best_label = bonus, label

    reason = f"large {best_label}" if best_bonus >= 10 else None
    return best_bonus, reason


def _recency_signal(lead: dict, ctx: dict):
    age = days_since(lead.get("created_at"))
    bonus = max(0.0, 20 - age * 2)
    reason = "recent inquiry" if bonus >= 10 else None
    return bonus, reason


def _repeat_customer_signal(lead: dict, ctx: dict):
    count = ctx["company_counts"].get(lead.get("company_name"), 1)
    bonus = 20.0 if count >= 3 else 12.0 if count == 2 else 0.0
    reason = "multiple quotations" if bonus >= 12 else None
    return bonus, reason


SIGNAL_FUNCTIONS = [
    _quantity_signal,
    _recency_signal,
    _repeat_customer_signal,
]


def score_leads(leads: list[dict]) -> list[dict]:
    """
    Returns leads augmented with ai_score / ai_priority / ai_reason /
    ai_quantity_unit. Closed leads (Won/Lost) are left unscored.
    """

    ctx = _build_context(leads)
    scored = []

    for lead in leads:
        _key, _label, unit = categorize_quantity(lead.get("product_name"))

        if not is_open_lead(lead):
            scored.append({
                **lead,
                "ai_score": None,
                "ai_priority": None,
                "ai_reason": None,
                "ai_quantity_unit": unit,
            })
            continue

        base = STATUS_BASE_SCORE.get(lead.get("status"), 40)
        total = base
        reasons = []

        for signal in SIGNAL_FUNCTIONS:
            points, reason = signal(lead, ctx)
            total += points
            if reason:
                reasons.append(reason)

        if base >= 70:
            reasons.append("quotation already sent")
        if not reasons:
            reasons.append("low activity")

        score = min(100, round(total))
        reason_text = " + ".join(reasons)
        reason_text = reason_text[0].upper() + reason_text[1:]

        scored.append({
            **lead,
            "ai_score": score,
            "ai_priority": _priority_from_score(score),
            "ai_reason": reason_text,
            "ai_quantity_unit": unit,
        })

    return scored


def get_follow_up_severity(lead: dict) -> tuple[str | None, int | None]:
    """Returns (severity, days_open) for a lead that needs follow-up, else (None, None)."""

    if not is_open_lead(lead):
        return None, None

    age = days_since(lead.get("created_at"))
    if age < FOLLOW_UP_DAYS:
        return None, None

    severity = "overdue" if age >= OVERDUE_DAYS else "due"
    return severity, int(age)


def annotate_leads(leads: list[dict]) -> list[dict]:
    """Attach AI score + follow-up severity fields to each lead dict."""

    scored = score_leads(leads)

    for lead in scored:
        severity, days_open = get_follow_up_severity(lead)
        lead["follow_up_severity"] = severity
        lead["days_open"] = days_open

    return scored
