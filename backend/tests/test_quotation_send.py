"""Tests for app.services.quotation_send - resolving which WhatsApp
number a quotation should send to when the contact phone and the
originating WhatsApp number (source_whatsapp_phone) may differ.

    cd backend && python -m unittest tests.test_quotation_send -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.quotation_send import (  # noqa: E402
    InvalidWhatsappSelection,
    resolve_whatsapp_destination,
)

Q = "919841242794"  # already-normalized form of the quotation's own number
Q_UNNORM = "9841242794"  # same number, 10-digit form
OTHER = "919444990124"


def sessions_for(*phones):
    phones = set(phones)
    return lambda phone: phone in phones


class SameNumberTests(unittest.TestCase):
    """Test 1: quotation phone == source WhatsApp number."""

    def test_same_number_no_mismatch(self):
        result = resolve_whatsapp_destination(
            quotation_phone=Q, source_whatsapp_phone=Q,
            requested_phone=None, has_session=sessions_for(Q),
        )

        self.assertFalse(result["number_mismatch"])
        self.assertFalse(result["selection_required"])
        self.assertEqual(result["target_phone"], Q)


class FormattingDifferenceTests(unittest.TestCase):
    """Test 6: same number, different formatting - must not mismatch."""

    def test_formatting_difference_is_not_a_mismatch(self):
        result = resolve_whatsapp_destination(
            quotation_phone="+91 98412 42794", source_whatsapp_phone="919841242794",
            requested_phone=None, has_session=sessions_for(Q),
        )

        self.assertFalse(result["number_mismatch"])
        self.assertEqual(result["target_phone"], Q)

    def test_ten_digit_vs_country_code_form(self):
        result = resolve_whatsapp_destination(
            quotation_phone=Q_UNNORM, source_whatsapp_phone=Q,
            requested_phone=None, has_session=sessions_for(Q),
        )

        self.assertFalse(result["number_mismatch"])


class MismatchBothAvailableTests(unittest.TestCase):
    """Test 2: genuinely different numbers, both have live conversations."""

    def test_both_available_requires_selection(self):
        result = resolve_whatsapp_destination(
            quotation_phone=OTHER, source_whatsapp_phone=Q,
            requested_phone=None, has_session=sessions_for(Q, OTHER),
        )

        self.assertTrue(result["number_mismatch"])
        self.assertTrue(result["selection_required"])
        self.assertIsNone(result["target_phone"])
        self.assertEqual(set(result["available_destinations"]), {Q, OTHER})

    def test_selecting_quotation_phone_after_prompt(self):
        result = resolve_whatsapp_destination(
            quotation_phone=OTHER, source_whatsapp_phone=Q,
            requested_phone=OTHER, has_session=sessions_for(Q, OTHER),
        )

        self.assertEqual(result["target_phone"], OTHER)
        self.assertFalse(result["selection_required"])

    def test_selecting_source_whatsapp_phone_after_prompt(self):
        result = resolve_whatsapp_destination(
            quotation_phone=OTHER, source_whatsapp_phone=Q,
            requested_phone=Q, has_session=sessions_for(Q, OTHER),
        )

        self.assertEqual(result["target_phone"], Q)

    def test_cannot_select_an_unrelated_third_number(self):
        with self.assertRaises(InvalidWhatsappSelection):
            resolve_whatsapp_destination(
                quotation_phone=OTHER, source_whatsapp_phone=Q,
                requested_phone="919999999999", has_session=sessions_for(Q, OTHER),
            )


class MismatchOnlySourceAvailableTests(unittest.TestCase):
    """Test 3: different numbers, only the WhatsApp source has a
    conversation - it should be offered, the other must not be."""

    def test_only_source_offered(self):
        result = resolve_whatsapp_destination(
            quotation_phone=OTHER, source_whatsapp_phone=Q,
            requested_phone=None, has_session=sessions_for(Q),
        )

        self.assertTrue(result["number_mismatch"])
        self.assertTrue(result["selection_required"])
        self.assertEqual(result["available_destinations"], [Q])
        self.assertNotIn(OTHER, result["available_destinations"])


class MismatchOnlyQuotationPhoneAvailableTests(unittest.TestCase):
    """Case C: quotation phone itself has a live conversation."""

    def test_only_quotation_phone_offered(self):
        result = resolve_whatsapp_destination(
            quotation_phone=OTHER, source_whatsapp_phone=Q,
            requested_phone=None, has_session=sessions_for(OTHER),
        )

        self.assertEqual(result["available_destinations"], [OTHER])


class ManualQuotationTests(unittest.TestCase):
    """Test 4: quotation created manually, no WhatsApp source number at
    all - existing single-number behavior, completely unchanged."""

    def test_no_source_number_behaves_as_before(self):
        result = resolve_whatsapp_destination(
            quotation_phone=OTHER, source_whatsapp_phone=None,
            requested_phone=None, has_session=sessions_for(OTHER),
        )

        self.assertFalse(result["number_mismatch"])
        self.assertFalse(result["selection_required"])
        self.assertEqual(result["target_phone"], OTHER)

    def test_no_source_still_resolves_target_regardless_of_session(self):
        # No mismatch possible without a second number to compare against
        # - target_phone is always the quotation's own number here, same
        # as before this feature existed. Whether a session actually
        # exists for it is the endpoint's job to check afterward, not
        # this resolver's.
        result = resolve_whatsapp_destination(
            quotation_phone=OTHER, source_whatsapp_phone=None,
            requested_phone=None, has_session=sessions_for(),
        )

        self.assertFalse(result["number_mismatch"])
        self.assertEqual(result["target_phone"], OTHER)


class NeitherAvailableTests(unittest.TestCase):
    """Test 5: numbers differ, but neither has a live conversation."""

    def test_neither_number_available(self):
        result = resolve_whatsapp_destination(
            quotation_phone=OTHER, source_whatsapp_phone=Q,
            requested_phone=None, has_session=sessions_for(),
        )

        self.assertTrue(result["number_mismatch"])
        self.assertFalse(result["selection_required"])
        self.assertIsNone(result["target_phone"])
        self.assertEqual(result["available_destinations"], [])


class GenuinelyDifferentTests(unittest.TestCase):
    """Test 7: explicit genuinely-different-numbers mismatch check."""

    def test_genuinely_different_numbers_mismatch(self):
        result = resolve_whatsapp_destination(
            quotation_phone="9444990124", source_whatsapp_phone="919841242794",
            requested_phone=None, has_session=sessions_for(),
        )

        self.assertTrue(result["number_mismatch"])


if __name__ == "__main__":
    unittest.main()
