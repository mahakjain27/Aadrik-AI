"""Understands informal/shorthand WhatsApp product-requirement messages
(e.g. "3.15 rasi 3 case 2.5 orbit 2 case") that the RAG chat pipeline
can't answer, because a customer's own shorthand order never appears
verbatim in the knowledge base for a similarity search to retrieve.

Split deliberately in two layers, per the project's "LLM understands
language, application verifies facts" rule:

- Extraction (`extract_requirement_items`) is pure deterministic text
  parsing - no LLM, no DB - so it's fast and exactly testable.
- Catalog matching (`match_catalog_item`) is a deterministic lookup
  against the real, live product catalog (`product_service.get_catalog`)
  - never an invented/guessed product.

This module only decides whether a message contains a product
requirement and, if so, builds the reply. It does not touch RAG at all;
`ai_service.generate_ai_reply` calls `handle_requirement_message` first
and only falls through to the existing RAG pipeline if that returns
None (this message isn't a product requirement).
"""

import re

from app.services.product_service import get_catalog

# Units a customer might order in, plus common shorthand/typos. Kept as a
# flat alias map (raw form -> normalized form) so new shorthand can be
# added in one place.
UNIT_ALIASES = {
    "kg": "kg",
    "kgs": "kg",
    "kilo": "kg",
    "kilos": "kg",
    "case": "case",
    "cases": "case",
    "cs": "case",
    "box": "box",
    "boxes": "box",
    "pcs": "pcs",
    "pc": "pcs",
    "piece": "pcs",
    "pieces": "pcs",
    "packet": "packet",
    "packets": "packet",
    "bundle": "bundle",
    "bundles": "bundle",
    "nos": "nos",
    "no": "nos",
    "number": "nos",
    "numbers": "nos",
}

# Longest-first so e.g. "kgs" isn't cut short by an earlier, shorter
# alternative when building the regex.
_UNIT_WORDS = sorted(UNIT_ALIASES.keys(), key=len, reverse=True)
_UNIT_ALT = "|".join(re.escape(u) for u in _UNIT_WORDS)

# Three alternatives, tried in order at each position:
#   1. a number immediately (or with a space) followed by a unit word,
#      e.g. "3cs", "12 kg" - the merged shorthand case.
#   2. a bare number, e.g. "3.15".
#   3. a bare word, e.g. "rasi", "need", "and".
# Anything else (punctuation, "-", "x") is simply skipped by finditer.
_TOKEN_RE = re.compile(
    rf"(?P<num>\d+(?:\.\d+)?)\s*(?P<unit>{_UNIT_ALT})\b"
    rf"|(?P<bare_num>\d+(?:\.\d+)?)"
    rf"|(?P<bare_word>[a-zA-Z]+)",
    re.IGNORECASE,
)


def _tokenize(text: str) -> list[dict]:
    tokens = []

    for m in _TOKEN_RE.finditer(text):
        if m.group("num") is not None:
            tokens.append(
                {
                    "kind": "qty_unit",
                    "quantity": float(m.group("num")),
                    "unit": UNIT_ALIASES[m.group("unit").lower()],
                }
            )
        elif m.group("bare_num") is not None:
            tokens.append({"kind": "number", "value": float(m.group("bare_num"))})
        else:
            tokens.append({"kind": "word", "value": m.group("bare_word").lower()})

    return tokens


def _brand_lookup(catalog: dict) -> dict[str, str]:
    """Maps a normalized single-word brand key (e.g. "rasi") to the
    catalog's real brand string(s) sharing that first word (e.g. "RASI",
    "RASI SS TIG", "RASI (CINM / CIFN)" all key under "rasi"). Real brand
    data here is messy (sub-brand labels stored in the brand column), so
    matching on the first word is the practical middle ground between
    "match nothing" and "match everything"."""

    lookup: dict[str, list[str]] = {}

    for brand in catalog.get("brands") or []:
        if not brand or not brand.strip():
            continue

        first_word = re.split(r"[\s(]+", brand.strip())[0].lower()

        if first_word:
            lookup.setdefault(first_word, []).append(brand)

    return lookup


def _find_brand_anchors(tokens: list[dict], brand_keys: set[str]) -> list[int]:
    return [i for i, tok in enumerate(tokens) if tok["kind"] == "word" and tok["value"] in brand_keys]


# Words that plausibly join two separate requirement clauses ("3 cases of
# rasi 3.15 AND 2 cases of orbit 2.5"), as opposed to brand/size/quantity
# words themselves.
_CONNECTOR_WORDS = {"and", "also", "plus", "then"}


def _segment_by_anchor_span(tokens: list[dict], anchors: list[int]) -> dict[int, list[dict]]:
    """Splits the token stream so each brand anchor gets the numbers/units
    that actually describe it, handling both directions a customer might
    order words in:

    - "SIZE BRAND QTY UNIT ... NEXT_SIZE NEXT_BRAND" - a bare number right
      before the next brand (with nothing else after it) is that next
      brand's leading size, not a leftover for this brand.
    - "QTY UNIT of BRAND ... and QTY UNIT of NEXT_BRAND" - a connector
      word ("and"/"also"/...) marks a hard clause boundary between one
      brand's tokens and the next's, even when the next brand's quantity
      comes before its own name.

    Tokens before the very first anchor (e.g. a leading size) are
    prepended to that first anchor's segment; tokens after the last
    anchor trail onto it."""

    sorted_anchors = sorted(anchors)
    segments: dict[int, list[dict]] = {a: [] for a in sorted_anchors}

    # Leading tokens, before the first anchor.
    segments[sorted_anchors[0]].extend(tokens[: sorted_anchors[0]])

    # Between each consecutive pair of anchors.
    for a, b in zip(sorted_anchors, sorted_anchors[1:]):
        between = tokens[a + 1 : b]

        connector_positions = [
            i for i, tok in enumerate(between) if tok["kind"] == "word" and tok["value"] in _CONNECTOR_WORDS
        ]

        if connector_positions:
            split_at = connector_positions[-1]
            segments[a].extend(between[:split_at])
            segments[b].extend(between[split_at + 1 :])
        elif between and between[-1]["kind"] == "number":
            segments[a].extend(between[:-1])
            segments[b].append(between[-1])
        else:
            segments[a].extend(between)

    # Trailing tokens, after the last anchor.
    segments[sorted_anchors[-1]].extend(tokens[sorted_anchors[-1] + 1 :])

    return segments


def _normalize_size(value) -> str:
    """"3.15" and "3.15mm"/"3.15 mm" should compare equal - strip units
    and trailing zeros so catalog sizes (stored as e.g. "3.15 mm") match
    a customer's bare "3.15"."""

    text = str(value).strip().lower()
    text = re.sub(r"\s*mm\s*$", "", text)

    try:
        return f"{float(text):g}"
    except ValueError:
        return text


def extract_requirement_items(text: str, catalog: dict | None = None) -> list[dict]:
    """Deterministic extraction of candidate (brand, size, quantity, unit)
    requirement lines from free-form/shorthand text. Does not touch the
    catalog for matching (see match_catalog_item for that) except to know
    which words are brand names worth anchoring on - word order in the
    input is irrelevant, each brand mention "claims" the numbers/units
    nearest to it.

    Returns a list of raw items: {"brand_raw": str, "size": str|None,
    "quantity": float|None, "unit": str|None}. Empty list means no brand
    mention was found at all - almost certainly not a product requirement.
    """

    catalog = catalog if catalog is not None else get_catalog()
    brand_lookup = _brand_lookup(catalog)

    if not brand_lookup:
        return []

    tokens = _tokenize(text)
    anchors = _find_brand_anchors(tokens, set(brand_lookup.keys()))

    if not anchors:
        return []

    segments = _segment_by_anchor_span(tokens, anchors)
    catalog_sizes_by_brand_key = _catalog_sizes_by_brand_key(catalog, brand_lookup)

    items = []

    for anchor_idx in anchors:
        brand_key = tokens[anchor_idx]["value"]
        segment = segments[anchor_idx]

        qty = None
        unit = None
        numbers = []

        for tok in segment:
            if tok["kind"] == "qty_unit" and qty is None:
                qty, unit = tok["quantity"], tok["unit"]
            elif tok["kind"] == "qty_unit":
                numbers.append(tok["quantity"])
            elif tok["kind"] == "number":
                numbers.append(tok["value"])

        size = None

        if qty is not None:
            # A quantity+unit token was found (e.g. "3 case") - any other
            # bare number nearby is the size.
            if numbers:
                size = numbers[0]
        elif len(numbers) >= 2:
            # No explicit unit anywhere - two bare numbers, e.g.
            # "rasi 3.15 - 3". Prefer whichever one is an actual size in
            # the catalog for this brand; the other becomes the quantity
            # (unit left unspecified). Falls back to "first number is the
            # size" (matches every example in the spec) if neither/both
            # match, since that's not enough signal to do better.
            known_sizes = catalog_sizes_by_brand_key.get(brand_key, set())
            size_idx = next(
                (i for i, n in enumerate(numbers) if _normalize_size(n) in known_sizes),
                0,
            )
            size = numbers[size_idx]
            remaining = [n for i, n in enumerate(numbers) if i != size_idx]
            qty = remaining[0] if remaining else None
        elif len(numbers) == 1:
            size = numbers[0]
            # No unit, no second number - quantity is genuinely missing,
            # not guessable; left as None so the reply can ask for it.

        items.append(
            {
                "brand_raw": brand_lookup[brand_key][0],
                "brand_key": brand_key,
                "size": _normalize_size(size) if size is not None else None,
                "size_display": _format_size(size),
                "quantity": qty,
                "unit": unit,
            }
        )

    return items


def _format_size(size) -> str | None:
    if size is None:
        return None
    if float(size).is_integer():
        return str(int(size))
    return str(size)


def _catalog_sizes_by_brand_key(catalog: dict, brand_lookup: dict[str, list[str]]) -> dict[str, set[str]]:
    brand_to_key = {}
    for key, brands in brand_lookup.items():
        for b in brands:
            brand_to_key[b] = key

    sizes_by_key: dict[str, set[str]] = {}

    for product in catalog.get("products") or []:
        key = brand_to_key.get(product.get("brand"))
        if key is None:
            continue
        for size in product.get("sizes") or []:
            sizes_by_key.setdefault(key, set()).add(_normalize_size(size))

    return sizes_by_key


def match_catalog_item(item: dict, catalog: dict) -> dict:
    """Resolves one extracted (brand, size) pair against the real product
    catalog. Never invents a product - returns one of:

    - status="resolved": exactly one matching product
    - status="ambiguous": more than one matching product, `candidates` lists them
    - status="no_match": brand and/or size don't match anything real
    """

    brand_key = item["brand_key"]
    products = catalog.get("products") or []

    brand_candidates = [
        p for p in products
        if p.get("brand") and re.split(r"[\s(]+", p["brand"].strip())[0].lower() == brand_key
    ]

    if not brand_candidates:
        return {**item, "status": "no_match", "reason": "brand", "candidates": []}

    if item["size"] is None:
        candidates = brand_candidates
    else:
        candidates = [
            p for p in brand_candidates
            if any(_normalize_size(s) == item["size"] for s in (p.get("sizes") or []))
        ]

        if not candidates:
            return {**item, "status": "no_match", "reason": "size", "candidates": []}

    if len(candidates) == 1:
        return {**item, "status": "resolved", "product": candidates[0], "candidates": candidates}

    return {**item, "status": "ambiguous", "candidates": candidates}


def resolve_requirement_items(text: str, catalog: dict | None = None) -> list[dict]:
    catalog = catalog if catalog is not None else get_catalog()
    return [match_catalog_item(i, catalog) for i in extract_requirement_items(text, catalog)]


def _item_key(item: dict) -> tuple:
    # Two mentions of the same real product must merge into one line even
    # if one of them omitted the size (e.g. "Orbit 3.15 4 box" then later
    # "Orbit 4 box") - both resolve to the same catalog product, so key on
    # that once it's known. Only unresolved items (no confirmed product
    # yet) fall back to the raw (brand, size) text.
    if item.get("status") == "resolved":
        return ("product", item["product"]["id"])
    return (item["brand_key"], item.get("size"))


def merge_requirement_items(previous: list[dict], new: list[dict]) -> list[dict]:
    """Folds `new` items into `previous`, so a follow-up message like "add
    2 case orbit 2.5" doesn't make the customer repeat what they already
    said earlier in the conversation. Same (brand, size) in both lists =
    the newer one wins (e.g. a corrected quantity); anything only in
    `new` is appended; order is otherwise preserved."""

    merged = list(previous)
    keys = {_item_key(i): idx for idx, i in enumerate(merged)}

    for item in new:
        key = _item_key(item)
        if key in keys:
            merged[keys[key]] = item
        else:
            keys[key] = len(merged)
            merged.append(item)

    return merged


def format_requirement_reply(items: list[dict]) -> str:
    """Builds the customer-facing reply for a resolved/ambiguous/unmatched
    set of requirement items. Never states a price (the catalog used here
    doesn't carry one) and never confirms a product that wasn't actually
    matched."""

    noted_lines = []
    followups = []

    for item in items:
        brand_label = item["brand_raw"].strip()
        size_label = f" {item['size_display']}" if item.get("size_display") else ""
        qty_label = (
            f"{_format_size(item['quantity'])} {item['unit'] or ''}".strip()
            if item.get("quantity") is not None
            else None
        )

        if item["status"] == "resolved":
            name = item["product"]["name"]
            if qty_label:
                noted_lines.append(f"• {name} ({brand_label}{size_label}) – {qty_label}")
            else:
                followups.append(
                    f"I found {name} ({brand_label}{size_label}), but I need the quantity "
                    "to confirm it."
                )
        elif item["status"] == "ambiguous":
            candidate_names = ", ".join(dict.fromkeys(c["name"] for c in item["candidates"][:5]))
            followups.append(
                f"I found multiple {brand_label}{size_label} products ({candidate_names}). "
                "Could you please confirm the product/grade you need?"
            )
        else:  # no_match
            followups.append(
                f"I couldn't match {brand_label}{size_label} to a product in our current "
                "catalog. Could you please confirm the product name or send a photo?"
            )

    parts = []

    if noted_lines:
        parts.append("Sure. I've noted your requirement:\n" + "\n".join(noted_lines))

    if followups:
        parts.append("\n".join(followups))

    if noted_lines and not followups:
        parts.append("I can help you with the next step.")

    return "\n\n".join(parts)


def _bare_quantity(text: str) -> tuple[float, str | None] | None:
    """If `text` is JUST a quantity - optionally with a unit, e.g. "4" or
    "4 cases" - and mentions no brand/other word at all, returns
    (quantity, unit). Used to understand a customer answering the bot's
    own "I need the quantity to confirm it" question with nothing but a
    number, which on its own has no brand for extract_requirement_items
    to anchor on."""

    tokens = _tokenize(text)
    numeric = [t for t in tokens if t["kind"] in ("qty_unit", "number")]
    words = [t for t in tokens if t["kind"] == "word"]

    if len(numeric) != 1 or words:
        return None

    tok = numeric[0]
    if tok["kind"] == "qty_unit":
        return tok["quantity"], tok["unit"]
    return tok["value"], None


def handle_requirement_message(message: str, history: list, catalog: dict | None = None) -> str | None:
    """Entry point called by ai_service.generate_ai_reply before RAG.
    Returns the finished reply text if `message` contains a product
    requirement (merged with anything the customer already mentioned
    earlier in this session), or None if it doesn't - in which case the
    caller should fall through to the existing RAG pipeline unchanged.

    Only RESOLVED items from earlier turns carry forward silently (a
    confirmed cart entry). An ambiguous/no_match item from an earlier
    turn was already surfaced once as a clarifying question - if the
    customer didn't answer it and asked about something else instead, it
    must not keep nagging them on every later reply.

    `catalog` is injectable for tests; production callers should omit it
    and let this fetch the live catalog."""

    catalog = catalog if catalog is not None else get_catalog()
    new_raw = extract_requirement_items(message, catalog)

    prior_resolved: list[dict] = []
    for msg in history:
        if msg["role"] != "user":
            continue
        prior_raw = extract_requirement_items(msg["content"], catalog)
        if prior_raw:
            prior_matched = [match_catalog_item(i, catalog) for i in prior_raw]
            prior_resolved = merge_requirement_items(
                prior_resolved,
                [i for i in prior_matched if i["status"] == "resolved"],
            )

    if new_raw:
        new_resolved = [match_catalog_item(i, catalog) for i in new_raw]
    else:
        bare = _bare_quantity(message)
        if bare is None:
            return None

        # A bare number only means something if there's an item still
        # waiting on a quantity - otherwise there's nothing to attach it
        # to, and this genuinely isn't a product requirement.
        pending = next((i for i in reversed(prior_resolved) if i.get("quantity") is None), None)
        if pending is None:
            return None

        quantity, unit = bare
        new_resolved = [{**pending, "quantity": quantity, "unit": unit}]

    merged = merge_requirement_items(prior_resolved, new_resolved)

    return format_requirement_reply(merged)
