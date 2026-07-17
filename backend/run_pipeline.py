import sys
import os
import pandas as pd

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from repositories.csv_repo import CSVRepository
from main import trigger_allocation_run

# 1. Read the Excel file or download the regression Google Sheet dataset
import requests
import io
import re

excel_path = r"d:\projects\pbl2\backend\Roommate Preferences (Responses).xlsx"
url = "https://docs.google.com/spreadsheets/d/1SBbYmHlOJeUd0qFOMovVG6IDzE55x9XUI2lPf6QzlOQ/edit?gid=688168951#gid=688168951"

if os.path.exists(excel_path):
    print(f"Reading {excel_path}...")
    try:
        df = pd.read_excel(excel_path)
    except ImportError:
        import subprocess
        print("Installing openpyxl...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "openpyxl"])
        df = pd.read_excel(excel_path)
else:
    print("Excel file not found locally. Downloading regression Google Sheet dataset...")
    download_url = re.sub(r"/(edit|view).*$", "/export?format=csv", url)
    res = requests.get(download_url)
    res.raise_for_status()
    df = pd.read_csv(io.StringIO(res.content.decode('utf-8')))

repo = CSVRepository()
df.to_csv(repo.profiles_path, index=False)
print(f"Saved {len(df)} records to {repo.profiles_path}")

# 2. Run the allocation
print("Triggering allocation run...")
result = trigger_allocation_run(repo)
print(result)

# 3. Check accuracy
alloc_path = repo.allocations_path
alloc_df = pd.read_csv(alloc_path)
if alloc_df.empty or 'compatibility_score' not in alloc_df.columns:
    print("Error: No allocations generated or missing 'compatibility_score'.")
else:
    total_rooms = len(alloc_df)
    avg_score = alloc_df['compatibility_score'].mean() * 100
    min_score = alloc_df['compatibility_score'].min() * 100
    max_score = alloc_df['compatibility_score'].max() * 100
    positive_matches = len(alloc_df[alloc_df['compatibility_score'] > 0])
    positive_pct = (positive_matches / total_rooms) * 100 if total_rooms > 0 else 0

    print("\n" + "="*50)
    print("      ROOMMATE MATCHING MODEL ACCURACY REPORT")
    print("="*50)
    print(f"Total Rooms Allocated      : {total_rooms:,}")
    print(f"Overall Model Accuracy     : {avg_score:.2f}%")
    print("-" * 50)
    print(f"Minimum Match Score        : {min_score:.2f}%")
    print(f"Maximum Match Score        : {max_score:.2f}%")
    print(f"Rooms Matching > 0%        : {positive_pct:.2f}%")
    print("="*50 + "\n")
