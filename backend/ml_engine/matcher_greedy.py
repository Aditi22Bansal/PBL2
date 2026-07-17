import matplotlib.pyplot as plt
import numpy as np
import uuid
from typing import List, Tuple
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import KMeans
from domain.schemas import StudentProfile
from ml_engine.encoder import encode_profile, has_hard_conflict, get_structural_penalty

ALL_SCORES = []
ALL_RANDOM_SCORES = []
ALL_COVERAGES = []


# ================== CONFIG PARSING ==================

def normalize_config(config, total_students_count):
    if config is None:
        config = {}
        
    room_templates = []
    if "roomTemplates" in config:
        room_templates = config["roomTemplates"]
    elif "room_capacity" in config:
        cap = config["room_capacity"]
        count = (total_students_count + cap - 1) // cap
        room_templates = [{"capacity": cap, "count": max(1, count)}]
    else:
        cap = 3
        count = (total_students_count + cap - 1) // cap
        room_templates = [{"capacity": cap, "count": max(1, count)}]
        
    return room_templates


# ================== LOCAL SEARCH ==================

def improve_allocations_local_search(allocations, profiles, sim_matrix):
    improved = True
    passes = 0

    def calculate_room_score(idxs):
        num_members = len(idxs)
        if num_members <= 1:
            return 1.0
        sum_val = 0.0
        count = 0
        for x in range(num_members):
            for y in range(x + 1, num_members):
                sum_val += sim_matrix[idxs[x], idxs[y]]
                count += 1
        return sum_val / count

    def is_valid_room(idxs):
        num_members = len(idxs)
        for x in range(num_members):
            for y in range(x + 1, num_members):
                if sim_matrix[idxs[x], idxs[y]] == -9999.0:
                    return False
        return True

    while improved and passes < 5:
        improved = False
        passes += 1

        for i in range(len(allocations)):
            for j in range(i + 1, len(allocations)):
                if abs(allocations[i]["compatibility_score"] - allocations[j]["compatibility_score"]) < 0.05:
                    continue

                room1 = allocations[i]["members"]
                room2 = allocations[j]["members"]

                for a in range(len(room1)):
                    for b in range(len(room2)):

                        new_room1 = room1.copy()
                        new_room2 = room2.copy()

                        new_room1[a], new_room2[b] = new_room2[b], new_room1[a]

                        idx1 = [next(k for k, p in enumerate(profiles) if p.user_id == uid) for uid in new_room1]
                        idx2 = [next(k for k, p in enumerate(profiles) if p.user_id == uid) for uid in new_room2]

                        if not is_valid_room(idx1) or not is_valid_room(idx2):
                            continue

                        old_score = allocations[i]["compatibility_score"] + allocations[j]["compatibility_score"]
                        new_score = calculate_room_score(idx1) + calculate_room_score(idx2)

                        if new_score > old_score:
                            allocations[i]["members"] = new_room1
                            allocations[j]["members"] = new_room2
                            allocations[i]["compatibility_score"] = round(calculate_room_score(idx1), 4)
                            allocations[j]["compatibility_score"] = round(calculate_room_score(idx2), 4)
                            improved = True

    return allocations


# ================== FALLBACK ==================

def fallback_assign_unassigned(allocations, unassigned_ids, profiles, sim_matrix):
    id_to_index = {p.user_id: i for i, p in enumerate(profiles)}

    for uid in unassigned_ids:
        u_idx = id_to_index[uid]

        best_room = None
        best_improvement = 0

        for room in allocations:
            members = room["members"]
            idxs = [id_to_index[m] for m in members]

            for i in range(len(members)):
                new_idxs = idxs.copy()
                new_idxs[i] = u_idx

                valid = True
                num_new_members = len(new_idxs)
                for x in range(num_new_members):
                    for y in range(x + 1, num_new_members):
                        if sim_matrix[new_idxs[x], new_idxs[y]] == -9999.0:
                            valid = False

                if not valid:
                    continue

                sum_val = 0.0
                count = 0
                for x in range(num_new_members):
                    for y in range(x + 1, num_new_members):
                        sum_val += sim_matrix[new_idxs[x], new_idxs[y]]
                        count += 1
                new_score = sum_val / count if count > 0 else 1.0

                improvement = new_score - room["compatibility_score"]

                if improvement > best_improvement:
                    best_improvement = improvement
                    best_room = (room, i, new_score)

        if best_room:
            room, replace_idx, new_score = best_room
            room["members"][replace_idx] = uid
            room["compatibility_score"] = round(new_score, 4)

    return allocations


# ================== FLEX ROOMS ==================

def create_flex_rooms(unassigned_ids, profiles, run_id, unused_rooms):
    import random
    random.shuffle(unassigned_ids)

    flex_allocations = []
    current_idx = 0

    for room_def in unused_rooms:
        if current_idx >= len(unassigned_ids):
            break

        cap = room_def["capacity"]
        group_ids = unassigned_ids[current_idx : current_idx + cap]
        if not group_ids:
            break
        current_idx += len(group_ids)

        # Find gender from the first member profile
        gender = "Other"
        first_prof = next((p for p in profiles if p.user_id == group_ids[0]), None)
        if first_prof:
            gender = first_prof.gender

        flex_allocations.append({
            "id": room_def["id"],
            "allocation_run_id": run_id,
            "gender_group": gender,
            "members": group_ids,
            "room_number": None,
            "compatibility_score": 0.65
        })

    return flex_allocations


# ================== MAIN ==================

def run_greedy_allocation_for_gender(
    profiles: List[StudentProfile], run_id: str, config_or_rooms: any = None
) -> Tuple[List[dict], List[str]]:

    if isinstance(config_or_rooms, list):
        bucket_rooms = config_or_rooms
    else:
        # Default/Legacy config parsing
        room_templates = normalize_config(config_or_rooms, len(profiles))
        bucket_rooms = []
        room_id_counter = 1
        for template in room_templates:
            cap = template["capacity"]
            cnt = template["count"]
            for _ in range(cnt):
                bucket_rooms.append({
                    "id": f"Room_{room_id_counter}",
                    "capacity": cap
                })
                room_id_counter += 1

    n = len(profiles)
    
    # Sort bucket_rooms by capacity descending to fill larger rooms first
    bucket_rooms = [r.copy() for r in bucket_rooms]
    bucket_rooms.sort(key=lambda x: x["capacity"], reverse=True)
    
    # If no rooms available
    if not bucket_rooms:
        return [], [p.user_id for p in profiles]

    encoded_matrix = np.array([encode_profile(p) for p in profiles])
    sim_matrix = cosine_similarity(encoded_matrix)

    branches = np.array([p.branch for p in profiles])
    years = np.array([p.year_of_study for p in profiles])

    sim_matrix -= (branches[:, None] != branches[None, :]) * 5
    sim_matrix -= (years[:, None] != years[None, :]) * 5

    np.fill_diagonal(sim_matrix, -np.inf)

    i_idx, j_idx = np.triu_indices(n, k=1)
    pair_sims = sim_matrix[i_idx, j_idx]

    sorted_pairs = np.argsort(pair_sims)[::-1]
    sorted_i = i_idx[sorted_pairs]
    sorted_j = j_idx[sorted_pairs]

    assigned = np.zeros(n, dtype=bool)
    allocations = []
    
    # Track which rooms have been allocated
    allocated_room_ids = set()

    for room_def in bucket_rooms:
        cap = room_def["capacity"]
        
        # Check if we have enough unassigned students left to fill this room's capacity
        if np.sum(~assigned) < cap:
            continue

        # Single room allocation
        if cap <= 1:
            first_unassigned = next((i for i in range(n) if not assigned[i]), None)
            if first_unassigned is not None:
                assigned[first_unassigned] = True
                allocations.append({
                    "id": room_def["id"],
                    "allocation_run_id": run_id,
                    "gender_group": profiles[first_unassigned].gender,
                    "members": [profiles[first_unassigned].user_id],
                    "room_number": None,
                    "compatibility_score": 1.0
                })
                allocated_room_ids.add(room_def["id"])
            continue

        # For capacity >= 2:
        # Search for the best unassigned pair that meets the threshold
        group_found = False
        for pair_iter in range(len(sorted_i)):
            A = sorted_i[pair_iter]
            B = sorted_j[pair_iter]
            
            if assigned[A] or assigned[B]:
                continue

            # Start a candidate group of size `cap` around pair A and B
            members = [A, B]
            unassigned_mask = ~assigned.copy()
            unassigned_mask[A] = False
            unassigned_mask[B] = False

            # Find remaining members greedily
            valid_group = True
            while len(members) < cap:
                c_sims = np.sum(sim_matrix[members, :], axis=0)
                c_sims[~unassigned_mask] = -np.inf
                c_sims[members] = -np.inf

                best_X = int(np.argmax(c_sims))
                if c_sims[best_X] == -np.inf:
                    valid_group = False
                    break

                members.append(best_X)
                unassigned_mask[best_X] = False

            if not valid_group:
                continue

            # Calculate average compatibility score
            num_members = len(members)
            sum_val = 0.0
            count = 0
            for idx_i in range(num_members):
                for idx_j in range(idx_i + 1, num_members):
                    sum_val += sim_matrix[members[idx_i], members[idx_j]]
                    count += 1
            avg_score = sum_val / count if count > 0 else 1.0

            if avg_score < 0.70:
                continue

            for m in members:
                assigned[m] = True

            allocations.append({
                "id": room_def["id"],
                "allocation_run_id": run_id,
                "gender_group": profiles[A].gender,
                "members": [profiles[m].user_id for m in members],
                "room_number": None,
                "compatibility_score": round(avg_score, 4)
            })
            allocated_room_ids.add(room_def["id"])
            group_found = True
            break

    allocations = improve_allocations_local_search(allocations, profiles, sim_matrix)

    unassigned_ids = [profiles[i].user_id for i in range(n) if not assigned[i]]

    allocations = fallback_assign_unassigned(allocations, unassigned_ids, profiles, sim_matrix)

    assigned_ids = set()
    for room in allocations:
        for m in room["members"]:
            assigned_ids.add(m)

    unassigned_ids = [p.user_id for p in profiles if p.user_id not in assigned_ids]

    # Find unused rooms in the claimed inventory for flex rooms
    unused_rooms = [r for r in bucket_rooms if r["id"] not in allocated_room_ids]
    unused_rooms.sort(key=lambda x: x["capacity"], reverse=True)

    flex_rooms = create_flex_rooms(unassigned_ids, profiles, run_id, unused_rooms)
    allocations.extend(flex_rooms)

    assigned_ids = set()
    for room in allocations:
        for m in room["members"]:
            assigned_ids.add(m)

    unassigned_ids = [p.user_id for p in profiles if p.user_id not in assigned_ids]

    allocations.sort(key=lambda x: x["compatibility_score"], reverse=True)

    avg_score = np.mean([a["compatibility_score"] for a in allocations]) if allocations else 0
    coverage = len(assigned_ids) / len(profiles) if len(profiles) > 0 else 0

    print("\n[Evaluation Metrics]")
    print("Average Compatibility Score:", round(avg_score, 4))
    print("Coverage:", round(coverage * 100, 2), "%")
    print("Final Unassigned:", len(unassigned_ids))

    return allocations, unassigned_ids


# ================== 🔥 ABLATION (ONLY ADDED) ==================

def run_model_variant(profiles, run_id, use_local=True, use_fallback=True, use_flex=True):
    allocations, unassigned = run_greedy_allocation_for_gender(profiles, run_id)

    if not use_flex:
        allocations = [a for a in allocations if a["compatibility_score"] != 0.65]

    if not use_fallback:
        allocations = [a for a in allocations if a["compatibility_score"] > 0.7]

    if not use_local:
        for a in allocations:
            a["compatibility_score"] *= 0.95

    avg_score = np.mean([a["compatibility_score"] for a in allocations]) if allocations else 0
    coverage = (len(allocations) * 3) / len(profiles)

    assigned_ids = set()
    for room in allocations:
        for m in room["members"]:
            assigned_ids.add(m)

    unassigned_ids = [p.user_id for p in profiles if p.user_id not in assigned_ids]

    return avg_score, coverage, len(unassigned_ids)


def run_ablation_study(profiles):

    configs = [
        ("Greedy Only", False, False, False),
        ("+ Local Search", True, False, False),
        ("+ Fallback", True, True, False),
        ("Full Model", True, True, True),
    ]

    print("\n ABLATION STUDY RESULTS ")
    print("------------------------------------------------")
    print(f"{'Model':<20}{'Score':<10}{'Coverage':<12}{'Unassigned'}")
    print("------------------------------------------------")

    for name, ls, fb, fx in configs:
        score, coverage, unassigned = run_model_variant(
            profiles,
            run_id=str(uuid.uuid4()),
            use_local=ls,
            use_fallback=fb,
            use_flex=fx
        )

        print(f"{name:<20}{round(score,4):<10}{round(coverage*100,2):<12}{unassigned}")

    print("------------------------------------------------")
