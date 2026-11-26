import datetime as dt
import unittest

from fare_model import leave


class FrozenLeaveTest(unittest.TestCase):
    def setUp(self):
        # Co-located stops yield the 1 JD minimum fare after removal.
        self.start = dt.datetime(2026, 11, 29, 7)
        self.plan = {
            "T0": self.start,
            "pick": {i: self.start for i in range(3)},
            "stops": [(kind, i, "CC") for kind in ("P", "D") for i in range(3)],
        }

    def test_second_late_leave_subtracts_both_credits(self):
        fare, share, charge, late, _ = leave(
            self.plan, 1, 3, 0.35, self.start, existing_credits=0.15
        )
        self.assertEqual((fare, share, charge, late), (1.0, 0.25, 0.35, True))

    def test_free_leave_during_redispatch_preserves_credit(self):
        fare, share, charge, late, _ = leave(
            self.plan, 1, 3, 0.35, self.start, existing_credits=0.15,
            driver_assigned=False,
        )
        self.assertEqual((fare, share, charge, late), (1.0, 0.45, 0.0, False))

    def test_last_rider_cancels_without_a_new_charge(self):
        plan = {"T0": self.start, "pick": {0: self.start},
                "stops": [("P", 0, "CC"), ("D", 0, "CC")]}
        self.assertEqual(leave(plan, 0, 1, 0.35, self.start, existing_credits=0.15),
                         (0.0, 0.0, 0.0, False, {}))
