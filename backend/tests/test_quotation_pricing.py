"""Tests for app.services.quotation_pricing - the single source of truth
for quotation line-item pricing math, shared by the pricing API, the
PDF generator, and (indirectly, via the API response) the CRM UI.

    cd backend && python -m unittest tests.test_quotation_pricing -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.quotation_pricing import (  # noqa: E402
    aggregate_quotation_totals,
    compute_quotation_totals,
)


class FlatAmountIsPerUnitTests(unittest.TestCase):
    """A flat Rs discount amount is per unit, multiplied by quantity -
    not a flat deduction off the whole line."""

    def test_normal_discount_amount_scales_with_quantity(self):
        totals = compute_quotation_totals(
            unit_price=1680, quantity=4, gst_percent=18,
            discount_type="amount", discount_percent=0, discount_amount=100,
        )

        self.assertEqual(totals["original_subtotal"], 6720.0)
        self.assertEqual(totals["normal_discount_amount"], 400.0)  # 100 x 4
        self.assertEqual(totals["subtotal"], 6320.0)

    def test_reported_scenario_400_per_unit_on_qty_4(self):
        # The exact numbers from the reported screenshot: entering "400"
        # as a per-unit amount on a qty-4, Rs.1680 line should deduct
        # 1600 total, landing on Rs. 5120 - not the old flat-400 behavior
        # that left it at Rs. 6320.
        totals = compute_quotation_totals(
            unit_price=1680, quantity=4, gst_percent=18,
            discount_type="amount", discount_percent=0, discount_amount=400,
        )

        self.assertEqual(totals["normal_discount_amount"], 1600.0)
        self.assertEqual(totals["subtotal"], 5120.0)

    def test_special_discount_flat_amount_scales_with_quantity(self):
        totals = compute_quotation_totals(
            unit_price=1000, quantity=3, gst_percent=18,
            discount_type="percent", discount_percent=0,
            special_discount_percent=0, special_discount_amount=50,
        )

        self.assertEqual(totals["special_discount_flat_amount"], 150.0)  # 50 x 3
        self.assertEqual(totals["subtotal"], 2850.0)

    def test_percent_discount_unaffected_by_quantity(self):
        # Sanity check that the percent path (unchanged) still behaves as
        # a straight percentage of the line, regardless of quantity.
        totals = compute_quotation_totals(
            unit_price=1000, quantity=5, gst_percent=18,
            discount_type="percent", discount_percent=10,
        )

        self.assertEqual(totals["original_subtotal"], 5000.0)
        self.assertEqual(totals["normal_discount_amount"], 500.0)

    def test_per_unit_discount_clamped_to_line_subtotal(self):
        # A per-unit discount larger than the whole line must not push
        # the subtotal negative.
        totals = compute_quotation_totals(
            unit_price=100, quantity=2, gst_percent=18,
            discount_type="amount", discount_percent=0, discount_amount=1000,
        )

        self.assertEqual(totals["original_subtotal"], 200.0)
        self.assertEqual(totals["normal_discount_amount"], 200.0)
        self.assertEqual(totals["subtotal"], 0.0)


class AggregationTests(unittest.TestCase):
    def test_aggregate_sums_multiple_lines(self):
        line_a = compute_quotation_totals(unit_price=2625, quantity=2, gst_percent=18)
        line_b = compute_quotation_totals(
            unit_price=1680, quantity=4, gst_percent=18,
            discount_type="amount", discount_percent=0, discount_amount=100,
        )

        agg = aggregate_quotation_totals([line_a, line_b])

        self.assertEqual(agg["grand_total"], round(line_a["grand_total"] + line_b["grand_total"], 2))
        self.assertEqual(agg["subtotal"], round(line_a["subtotal"] + line_b["subtotal"], 2))


if __name__ == "__main__":
    unittest.main()
