from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class User(BaseModel):
    id: str  # Email is used as ID here for simplicity
    email: str
    name: str
    role: str = "STU"
    gender: str

class StudentProfile(BaseModel):
    user_id: str
    name: str = "Unknown Name"
    age: int
    gender: str
    year_of_study: str
    branch: str
    
    # Lifestyle and Preferences
    sleep_time: str
    wake_time: str
    cleanliness: str
    study_env: str
    guest_frequency: str
    smoking_habit: str
    drinking_habit: str
    loud_alarms: str
    first_time_hostel: str
    temp_preference: str
    study_hours: str
    active_late: str
    conflict_style: str
    room_org: str
    noise_tolerance: int
    introversion: int
    irritation: int
    personal_space: int
    fixed_routines: int
    sharing_comfort: int
    
    # Expectations
    pref_roommate_sleep: str
    pref_roommate_social: str
    cleanliness_expectation: str
    light_preference: str
    most_important_factor: str

class AllocationRun(BaseModel):
    id: str
    status: str
    total_expected: int
    total_submitted: int
    algorithm_used: str

class RoomAllocation(BaseModel):
    id: str
    allocation_run_id: str
    gender_group: str
    compatibility_score: float
    members: List[str]  # List of User IDs
    room_number: Optional[str] = None
