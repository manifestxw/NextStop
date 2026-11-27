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


# ---------- v6-v8 extensions (SPEC §3.16-§3.19) ----------
from fare_model import (zone, gender_ok, seats, check_join, new_ride, place_bucket, up05,
                        is_uni_trip, uni_paid, replacements, valid_plan_size, cancel_planned,
                        mulberry32, kmeans, demand_spots, sample_history, pt)

D = dt.datetime(2026, 11, 29)
F = lambda name, p, by, **x: dict(name=name, gender='F', p=p, d='JUST', by=by, **x)


class ZoneTest(unittest.TestCase):
    def test_zones_by_category(self):
        self.assertEqual(zone('economy', 19.3), (1.5, 1.0))   # demo route: same as v5
        self.assertEqual(zone('economy', 85), (4.0, 2.5))
        self.assertEqual(zone('comfort', 19.3), (1.2, 0.8))
        self.assertEqual(zone('airport', 35), (5.2, 1.0))
        self.assertEqual(zone('airport', 110), (10.0, 1.0))


class GenderModeTest(unittest.TestCase):
    def ride(self, mode):
        return dict(riders=[F('Lina', 'CC', D)], gender_mode=mode)

    def test_modes(self):
        man = dict(name='M', gender='M', p='US', d='JUST', by=D)
        self.assertTrue(gender_ok(self.ride('same'), F('Sara', 'US', D)))
        self.assertTrue(gender_ok(self.ride('same'), F('Sara', 'US', D, same_gender_only=False)))
        self.assertFalse(gender_ok(self.ride('same'), dict(man, same_gender_only=False)))
        self.assertFalse(gender_ok(self.ride('mixed'), F('Sara', 'US', D)))        # toggle on
        self.assertTrue(gender_ok(self.ride('mixed'), dict(man, same_gender_only=False)))

    def test_plus_one_must_match_same_ride(self):
        j = F('Sara', 'US', D, guest=dict(name='Ali', gender='M'))
        self.assertFalse(gender_ok(self.ride('same'), j))


class PlusOneTest(unittest.TestCase):
    def test_seats_and_full(self):
        riders = [F('A', 'CC', D), F('B', 'US', D, guest=dict(name='G', gender='F')), F('C', 'HS', D)]
        self.assertEqual(seats(riders), 4)
        ride = dict(riders=riders, first_shown={}, share=3.0)
        ok, reason, _, _ = check_join(ride, F('Dana', 'YU', D.replace(hour=8)), D.replace(hour=6))
        self.assertEqual((ok, reason), (False, 'rule 2 full'))

    def test_comfort_caps_at_three_seats(self):
        ride = dict(riders=[F('A', 'CC', D), F('B', 'US', D)], first_shown={}, share=5.0,
                    category='comfort')
        j = F('C', 'HS', D, category='comfort', guest=dict(name='G', gender='F'))
        self.assertEqual(check_join(ride, j, D)[1], 'rule 2 full')

    def test_category_mismatch(self):
        ride = dict(riders=[F('A', 'CC', D)], first_shown={}, share=7.85)
        self.assertEqual(check_join(ride, F('B', 'US', D, category='comfort'), D)[1], 'rule 1 category')


class UniPlanTest(unittest.TestCase):
    def test_uni_trip(self):
        self.assertTrue(is_uni_trip('CC', 'JUST'))
        self.assertTrue(is_uni_trip('YU', 'AM'))
        self.assertFalse(is_uni_trip('CC', 'AM'))

    def test_discount(self):
        self.assertEqual(uni_paid(2.30), 1.85)
        self.assertEqual(uni_paid(4.00), 3.20)

    def test_replacements(self):
        self.assertEqual(replacements('weekly', 5), 1)
        self.assertEqual([replacements('semester', n) for n in (26, 40, 52, 65, 80)], [1, 2, 2, 3, 4])

    def test_plan_sizes(self):
        self.assertTrue(valid_plan_size('weekly', 3)); self.assertFalse(valid_plan_size('weekly', 2))
        self.assertTrue(valid_plan_size('semester', 2)); self.assertFalse(valid_plan_size('semester', 6))

    def test_cancel_cutoff(self):
        self.assertEqual(cancel_planned(720, 1), ('replacement', 0))
        self.assertEqual(cancel_planned(719, 1), ('use_leave', 1))
        self.assertEqual(cancel_planned(780, 0), ('gone', 0))

    def test_placement_groups_into_one_ride(self):
        mon = dt.datetime(2026, 11, 30, 8, 0)
        trips = [F('Maya', 'US', mon), F('Reem', 'CC', mon)]
        rides, placement = place_bucket(trips, [], mon - dt.timedelta(hours=12))
        self.assertEqual(placement, {'Reem': 0, 'Maya': 0})
        self.assertEqual((rides[0]['plan']['fare'], rides[0]['share']), (7.95, 4.00))


class DemandSpotTest(unittest.TestCase):
    def test_mulberry32_matches_js(self):
        r = mulberry32(1)
        self.assertEqual(r(), 0.6270739405881613)
        r = mulberry32(2026)
        self.assertEqual([r(), r(), r()], [0.45540769933722913, 0.30849614599719644, 0.6611574492417276])

    def test_three_blobs(self):
        rnd = mulberry32(5)
        xy = [(cx + rnd() * 0.2, cy + rnd() * 0.2) for cx, cy in ((0, 0), (5, 0), (0, 5)) for _ in range(20)]
        centers, _ = kmeans(xy, 3)
        for cx, cy in ((0.1, 0.1), (5.1, 0.1), (0.1, 5.1)):
            self.assertLess(min(((c[0]-cx)**2 + (c[1]-cy)**2) ** 0.5 for c in centers), 0.2)

    def test_deterministic_and_min_points(self):
        hist = sample_history()
        self.assertEqual(len(hist), 1320)
        a = demand_spots(hist, pt('CC'), D.replace(hour=6, minute=30))
        b = demand_spots(hist, pt('CC'), D.replace(hour=6, minute=30))
        self.assertEqual(a, b)
        self.assertTrue(all(sp['points'] >= 5 for sp in a[0]))
        self.assertEqual((a[1]['area'], a[2]), ('City Center area', True))

    def test_too_few_points(self):
        pts = [(32.55, 35.85, D.replace(hour=6, minute=40))] * 4
        self.assertEqual(demand_spots(pts, pt('CC'), D.replace(hour=6, minute=30)), ([], None, False))
