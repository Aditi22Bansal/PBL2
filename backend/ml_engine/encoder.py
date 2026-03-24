import numpy as np
from domain.schemas import StudentProfile

# Weights based on the implementation plan
# High = 3.0, Medium = 1.0, Low/Binary modifiers applied directly
WEIGHTS = {
    "sleep_time": 3.0,
    "wake_time": 3.0,
    "cleanliness": 3.0,
    "smoking_habit": 5.0,  # Critical Dealbreaker
    "drinking_habit": 4.0, # Dealbreaker
    "guest_frequency": 2.0,
    "study_env": 2.0,
    "active_late": 2.0,
    "light_preference": 2.0,
    "cleanliness_expectation": 3.0,
    "study_hours": 1.0,
    "room_org": 1.0,
    "conflict_style": 1.0,
    "introversion": 1.0,
    "noise_tolerance": 2.0,
}

def encode_profile(profile: StudentProfile) -> np.ndarray:
    """
    Converts a StudentProfile into a weighted numerical vector suitable for cosine similarity.
    """
    
    # 1. Ordinal variables
    sleep_map = {"Before 10 pm": 1, "10 pm to 12 am": 2, "12 am to 2 am": 3, "After 2 am": 4}
    wake_map = {"Before 6 am": 1, "6-8 am": 2, "8-10 am": 3, "After 10 am": 4}
    clean_map = {"Messy": 1, "Average": 2, "Moderately Clean": 3, "Very Clean": 4}
    
    # Study Env mapping (Rough ordinal: from Chaos to Silence)
    env_map = {"Does not matter": 1, "Music While Studying": 2, "Light Background Noise": 3, "Complete Silence": 4}
    
    # Boolean/Frequency
    freq_map = {"No": 0, "Rarely": 1, "Occasionally": 2, "Weekly": 3, "Frequently": 4, "Yes": 4}
    
    bool_map = {"No": 0, "Yes": 1, "Doesn’t matter": 0.5, "Does not matter": 0.5, "Dim light is fine": 0.5, "Yes , complete darkness": 1}
    
    study_hrs_map = {"0-2": 1, "2-4": 2, "4-6": 3, "6+": 4}

    conflict_map = {
        "Avoid confrontation": 1,
        "Get irritated but stay silent": 2,
        "Seek third-person help": 3,
        "Talk directly and resolve": 4
    }

    room_org_map = {"Random": 1, "Flexible": 2, "Semi Organized": 3, "Highly Organized": 4}

    # Extract features safely
    features = [
        # Sleep/Wake
        sleep_map.get(profile.sleep_time, 2) * WEIGHTS["sleep_time"],
        wake_map.get(profile.wake_time, 2) * WEIGHTS["wake_time"],
        
        # Cleanliness
        clean_map.get(profile.cleanliness, 2) * WEIGHTS["cleanliness"],
        clean_map.get(profile.cleanliness_expectation, 2) * WEIGHTS["cleanliness_expectation"],
        
        # Habits (High Weight)
        freq_map.get(profile.smoking_habit, 0) * WEIGHTS["smoking_habit"],
        freq_map.get(profile.drinking_habit, 0) * WEIGHTS["drinking_habit"],
        freq_map.get(profile.guest_frequency, 1) * WEIGHTS["guest_frequency"],
        
        # Environment
        env_map.get(profile.study_env, 1) * WEIGHTS["study_env"],
        bool_map.get(profile.active_late, 0.5) * WEIGHTS["active_late"],
        bool_map.get(profile.light_preference, 0.5) * WEIGHTS["light_preference"],
        
        # Personality & Study
        study_hrs_map.get(profile.study_hours, 2) * WEIGHTS["study_hours"],
        room_org_map.get(profile.room_org, 2) * WEIGHTS["room_org"],
        conflict_map.get(profile.conflict_style, 3) * WEIGHTS["conflict_style"],
        
        # Scaled Ints (1-5)
        profile.introversion * WEIGHTS["introversion"],
        profile.noise_tolerance * WEIGHTS["noise_tolerance"]
    ]
    
    return np.array(features, dtype=float)

def get_structural_penalty(p1: StudentProfile, p2: StudentProfile) -> float:
    """
    Applies major penalties if students are not from the same branch or year, 
    forcing the greedy matcher to group identical branches/years first before ever 
    considering cross-branch/year groupings.
    """
    penalty = 0.0
    if p1.branch != p2.branch:
        penalty += 10.0
    if p1.year_of_study != p2.year_of_study:
        penalty += 10.0
    return penalty

def has_hard_conflict(p1: StudentProfile, p2: StudentProfile) -> bool:
    """
    Checks if there are dealbreaker incompatibilities between two profiles.
    Returns True if incompatible.
    """
    # Example hard constraint: Non-smoker explicitly demanding incompatible habits
    freq_map = {"No": 0, "Rarely": 1, "Occasionally": 2, "Weekly": 3, "Frequently": 4, "Yes": 4}
    
    p1_smoke = freq_map.get(p1.smoking_habit, 0)
    p2_smoke = freq_map.get(p2.smoking_habit, 0)
    
    # If one is a frequent smoker and the other strongly prioritizes lifestyle habits and doesn't smoke
    if abs(p1_smoke - p2_smoke) >= 3:
        if p1.most_important_factor == "Lifestyle Habits ( Smoking, Drinking, Guests, etc.)" or \
           p2.most_important_factor == "Lifestyle Habits ( Smoking, Drinking, Guests, etc.)":
            return True
            
    return False
