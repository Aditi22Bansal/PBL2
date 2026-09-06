import os
import sys

# executor.py itself assumes backend/ is on sys.path (it does the same append for its
# own `from domain.schemas import ...`) - do it here too, so `from ml_engine.executor
# import compute_allocation` resolves regardless of the directory pytest is invoked
# from (repo root, backend/, or anywhere else).
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

# Every field defaulted to one identical baseline, so any two profiles built from
# this factory are maximally compatible unless a test deliberately overrides a field
# to introduce a real difference - makes "would this pair get roomed together if the
# constraint being tested didn't exist" the honest default, not an accident of
# incidentally-mismatched filler data.
_DEFAULTS = dict(
    name="Test Student",
    age=20,
    gender="Male",
    year_of_study="1st Year",
    branch="CSE",
    preferred_room_size="No preference",
    accessibility_need="None",
    sleep_time="Before 10 pm",
    wake_time="6-8 am",
    cleanliness="Very Clean",
    study_env="Complete Silence",
    guest_frequency="Rarely",
    smoking_habit="No",
    drinking_habit="No",
    loud_alarms="No",
    first_time_hostel="Yes",
    temp_preference="Cool",
    study_hours="2-4",
    active_late="No",
    conflict_style="Talk directly and resolve",
    room_org="Semi Organized",
    noise_tolerance=3,
    introversion=3,
    irritation=3,
    personal_space=3,
    fixed_routines=3,
    sharing_comfort=3,
    pref_roommate_sleep="Does not matter",
    pref_roommate_social="Does not matter",
    cleanliness_expectation="Does not matter",
    light_preference="Does not matter",
    most_important_factor="Cleanliness",
)


@pytest.fixture
def make_profile():
    """Factory fixture: make_profile(user_id, **overrides) -> a minimal, fully-valid
    profile dict (matches StudentProfile's real required fields)."""
    def _make(user_id, **overrides):
        profile = dict(_DEFAULTS)
        profile["user_id"] = user_id
        profile.update(overrides)
        return profile
    return _make
