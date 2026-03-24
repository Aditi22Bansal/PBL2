import pandas as pd
from typing import List, Optional
import os
import uuid
from domain.schemas import User, StudentProfile, RoomAllocation, AllocationRun
from repositories.base_repo import DataRepository

class CSVRepository(DataRepository):
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.profiles_path = os.path.join(data_dir, "profiles.csv")
        self.users_path = os.path.join(data_dir, "users.csv")
        self.allocations_path = os.path.join(data_dir, "allocations.csv")
        self.unassigned_path = os.path.join(data_dir, "unassigned.csv")
        self.runs_path = os.path.join(data_dir, "allocation_runs.csv")
        
        # Ensure directories and files exist
        os.makedirs(data_dir, exist_ok=True)
        for path in [self.users_path, self.allocations_path, self.unassigned_path, self.runs_path]:
            if not os.path.exists(path):
                pd.DataFrame().to_csv(path, index=False)

    def _normalize_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        # Define strict mapping for our expected dataset
        COL_MAP = {
            "Timestamp": "timestamp",
            "Age (number only, e.g., 18)": "age",
            "Gender": "gender",
            "Year of Study": "year_of_study",
            "Branch": "branch",
            "Usual sleeping time": "sleep_time",
            "Usual Wake-up Time": "wake_time",
            "Cleanliness Level": "cleanliness",
            "Study Environment Preferences": "study_env",
            "Guest/Friends Frequency": "guest_frequency",
            "Smoking Habit": "smoking_habit",
            "Drinking Habit": "drinking_habit",
            "  Do you use loud alarms in the morning?  ": "loud_alarms",
            "  Is this your first time living in a hostel?  ": "first_time_hostel",
            "Room Temperature Preference": "temp_preference",
            "Study hours per day": "study_hours",
            "  Are you active late at night (calls, laptop, etc.)?  ": "active_late",
            "  When conflicts arise, I usually:  ": "conflict_style",
            "Room Organization Style": "room_org",
            "I am introverted.": "introversion",
            "I get irritated easily.": "irritation",
            "  I respect others’ personal space.  ": "personal_space",
            "  I prefer fixed routines.  ": "fixed_routines",
            "  I am comfortable sharing belongings.  ": "sharing_comfort",
            "Preferred roommate sleep type": "pref_roommate_sleep",
            "  I prefer my roommate to:  ": "pref_roommate_social",
            "Cleanliness expectation from roommates": "cleanliness_expectation",
            "Light Preference at Night": "light_preference",
            "  Which factor matters most to you when selecting a roommate?  ": "most_important_factor"
        }
        
        # We need a fallback mechanism for the weird new-line ones
        renamed = {}
        for col in df.columns:
            cleaned_col = col.strip()
            # Direct match
            if col in COL_MAP:
                renamed[col] = COL_MAP[col]
            elif cleaned_col in COL_MAP:
                renamed[col] = COL_MAP[cleaned_col]
            elif "Noise" in col:
                renamed[col] = "noise_tolerance"
            elif "name" in cleaned_col.lower() and "roommate" not in cleaned_col.lower():
                renamed[col] = "name"
            elif "Email" in col or "email" in cleaned_col.lower():
                renamed[col] = "email"

        df = df.rename(columns=renamed)
        # Assuming the CSV we were given doesn't have an email column yet, let's auto-generate `user_id` based on index if missing
        return df

    def get_all_profiles(self) -> List[StudentProfile]:
        if not os.path.exists(self.profiles_path):
            return []
            
        df = pd.read_csv(self.profiles_path)
        df = self._normalize_columns(df)
        df = df.fillna("")
        
        profiles = []
        records = df.to_dict('records')
        for i, row in enumerate(records):
            def g(key, default):
                val = row.get(key)
                if val == "" or str(val).strip().lower() == "nan" or val is None:
                    return default
                return val

            # For the demo CSV, we mock the user_id if email column doesn't exist
            user_id = g("email", f"student_{i}@sitpune.edu.in")
            
            # Fill missing numeric info with defaults
            try:
                profile = StudentProfile(
                    user_id=str(user_id),
                    name=str(g("name", "Unknown Name")),
                    age=int(float(g("age", 18))),
                    gender=str(g("gender", "Male")),
                    year_of_study=str(g("year_of_study", "1")),
                    branch=str(g("branch", "Unknown")),
                    sleep_time=str(g("sleep_time", "Unknown")),
                    wake_time=str(g("wake_time", "Unknown")),
                    cleanliness=str(g("cleanliness", "Average")),
                    study_env=str(g("study_env", "Does not matter")),
                    guest_frequency=str(g("guest_frequency", "Occasionally")),
                    smoking_habit=str(g("smoking_habit", "No")),
                    drinking_habit=str(g("drinking_habit", "No")),
                    loud_alarms=str(g("loud_alarms", "No")),
                    first_time_hostel=str(g("first_time_hostel", "No")),
                    temp_preference=str(g("temp_preference", "Moderate")),
                    study_hours=str(g("study_hours", "2-4")),
                    active_late=str(g("active_late", "No")),
                    conflict_style=str(g("conflict_style", "Talk directly and resolve")),
                    room_org=str(g("room_org", "Semi Organized")),
                    noise_tolerance=int(float(g("noise_tolerance", 3))),
                    introversion=int(float(g("introversion", 3))),
                    irritation=int(float(g("irritation", 3))),
                    personal_space=int(float(g("personal_space", 3))),
                    fixed_routines=int(float(g("fixed_routines", 3))),
                    sharing_comfort=int(float(g("sharing_comfort", 3))),
                    pref_roommate_sleep=str(g("pref_roommate_sleep", "Does not matter")),
                    pref_roommate_social=str(g("pref_roommate_social", "Does not matter")),
                    cleanliness_expectation=str(g("cleanliness_expectation", "Moderate")),
                    light_preference=str(g("light_preference", "Doesn’t matter")),
                    most_important_factor=str(g("most_important_factor", "Personality"))
                )
                profiles.append(profile)
            except Exception as e:
                print(f"Skipping row {i} due to parsing error: {e}")
        return profiles

    def get_profiles_by_gender(self, gender: str) -> List[StudentProfile]:
        all_profiles = self.get_all_profiles()
        return [p for p in all_profiles if p.gender.lower() == gender.lower()]

    def get_student_profile(self, user_id: str) -> Optional[StudentProfile]:
        profiles = self.get_all_profiles()
        for p in profiles:
            if p.user_id == str(user_id):
                return p
        return None

    def save_student_profile(self, profile: StudentProfile):
        pass # To be implemented for appending single records
        
    def get_user(self, email: str) -> Optional[User]:
        pass

    def save_user(self, user: User):
        pass

    def save_allocation_run(self, run: AllocationRun):
        df = pd.DataFrame([run.model_dump()])
        if os.path.exists(self.runs_path) and os.path.getsize(self.runs_path) > 0:
            df.to_csv(self.runs_path, mode='a', header=False, index=False)
        else:
            df.to_csv(self.runs_path, mode='w', header=True, index=False)

    def save_room_allocations(self, allocations: List[RoomAllocation]):
        records = []
        for a in allocations:
            record = a.model_dump()
            record['members'] = ",".join(a.members) # Flatten list for CSV
            records.append(record)
        
        df = pd.DataFrame(records)
        df.to_csv(self.allocations_path, index=False)

    def save_unassigned_students(self, run_id: str, unassigned_ids: List[str]):
        df = pd.DataFrame([{"run_id": run_id, "user_id": uid} for uid in unassigned_ids])
        df.to_csv(self.unassigned_path, index=False)

    def get_room_allocation_for_user(self, user_id: str) -> Optional[RoomAllocation]:
        if not os.path.exists(self.allocations_path) or os.path.getsize(self.allocations_path) == 0:
            return None
            
        df = pd.read_csv(self.allocations_path)
        for _, row in df.iterrows():
            members = str(row['members']).split(',')
            if user_id in members:
                return RoomAllocation(
                    id=str(row['id']),
                    allocation_run_id=str(row['allocation_run_id']),
                    gender_group=str(row['gender_group']),
                    compatibility_score=float(row['compatibility_score']),
                    members=members,
                    room_number=str(row.get('room_number', ''))
                )
        return None
