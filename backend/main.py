from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
import uuid
from datetime import datetime
import pandas as pd
import requests
import io

from domain.schemas import StudentProfile, RoomAllocation, AllocationRun, User
from repositories.csv_repo import CSVRepository
from ml_engine.matcher_greedy import run_greedy_allocation_for_gender, run_ablation_study

app = FastAPI(title="SIT Pune Hostel Allocator")

# To be secured by Supabase JWT later
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency Injection for DAL
def get_repository():
    return CSVRepository()

@app.get("/health")
def health_check():
    return {"status": "ok", "version": "1.0.0"}

@app.get("/system/status")
def get_system_status(repo: CSVRepository = Depends(get_repository)):
    expected = 300 # Demo value representing total capacity
    submitted = len(repo.get_all_profiles())
    return {
        "expected": expected,
        "submitted": submitted,
        "remaining": max(0, expected - submitted)
    }

@app.get("/admin/allocations")
def get_allocations(repo: CSVRepository = Depends(get_repository)):
    import pandas as pd
    import os
    if not os.path.exists(repo.allocations_path):
        return []
    try:
        df = pd.read_csv(repo.allocations_path)
        df = df.fillna("") # Fixes NaN to JSON compliance ValueError
        return df.to_dict(orient="records")
    except Exception:
        return []

@app.get("/admin/unassigned")
def get_unassigned(repo: CSVRepository = Depends(get_repository)):
    import pandas as pd
    import os
    if not os.path.exists(repo.unassigned_path):
        return []
    try:
        df = pd.read_csv(repo.unassigned_path)
        df = df.fillna("")
        records = df.to_dict(orient="records")
        all_profs = repo.get_all_profiles()
        prof_dict = {p.user_id: p for p in all_profs}
        for r in records:
            p = prof_dict.get(r.get("user_id"))
            if p:
                r["branch"] = p.branch
                r["year"] = p.year_of_study
                r["gender"] = p.gender
                r["name"] = p.name
            else:
                r["branch"] = "Unknown"
                r["year"] = "Unknown"
                r["gender"] = "Unknown"
                r["name"] = "Unknown Name"
        return records
    except Exception:
        return []

@app.get("/student/allocation/{user_id}")
def get_my_allocation(user_id: str, repo: CSVRepository = Depends(get_repository)):
    alloc = repo.get_room_allocation_for_user(user_id)
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found or pending.")
    return alloc.model_dump()

class SyncRequest(BaseModel):
    sheet_url: str

@app.post("/admin/sync-google-sheet")
def sync_google_sheet(request: SyncRequest, repo: CSVRepository = Depends(get_repository)):
    url = request.sheet_url
    if not url:
        raise HTTPException(status_code=400, detail="sheet_url is required")
        
    try:
        if "pubhtml" in url:
            url = url.replace("pubhtml", "pub?output=csv")
        elif "/edit" in url or "/view" in url:
            import re
            url = re.sub(r"/(edit|view).*$", "/export?format=csv", url)

        response = requests.get(url)
        response.raise_for_status()
        
        content_text = response.content.decode('utf-8')
        
        if content_text.strip().startswith("<!DOCTYPE html>") or "<html" in content_text[:200].lower():
            raise Exception("The link returned an HTML website instead of CSV data.")

        csv_data = io.StringIO(content_text)
        df = pd.read_csv(csv_data, on_bad_lines="skip")
        
        df.to_csv(repo.profiles_path, index=False)
        
        return {
            "message": "Successfully synchronized Google Sheet data",
            "records_synced": len(df)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync Google Sheet: {str(e)}")

@app.post("/admin/allocation/trigger")
def trigger_allocation_run(repo: CSVRepository = Depends(get_repository)):
    run_id = f"run_{uuid.uuid4().hex[:8]}"
    
    all_profiles = repo.get_all_profiles()
    
    from collections import defaultdict
    buckets = defaultdict(list)
    for p in all_profiles:
        key = (p.gender, p.branch, p.year_of_study)
        buckets[key].append(p)
    
    all_allocs = []
    all_unassigned = []
    
    for key, profiles in buckets.items():
        if len(profiles) == 0:
            continue
            
        allocs, unassigned = run_greedy_allocation_for_gender(profiles, run_id)
        
        # 🔥 ABLATION ADDED (ONLY CHANGE)
        run_ablation_study(profiles)
        
        g, b, y = key
        for a in allocs:
            a["gender_group"] = f"{g}_{b}_Yr{y}"
            
        all_allocs.extend(allocs)
        all_unassigned.extend(unassigned)
    
    room_counter = 1
    
    prof_dict = {p.user_id: p for p in all_profiles}
    def get_prof(email):
        p = prof_dict.get(email)
        if p:
            return p.name, p.branch, p.year_of_study
        return "Unknown Name", "Unknown", "Unknown"
        
    for a in all_allocs:
        a["id"] = f"Room {room_counter}"
        room_counter += 1
        
        enriched_members = []
        for em in a["members"]:
            n, b, y = get_prof(em)
            enriched_members.append(f"{n}::{em}::{b}::{y}")
        a["members"] = enriched_members
    
    room_schemas = [RoomAllocation(**a) for a in all_allocs]
    repo.save_room_allocations(room_schemas)
    
    repo.save_unassigned_students(run_id, all_unassigned)
    
    run_record = AllocationRun(
        id=run_id,
        status="COMPLETED",
        total_expected=300,
        total_submitted=len(all_profiles),
        algorithm_used="Weighted Cosine Greedy Triplet"
    )
    repo.save_allocation_run(run_record)
    
    return {
        "message": "Allocation Run Completed",
        "run_id": run_id,
        "total_rooms_formed": len(all_allocs),
        "total_unassigned_students": len(all_unassigned)
    }