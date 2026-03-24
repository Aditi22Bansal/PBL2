import pandas as pd
import random
import numpy as np
from datetime import datetime, timedelta

def main():
    seed_df = pd.read_csv('d:/projects/pbl2/Roommate Preferences.csv')
    cols = seed_df.columns.tolist()
    
    # Fill any missing
    for col in cols:
        mode_val = seed_df[col].mode()
        if not mode_val.empty:
            seed_df[col] = seed_df[col].fillna(mode_val[0])
        else:
            seed_df[col] = seed_df[col].fillna("Unknown")
            
    num_records_to_generate = 20000
    
    # Seed data rows
    seed_records = seed_df.to_dict('records')
    
    new_records = []
    
    start_time = datetime(2026, 3, 23, 12, 0, 0)
    
    noise_col = [c for c in cols if 'Noise Tolerance' in c][0]
    introvert_col = [c for c in cols if 'introverted' in c][0]
    respect_col = [c for c in cols if 'respect others' in c][0]
    routine_col = [c for c in cols if 'fixed routines' in c][0]
    belongings_col = [c for c in cols if 'sharing belongings' in c][0]
    roommate_pref_col = [c for c in cols if 'prefer my roommate to' in c][0]
    irritated_col = [c for c in cols if 'irritated easily' in c][0]
    timestamp_col = cols[0]
    
    # Night active col
    night_active_col = [c for c in cols if 'active late at night' in c]
    night_active_col = night_active_col[0] if night_active_col else None

    seen_combinations = set()

    i = 0
    while i < num_records_to_generate:
        base = random.choice(seed_records).copy()
        
        # 1. Modify age slightly
        try:
            age_str = str(base['Age (number only, e.g., 18)']).replace('+', '')
            age = int(float(age_str))
            base['Age (number only, e.g., 18)'] = str(min(25, max(17, age + random.randint(-2, 2))))
        except:
            pass
            
        # 2. Aggressive Likert Modification (80% chance to vary)
        likerts = [noise_col, introvert_col, irritated_col, respect_col, routine_col, belongings_col]
        for l_col in likerts:
            if random.random() < 0.8:
                try:
                    val = int(float(base[l_col]))
                    val = min(5, max(1, val + random.randint(-2, 2)))
                    base[l_col] = val
                except:
                    pass
        
        # 3. Categorical Modifiers (Randomly pick neighboring/diverse options)
        if random.random() < 0.5:
            base['Study Environment Preferences'] = random.choice(["Does not matter", "Music While Studying", "Light Background Noise", "Complete Silence"])
            
        if random.random() < 0.4:
            base['Room Organization Style'] = random.choice(["Random", "Flexible", "Semi Organized", "Highly Organized"])
             
        if random.random() < 0.4:
            base['Study hours per day'] = random.choice(["0-2", "2-4", "4-6", "6+"])
            
        if random.random() < 0.4:
            base['Guest/Friends Frequency'] = random.choice(["No", "Rarely", "Occasionally", "Weekly", "Frequently"])
            
        if random.random() < 0.3:
            base['  When conflicts arise, I usually:  '] = random.choice(["Avoid confrontation", "Get irritated but stay silent", "Seek third-person help", "Talk directly and resolve"])
            
        if random.random() < 0.4:
            base['Cleanliness Level'] = random.choice(["Messy", "Average", "Moderately Clean", "Very Clean"])
            
        # 3. Logical Consistency
        # Introvert -> roommate interaction
        try:
            intro_val = int(float(base[introvert_col]))
            if intro_val >= 4:
                base[roommate_pref_col] = random.choice(['Minimal interaction', 'Respect space mostly'])
            elif intro_val <= 2:
                base[roommate_pref_col] = random.choice(['Be moderately social', 'Be very interactive'])
        except:
            pass
            
        # Silence -> noise tolerance
        if base['Study Environment Preferences'] == 'Complete Silence':
            base[noise_col] = random.choices([1, 2, 3], weights=[0.6, 0.3, 0.1])[0]
        elif base['Study Environment Preferences'] == 'Light Background Noise':
            base[noise_col] = random.choices([2, 3, 4], weights=[0.2, 0.6, 0.2])[0]
            
        # Cleanliness -> cleanliness expectation
        if base['Cleanliness Level'] == 'Very Clean':
            base['Cleanliness expectation from roommates'] = 'Very Clean'
        elif base['Cleanliness Level'] == 'Messy':
            base['Cleanliness expectation from roommates'] = random.choice(['Moderate', 'Does not matter'])
        elif base['Cleanliness Level'] == 'Moderately Clean':
            base['Cleanliness expectation from roommates'] = random.choice(['Very Clean', 'Moderate', 'Does not matter'])
            
        # Sleep/Wake times
        sleep = base['Usual sleeping time']
        if sleep == 'After 2 am':
            wake = random.choices(['8-10 am', 'After 10 am', '6-8 am'], weights=[0.6, 0.3, 0.1])[0]
            sleep_pref = random.choices(['Late Sleeper', 'Does not matter'], weights=[0.8, 0.2])[0]
            night_active = random.choices(['Yes', 'Occasionally'], weights=[0.8, 0.2])[0]
        elif sleep == 'Before 10 pm':
            wake = random.choices(['Before 6 am', '6-8 am'], weights=[0.8, 0.2])[0]
            sleep_pref = random.choices(['Early Sleeper', 'Does not matter'], weights=[0.8, 0.2])[0]
            night_active = random.choices(['No', 'Rarely'], weights=[0.8, 0.2])[0]
        elif sleep == '10 pm to 12 am':
            wake = random.choices(['6-8 am', 'Before 6 am', '8-10 am'], weights=[0.7, 0.2, 0.1])[0]
            sleep_pref = random.choices(['Does not matter', 'Early Sleeper'], weights=[0.7, 0.3])[0]
            night_active = random.choices(['Rarely', 'No', 'Occasionally'], weights=[0.6, 0.3, 0.1])[0]
        else: # 12 am to 2 am
            wake = random.choices(['6-8 am', '8-10 am', 'After 10 am'], weights=[0.5, 0.4, 0.1])[0]
            sleep_pref = random.choices(['Late Sleeper', 'Does not matter'], weights=[0.5, 0.5])[0]
            night_active = random.choices(['Yes', 'Occasionally', 'Rarely'], weights=[0.6, 0.3, 0.1])[0]
            
        base['Usual Wake-up Time'] = wake
        base['Preferred roommate sleep type'] = sleep_pref
        if night_active_col:
            base[night_active_col] = night_active
            
        # 4. Variation for categorical (small chance to change branch or year)
        if random.random() < 0.1:
            base['Branch'] = random.choice(['CSE', 'AIML', 'RNA', 'ENTC', 'MECHANICAL', 'CIVIL'])
        if random.random() < 0.1:
            base['Year of Study'] = random.choice([1, 2, 3, 4])
            
        # Unique check across relevant features
        feature_tuple = tuple(str(v) for k, v in base.items() if k != timestamp_col)
        if feature_tuple in seen_combinations:
            continue
            
        seen_combinations.add(feature_tuple)
            
        # Timestamps
        t = start_time + timedelta(minutes=i*2 + random.randint(0, 5))
        base[timestamp_col] = t.strftime("%Y/%m/%d %I:%M:%S %p GMT+5:30")
        
        new_records.append(base)
        i += 1
        
    res_df = pd.DataFrame(new_records)
    res_df.to_csv('d:/projects/pbl2/roommate preferences.csv', index=False)
    print("Dataset generated successfully with", len(res_df), "unique records.")

if __name__ == "__main__":
    main()
