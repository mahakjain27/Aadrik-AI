"""Tests for app.services.requirement_extraction - the layer that
understands informal WhatsApp product-requirement messages (e.g.
"3.15 rasi 3 case") before they'd otherwise fall through to RAG and get
the generic "I don't have that information" fallback.

Pure stdlib unittest (no pytest dependency) so this can run in the
production venv with no extra installs:

    cd backend && python -m unittest discover -s tests -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.requirement_extraction import (  # noqa: E402
    extract_requirement_items,
    format_requirement_reply,
    handle_requirement_message,
    match_catalog_item,
    merge_requirement_items,
    resolve_requirement_items,
)


def _product(id_, name, brand, sizes):
    return {
        "id": id_,
        "category": "Welding Electrodes",
        "subcategory": None,
        "name": name,
        "brand": brand,
        "grade": None,
        "sizes": sizes,
        "packing": [],
        "applications": [],
    }


# A small, clean catalog so exact expected values are easy to assert -
# separate from the real (messier) production catalog, which is only
# used in a couple of realism-check tests near the bottom.
CATALOG = {
    "categories": ["Welding Electrodes"],
    "brands": ["RASI", "ORBIT", "SUPERON"],
    "products": [
        _product(
            "rasi-e6013", "Rasi E6013 / MS Electrodes", "RASI",
            ["2.00 mm", "2.50 mm", "3.15 mm", "4.00 mm"],
        ),
        _product(
            "orbit-e6013", "Orbit E6013 / MS Electrodes", "ORBIT",
            ["2.50 mm", "3.15 mm"],
        ),
        _product(
            "superon-tig", "Superon SS TIG Filler Rods", "SUPERON",
            ["1.60 mm", "2.00 mm"],
        ),
    ],
}

# Same brand, two distinct products sharing a size - the real catalog
# actually has this exact situation for RASI/3.15mm (E6013 electrodes vs
# Stainless Steel electrodes both list 3.15mm).
AMBIGUOUS_CATALOG = {
    "categories": ["Welding Electrodes"],
    "brands": ["RASI"],
    "products": [
        _product("rasi-e6013", "Rasi E6013 / MS Electrodes", "RASI", ["3.15 mm", "4.00 mm"]),
        _product("rasi-ss", "Rasi Stainless Steel Electrodes", "RASI", ["3.15 mm", "4.00 mm"]),
    ],
}


class ExtractionTests(unittest.TestCase):
    """1. Single shorthand product requirement."""

    def test_single_shorthand_requirement(self):
        items = extract_requirement_items("3.15 rasi 3 case", CATALOG)

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["brand_key"], "rasi")
        self.assertEqual(items[0]["size"], "3.15")
        self.assertEqual(items[0]["quantity"], 3)
        self.assertEqual(items[0]["unit"], "case")

    def test_single_shorthand_resolves_to_catalog_product(self):
        resolved = resolve_requirement_items("3.15 rasi 3 case", CATALOG)

        self.assertEqual(len(resolved), 1)
        self.assertEqual(resolved[0]["status"], "resolved")
        self.assertEqual(resolved[0]["product"]["name"], "Rasi E6013 / MS Electrodes")


class MultiProductTests(unittest.TestCase):
    """2. Multiple shorthand product requirements in one message, in
    whatever order the customer happened to type them."""

    def _assert_two_items(self, items):
        self.assertEqual(len(items), 2)

        by_brand = {i["brand_key"]: i for i in items}
        self.assertIn("rasi", by_brand)
        self.assertIn("orbit", by_brand)

        self.assertEqual(by_brand["rasi"]["size"], "3.15")
        self.assertEqual(by_brand["rasi"]["quantity"], 3)
        self.assertEqual(by_brand["rasi"]["unit"], "case")

        self.assertEqual(by_brand["orbit"]["size"], "2.5")
        self.assertEqual(by_brand["orbit"]["quantity"], 2)
        self.assertEqual(by_brand["orbit"]["unit"], "case")

    def test_multi_product_word_order_1(self):
        self._assert_two_items(
            extract_requirement_items("3.15 rasi 3 case 2.5 orbit 2 case", CATALOG)
        )

    def test_multi_product_word_order_2(self):
        self._assert_two_items(
            extract_requirement_items("rasi 3.15 3cs 2.5 orbit 2cs", CATALOG)
        )

    def test_multi_product_merged_shorthand(self):
        self._assert_two_items(
            extract_requirement_items("rasi-3.15-3case orbit-2.5-2case", CATALOG)
        )


class NormalEnglishTests(unittest.TestCase):
    """3. Same requirement, phrased as an actual sentence."""

    def test_normal_english_sentence(self):
        items = extract_requirement_items(
            "need rasi 3.15 3 case and orbit 2.5 2 case", CATALOG
        )
        by_brand = {i["brand_key"]: i for i in items}

        self.assertEqual(by_brand["rasi"]["size"], "3.15")
        self.assertEqual(by_brand["rasi"]["quantity"], 3)
        self.assertEqual(by_brand["orbit"]["size"], "2.5")
        self.assertEqual(by_brand["orbit"]["quantity"], 2)

    def test_sentence_with_of_and_and(self):
        items = extract_requirement_items(
            "3 cases of rasi 3.15 and 2 cases of orbit 2.5", CATALOG
        )
        by_brand = {i["brand_key"]: i for i in items}

        self.assertEqual(by_brand["rasi"]["quantity"], 3)
        self.assertEqual(by_brand["orbit"]["quantity"], 2)


class MixedMessageTests(unittest.TestCase):
    """4. A product requirement plus an unrelated knowledge question in
    the same message - extraction must still find the requirement part
    (the RAG augmentation for the question half is exercised by
    ai_service, not here, since it needs a live LLM call)."""

    def test_mixed_requirement_and_question(self):
        items = extract_requirement_items(
            "Need 3 cases Rasi 3.15. Also do you deliver to Bangalore?", CATALOG
        )

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["brand_key"], "rasi")
        self.assertEqual(items[0]["quantity"], 3)

    def test_mixed_message_produces_a_reply(self):
        reply = handle_requirement_message(
            "Need 3 cases Rasi 3.15. Also do you deliver to Bangalore?",
            history=[],
            catalog=CATALOG,
        )

        self.assertIsNotNone(reply)
        self.assertIn("Rasi E6013", reply)


class UnknownProductTests(unittest.TestCase):
    """5. A brand that isn't in the catalog at all, and a real brand
    with a size that isn't."""

    def test_completely_unknown_brand_is_not_a_requirement(self):
        # No catalog brand mentioned at all - must NOT be treated as a
        # product requirement (this is the main false-positive guard).
        items = extract_requirement_items("3.15 nobrandxyz 3 case", CATALOG)
        self.assertEqual(items, [])

    def test_known_brand_unknown_size(self):
        resolved = resolve_requirement_items("rasi 9.99 3 case", CATALOG)

        self.assertEqual(len(resolved), 1)
        self.assertEqual(resolved[0]["status"], "no_match")
        self.assertEqual(resolved[0]["reason"], "size")

    def test_reply_for_unknown_size_does_not_hallucinate(self):
        reply = format_requirement_reply(resolve_requirement_items("rasi 9.99 3 case", CATALOG))

        self.assertIn("couldn't match", reply)
        self.assertNotIn("Sure. I've noted", reply)


class AmbiguousProductTests(unittest.TestCase):
    """6. Same brand+size matches more than one real product - must ask,
    never guess."""

    def test_ambiguous_match(self):
        resolved = resolve_requirement_items("rasi 3.15 3 case", AMBIGUOUS_CATALOG)

        self.assertEqual(len(resolved), 1)
        self.assertEqual(resolved[0]["status"], "ambiguous")
        self.assertEqual(len(resolved[0]["candidates"]), 2)

    def test_ambiguous_reply_asks_for_clarification(self):
        reply = format_requirement_reply(
            resolve_requirement_items("rasi 3.15 3 case", AMBIGUOUS_CATALOG)
        )

        self.assertIn("multiple", reply.lower())
        self.assertIn("confirm", reply.lower())


class QuantityUnitTests(unittest.TestCase):
    """7. Every supported unit and its shorthand."""

    def test_units(self):
        cases = [
            ("12kg rasi 3.15", "kg", 12),
            ("rasi 3.15 3 box", "box", 3),
            ("rasi 3.15 5pcs", "pcs", 5),
            ("rasi 3.15 2 packets", "packet", 2),
            ("rasi 3.15 1 bundle", "bundle", 1),
            ("rasi 3.15 10 nos", "nos", 10),
        ]

        for text, expected_unit, expected_qty in cases:
            with self.subTest(text=text):
                items = extract_requirement_items(text, CATALOG)
                self.assertEqual(len(items), 1)
                self.assertEqual(items[0]["unit"], expected_unit)
                self.assertEqual(items[0]["quantity"], expected_qty)

    def test_size_quantity_disambiguation_without_unit_word(self):
        # No unit at all - "3.15" matches a real Rasi size so it must be
        # picked as the size even though it appears first, leaving "3"
        # (not a real size) as the quantity.
        items = extract_requirement_items("rasi 3.15 - 3", CATALOG)

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["size"], "3.15")
        self.assertEqual(items[0]["quantity"], 3)


class CaseInsensitivityTests(unittest.TestCase):
    """8. Brand/unit matching must not care about case."""

    def test_uppercase_message(self):
        items = extract_requirement_items("RASI 3.15 3 CASE", CATALOG)

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["brand_key"], "rasi")
        self.assertEqual(items[0]["unit"], "case")

    def test_mixed_case_shorthand(self):
        items = extract_requirement_items("Rasi 3.15 3cs", CATALOG)

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["quantity"], 3)
        self.assertEqual(items[0]["unit"], "case")


class ConversationFollowUpTests(unittest.TestCase):
    """9. A second message should add to, not replace, what the customer
    already asked for earlier in the same session - using the session's
    real message history rather than a separate memory store."""

    def test_follow_up_adds_to_earlier_requirement(self):
        history = [{"role": "user", "content": "3.15 rasi 3 case"}]

        reply = handle_requirement_message("add 2 case orbit 2.5", history, catalog=CATALOG)

        self.assertIsNotNone(reply)
        self.assertIn("Rasi E6013", reply)
        self.assertIn("Orbit E6013", reply)

    def test_follow_up_merge_directly(self):
        first = resolve_requirement_items("3.15 rasi 3 case", CATALOG)
        second = resolve_requirement_items("add 2 case orbit 2.5", CATALOG)

        merged = merge_requirement_items(first, second)

        self.assertEqual(len(merged), 2)
        brand_keys = {i["brand_key"] for i in merged}
        self.assertEqual(brand_keys, {"rasi", "orbit"})

    def test_stale_unresolved_item_does_not_resurface(self):
        # Regression: an earlier turn asked a clarifying question about an
        # AMBIGUOUS item (never answered) - a later, unrelated message
        # must not keep re-asking about it forever.
        catalog = {
            "brands": ["RASI", "ORBIT"],
            "products": [
                _product("rasi-e6013", "Rasi E6013 / MS Electrodes", "RASI", ["3.15 mm"]),
                _product("rasi-ss", "Rasi Stainless Steel Electrodes", "RASI", ["3.15 mm"]),
                _product("orbit-e6013", "Orbit E6013 / MS Electrodes", "ORBIT", ["4.00 mm"]),
            ],
        }

        history = [{"role": "user", "content": "rasi 3.15 3 case"}]  # ambiguous, never resolved

        reply = handle_requirement_message("orbit 4.00mm 2 case", history, catalog=catalog)

        self.assertIsNotNone(reply)
        self.assertNotIn("3.15", reply)
        self.assertIn("Orbit E6013", reply)

    def test_repeated_brand_updates_rather_than_duplicates(self):
        first = resolve_requirement_items("3.15 rasi 3 case", CATALOG)
        corrected = resolve_requirement_items("3.15 rasi 5 case", CATALOG)

        merged = merge_requirement_items(first, corrected)

        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["quantity"], 5)


class ExistingRagUnaffectedTests(unittest.TestCase):
    """10. Ordinary knowledge questions with no product-requirement shape
    must be left alone (return None) so ai_service falls through to the
    existing, unmodified RAG pipeline exactly as before."""

    def test_delivery_question_is_not_a_requirement(self):
        self.assertIsNone(
            handle_requirement_message("What is your delivery time?", [], catalog=CATALOG)
        )

    def test_general_product_question_is_not_a_requirement(self):
        # No brand + quantity/unit pattern - a genuine product-info
        # question, not an order line.
        self.assertIsNone(
            handle_requirement_message(
                "Do you manufacture stainless steel electrodes?", [], catalog=CATALOG
            )
        )

    def test_greeting_is_not_a_requirement(self):
        self.assertIsNone(handle_requirement_message("Hi", [], catalog=CATALOG))


class RealCatalogSanityTests(unittest.TestCase):
    """A couple of checks against the actual live catalog (not the clean
    fixture above), to confirm real-world behavior - the real data is
    messier (e.g. RASI has several sub-brand rows, and "Rasi"+"3.15mm"
    genuinely matches more than one real product), which is exactly why
    the ambiguous/ no_match paths matter in production, not just in
    theory."""

    @classmethod
    def setUpClass(cls):
        try:
            from app.database.connection import get_conn  # noqa: F401
            from app.services.product_service import get_catalog

            cls.catalog = get_catalog()
        except Exception as exc:  # pragma: no cover - environment-dependent
            raise unittest.SkipTest(f"Live database not available: {exc}")

    def test_real_rasi_3_15_is_ambiguous_or_resolved_never_invented(self):
        resolved = resolve_requirement_items("rasi 3.15 3 case", self.catalog)

        self.assertEqual(len(resolved), 1)
        self.assertIn(resolved[0]["status"], {"resolved", "ambiguous", "no_match"})

        if resolved[0]["status"] in {"resolved", "ambiguous"}:
            names = (
                [resolved[0]["product"]["name"]]
                if resolved[0]["status"] == "resolved"
                else [c["name"] for c in resolved[0]["candidates"]]
            )
            for name in names:
                self.assertIn("rasi", name.lower())


if __name__ == "__main__":
    unittest.main()
