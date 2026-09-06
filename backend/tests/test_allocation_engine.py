"""
Permanent, CI-run tests for the proven-important invariants of the allocation
engine (ml_engine/), encoding real behavior that was previously only verified
manually against scratch/real data during development - see docs/decisions.md
for the full history each of these traces back to.

Every test builds its own small, deterministic, synthetic profile set - never the
real dataset - so these run in milliseconds and never depend on live data.
"""
from ml_engine.executor import compute_allocation
from ml_engine.matcher_greedy import expand_oversized_templates, MAX_EFFECTIVE_ROOM_SIZE


def _members_by_room(result):
    return {room["id"]: set(room["members"]) for room in result["allocations"]}


def _all_accounted_for(result, expected_ids):
    """Every id must appear in exactly one of: some room's members, or
    needsManualPlacement - the 100% placement invariant (never silently missing
    from both)."""
    placed = set()
    for room in result["allocations"]:
        placed.update(room["members"])
    stuck = {entry["student_id"] for entry in result["needsManualPlacement"]}

    missing = set(expected_ids) - placed - stuck
    assert not missing, f"students missing from both allocations and needsManualPlacement: {missing}"

    in_both = placed & stuck
    assert not in_both, f"students in BOTH allocations and needsManualPlacement: {in_both}"


# ============================== Hard constraints ==============================

def test_mixed_gender_room_never_formed(make_profile):
    """Gender bucketing is the sole source of gender partitioning (see executor.py's
    docstring) - this must hold even when cross-gender pairs would otherwise be
    maximally compatible (identical profiles), which is exactly the condition under
    which a bucketing regression would actually show up."""
    profiles = [
        make_profile("m1", gender="Male"),
        make_profile("m2", gender="Male"),
        make_profile("f1", gender="Female"),
        make_profile("f2", gender="Female"),
    ]
    result = compute_allocation(profiles, {"roomTemplates": [{"capacity": 2, "count": 2}]})

    genders_by_id = {p["user_id"]: p["gender"] for p in profiles}
    for room in result["allocations"]:
        room_genders = {genders_by_id[m] for m in room["members"]}
        assert len(room_genders) == 1, f"room {room['id']} is mixed-gender: {room['members']}"

    _all_accounted_for(result, [p["user_id"] for p in profiles])


def test_smoking_incompatible_pair_never_roomed_together(make_profile):
    """A smoker/non-smoker pair must never be roomed together, no matter how
    compatible they'd otherwise score - this is the exact class of bug the real
    D-305 production violation was (see docs/decisions.md #2): two profiles here are
    IDENTICAL except smoking_habit, so if hard-conflict enforcement ever regressed,
    the otherwise-perfect cosine similarity would make the matcher want to room them
    together immediately."""
    profiles = [
        make_profile("smoker", smoking_habit="Yes"),
        make_profile("nonsmoker", smoking_habit="No"),
    ]
    # Capacity exactly matches student count - the single most tempting
    # configuration for the matcher to room them together if it ignored the conflict.
    result = compute_allocation(profiles, {"roomTemplates": [{"capacity": 2, "count": 1}]})

    for room in result["allocations"]:
        assert not ({"smoker", "nonsmoker"} <= set(room["members"])), (
            f"hard-conflicting pair was roomed together in {room['id']}"
        )

    _all_accounted_for(result, ["smoker", "nonsmoker"])


def test_drinking_incompatible_pair_never_roomed_together(make_profile):
    """Same invariant as smoking, for the other unconditional hard constraint."""
    profiles = [
        make_profile("drinker", drinking_habit="Yes"),
        make_profile("nondrinker", drinking_habit="No"),
    ]
    result = compute_allocation(profiles, {"roomTemplates": [{"capacity": 2, "count": 1}]})

    for room in result["allocations"]:
        assert not ({"drinker", "nondrinker"} <= set(room["members"]))

    _all_accounted_for(result, ["drinker", "nondrinker"])


# ============================== 100% placement ==============================

def test_everyone_placed_when_fully_compatible(make_profile):
    """The happy path: with enough capacity and no conflicts, 100% of students are
    allocated and needsManualPlacement is empty."""
    profiles = [make_profile(f"s{i}") for i in range(6)]
    result = compute_allocation(profiles, {"roomTemplates": [{"capacity": 3, "count": 2}]})

    assert result["status"] == "COMPLETED"
    assert result["needsManualPlacement"] == []
    _all_accounted_for(result, [p["user_id"] for p in profiles])

    placed = set()
    for room in result["allocations"]:
        placed.update(room["members"])
    assert placed == {p["user_id"] for p in profiles}


def test_placement_accounted_for_even_with_an_irreconcilable_pair(make_profile):
    """The 100% placement invariant must hold even in the presence of a genuinely
    stuck student - "placed or explicitly flagged," never silently dropped."""
    profiles = [
        make_profile("a", smoking_habit="Yes"),
        make_profile("b", smoking_habit="No"),
    ]
    result = compute_allocation(profiles, {"roomTemplates": [{"capacity": 2, "count": 1}]})
    _all_accounted_for(result, ["a", "b"])


# ============================== needsManualPlacement correctness ==============================

def test_needs_manual_placement_names_the_real_blocking_conflict(make_profile):
    """Mirrors the original adversarial verification (docs/decisions.md #3): a
    genuinely irreconcilable pair (mutually hard-conflicting, no one else to pair
    with) must produce exactly one needsManualPlacement entry, with
    blocking_constraint == "hard_conflict" and checked_against naming the actual
    conflicting peer - not a vague/wrong reason, and not both students stuck when
    one of them could legitimately be placed alone."""
    profiles = [
        make_profile("a", smoking_habit="Yes"),
        make_profile("b", smoking_habit="No"),
    ]
    result = compute_allocation(profiles, {"roomTemplates": [{"capacity": 2, "count": 1}]})

    assert len(result["needsManualPlacement"]) == 1
    stuck = result["needsManualPlacement"][0]
    assert stuck["blocking_constraint"] == "hard_conflict"
    assert stuck["student_id"] in ("a", "b")

    other = "b" if stuck["student_id"] == "a" else "a"
    assert stuck["checked_against"] == [other]

    # The other student isn't just "not stuck" - they must actually appear placed.
    placed = set()
    for room in result["allocations"]:
        placed.update(room["members"])
    assert other in placed


def test_needs_manual_placement_hard_conflict_scoped_to_own_gender(make_profile):
    """A cross-gender "conflict" is never the real reason someone is stuck (gender
    segregation already makes them non-candidates regardless of habits) - this was a
    real bug (docs/decisions.md #6): whichever student(s) end up needing manual
    placement here, a hard_conflict reason must only ever name someone of their OWN
    gender as the blocking peer - checked generically (not hardcoding which specific
    student ends up stuck), since the flex-room step involves an internal shuffle."""
    genders = {"f_smoker": "Female", "f_nonsmoker": "Female", "m_alone": "Male"}
    profiles = [
        make_profile("f_smoker", gender="Female", smoking_habit="Yes"),
        make_profile("f_nonsmoker", gender="Female", smoking_habit="No"),
        make_profile("m_alone", gender="Male"),
    ]
    config = {"roomTemplates": [{"capacity": 2, "count": 2}]}
    result = compute_allocation(profiles, config)

    _all_accounted_for(result, list(genders.keys()))

    hard_conflict_entries = [e for e in result["needsManualPlacement"] if e["blocking_constraint"] == "hard_conflict"]
    assert hard_conflict_entries, "expected the smoker/non-smoker conflict to surface as at least one hard_conflict entry"

    for entry in hard_conflict_entries:
        stuck_gender = genders[entry["student_id"]]
        for other in entry["checked_against"]:
            assert genders[other] == stuck_gender, (
                f"{entry['student_id']} ({stuck_gender}) was checked against "
                f"{other} ({genders[other]}) - a different gender"
            )


# ============================== capacityShortfall ==============================

def test_capacity_shortfall_rejects_before_any_matching(make_profile):
    """total_beds < total_students must reject the whole run pre-flight - before
    matching starts, not as a partial/best-effort result."""
    profiles = [make_profile(f"s{i}") for i in range(5)]
    result = compute_allocation(profiles, {"roomTemplates": [{"capacity": 2, "count": 1}]})

    assert result["status"] == "REJECTED"
    assert result["allocations"] == []
    assert result["needsManualPlacement"] == []
    assert result["capacityShortfall"] == {
        "total_students": 5,
        "total_beds": 2,
        "shortfall": 3,
    }


def test_capacity_exactly_matching_does_not_reject(make_profile):
    """Sanity check on the boundary: total_beds == total_students must NOT reject."""
    profiles = [make_profile(f"s{i}") for i in range(4)]
    result = compute_allocation(profiles, {"roomTemplates": [{"capacity": 2, "count": 2}]})
    assert result["status"] == "COMPLETED"


# ============================== Room-size preference ==============================

def test_room_size_preference_honored_with_no_preference_as_filler_not_seed(make_profile):
    """A preference pass seeds groups ONLY from students who explicitly want that
    capacity, using "no preference" students purely as filler for any leftover
    slots. With 2 students preferring capacity 3 and enough no-preference students
    to fill the rest, the preferring pair must end up together with their
    preference satisfied - and specifically as the seed, not displaced by filler."""
    profiles = [
        make_profile("p1", preferred_room_size="3"),
        make_profile("p2", preferred_room_size="3"),
        make_profile("n1"), make_profile("n2"), make_profile("n3"), make_profile("n4"),
    ]
    config = {"roomTemplates": [{"capacity": 3, "count": 2}]}
    result = compute_allocation(profiles, config)

    rooms_by_member = {}
    for room in result["allocations"]:
        for m in room["members"]:
            rooms_by_member[m] = room

    assert rooms_by_member["p1"]["id"] == rooms_by_member["p2"]["id"], (
        "the two capacity-3-preferring students should have been seeded into the same room"
    )
    p1_room = rooms_by_member["p1"]
    assert p1_room["capacity"] == 3
    assert p1_room["preference_satisfaction"]["p1"] is True
    assert p1_room["preference_satisfaction"]["p2"] is True

    _all_accounted_for(result, [p["user_id"] for p in profiles])


def test_room_size_preference_falls_through_gracefully_when_unsatisfiable(make_profile):
    """A stated preference must never block placement: a student wanting capacity 4
    with only capacity-2 rooms configured must still be placed normally (falls
    through to ordinary fill), with their preference correctly recorded as
    unsatisfied rather than left stuck in needsManualPlacement."""
    profiles = [
        make_profile("wants4", preferred_room_size="4"),
        make_profile("n1"),
    ]
    config = {"roomTemplates": [{"capacity": 2, "count": 1}]}
    result = compute_allocation(profiles, config)

    assert result["needsManualPlacement"] == []
    room = result["allocations"][0]
    assert "wants4" in room["members"]
    assert room["capacity"] == 2
    assert room["preference_satisfaction"]["wants4"] is False


# ============================== Tier priority / MAX_EFFECTIVE_ROOM_SIZE ==============================

def test_expand_oversized_templates_never_exceeds_ceiling():
    """Direct unit check on the template-splitting logic itself: a misconfigured
    oversized tier (mirroring the real carnation capacity:23 incident, see
    docs/decisions.md #6) must never produce a template above MAX_EFFECTIVE_ROOM_SIZE,
    and must preserve the total bed count exactly - no invented or lost capacity."""
    templates = [{"capacity": 23, "count": 1}]
    expanded = expand_oversized_templates(templates)

    assert all(t["capacity"] <= MAX_EFFECTIVE_ROOM_SIZE for t in expanded)

    original_beds = 23 * 1
    expanded_beds = sum(t["capacity"] * t["count"] for t in expanded)
    assert expanded_beds == original_beds


def test_legitimate_tiers_used_before_oversized_virtual_ones(make_profile):
    """When legitimate configured capacity is already sufficient, a misconfigured
    oversized tier must never be touched at all - legitimate tiers are tried first
    (see the (is_virtual, -capacity) sort in executor.py/matcher_greedy.py)."""
    profiles = [make_profile(f"s{i}") for i in range(6)]
    config = {"roomTemplates": [
        {"capacity": 3, "count": 2},   # legitimate: exactly enough for 6 students
        {"capacity": 23, "count": 1},  # oversized/misconfigured - should stay unused
    ]}
    result = compute_allocation(profiles, config)

    assert result["status"] == "COMPLETED"
    for room in result["allocations"]:
        assert room["capacity"] <= MAX_EFFECTIVE_ROOM_SIZE
        # Only the legitimate 3-capacity tier should ever have been used here.
        assert room["capacity"] == 3


# ============================== room_capacity accuracy ==============================

def test_room_capacity_matches_the_real_template_it_was_built_from(make_profile):
    """The historical bug (docs/decisions.md #6): room_capacity was once read from a
    FIFO queue with no relationship to which template a room actually came from.
    With two distinct, fully-filled capacity tiers, every room's reported capacity
    must exactly match both its real template AND its actual member count."""
    profiles = [make_profile(f"s{i}") for i in range(6)]
    config = {"roomTemplates": [{"capacity": 2, "count": 1}, {"capacity": 4, "count": 1}]}
    result = compute_allocation(profiles, config)

    assert result["status"] == "COMPLETED"
    assert len(result["allocations"]) == 2

    capacities_seen = sorted(room["capacity"] for room in result["allocations"])
    assert capacities_seen == [2, 4]

    for room in result["allocations"]:
        assert room["capacity"] == len(room["members"]), (
            f"room {room['id']} reports capacity {room['capacity']} but has "
            f"{len(room['members'])} members"
        )
