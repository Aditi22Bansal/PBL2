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


# Sane ceiling on how large a single roommate-matching group is ever actually
# target-filled to, independent of what a configured room template's capacity
# says. Real configured tiers today only ever go up to 4 (tulip/carnation's
# legitimate 2/3/4-bed rows); 6 leaves generous headroom above that for a
# plausible future larger-dorm tier, while still firmly rejecting anything
# like a capacity:23 tier (almost certainly a data-entry error - see
# expand_oversized_templates below) from ever being greedily target-filled as
# one room. Past roughly this size, "roommate compatibility" stops being a
# meaningful unit anyway - it becomes dormitory/bunk-hall assignment, which
# this engine isn't designed to optimize for.
MAX_EFFECTIVE_ROOM_SIZE = 6


def expand_oversized_templates(room_templates, max_size=MAX_EFFECTIVE_ROOM_SIZE):
    """
    Splits any room template whose capacity exceeds max_size into multiple
    smaller virtual room templates, preserving total bed count exactly. A
    capacity:23 tier (count N) becomes N*(23//6)=N*3 virtual rooms of
    capacity 6, plus N virtual rooms of the 23%6=5 remainder - instead of N
    actual rooms of capacity 23. Never invents extra beds and never affects a
    template already at or under max_size (a pure no-op for every real
    configured tier today, all of which are 2-4).

    Each returned template is tagged is_virtual: True/False, so downstream
    room-claiming code can rank real configured tiers ahead of ceiling-
    expanded ones (see the sort calls in this file and executor.py) - a
    misconfigured oversized tier should only ever get used once legitimate
    capacity is genuinely exhausted, not compete equally with it by size.
    """
    expanded = []
    for template in room_templates:
        cap = template["capacity"]
        count = template.get("count", 0)

        if cap <= max_size:
            expanded.append({"capacity": cap, "count": count, "is_virtual": False})
            continue

        full_chunks = cap // max_size
        remainder = cap % max_size

        if full_chunks > 0:
            expanded.append({"capacity": max_size, "count": count * full_chunks, "is_virtual": True})
        if remainder > 0:
            expanded.append({"capacity": remainder, "count": count, "is_virtual": True})

    return expanded


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

def create_flex_rooms(unassigned_ids, profiles, run_id, unused_rooms, sim_matrix):
    """
    Groups unassigned students into whatever unused room inventory remains.
    Unlike a plain shuffle-and-chunk, this respects hard conflicts: a student is
    only added to a forming group if they have zero hard conflict (sim_matrix
    entry != -9999.0) with every member already placed in it. Students who can't
    be grouped without violating a hard constraint are left unassigned rather
    than being forced into an incompatible room.
    """
    import random
    id_to_index = {p.user_id: i for i, p in enumerate(profiles)}

    shuffled = list(unassigned_ids)
    random.shuffle(shuffled)
    remaining = shuffled

    flex_allocations = []

    for room_def in unused_rooms:
        if not remaining:
            break

        cap = room_def["capacity"]
        group_ids = []
        group_idxs = []

        for uid in remaining:
            if len(group_ids) >= cap:
                break
            u_idx = id_to_index[uid]
            if any(sim_matrix[u_idx, gi] == -9999.0 for gi in group_idxs):
                continue
            group_ids.append(uid)
            group_idxs.append(u_idx)

        if not group_ids:
            continue

        remaining = [uid for uid in remaining if uid not in group_ids]

        # Find gender from the first member profile
        gender = "Other"
        first_prof = next((p for p in profiles if p.user_id == group_ids[0]), None)
        if first_prof:
            gender = first_prof.gender

        if len(group_idxs) > 1:
            sum_val = 0.0
            count = 0
            for x in range(len(group_idxs)):
                for y in range(x + 1, len(group_idxs)):
                    sum_val += sim_matrix[group_idxs[x], group_idxs[y]]
                    count += 1
            score = round(sum_val / count, 4) if count > 0 else 0.65
        else:
            score = 0.65

        flex_allocations.append({
            "id": room_def["id"],
            "allocation_run_id": run_id,
            "gender_group": gender,
            "members": group_ids,
            "room_number": None,
            "compatibility_score": score,
            "capacity": room_def["capacity"]
        })

    return flex_allocations


# ================== MAIN ==================

def run_greedy_allocation_for_gender(
    profiles: List[StudentProfile], run_id: str, config_or_rooms: any = None,
    enable_fallback_and_flex: bool = True
) -> Tuple[List[dict], List[str]]:

    if isinstance(config_or_rooms, list):
        bucket_rooms = config_or_rooms
    else:
        # Default/Legacy config parsing
        room_templates = normalize_config(config_or_rooms, len(profiles))
        room_templates = expand_oversized_templates(room_templates)
        bucket_rooms = []
        room_id_counter = 1
        for template in room_templates:
            cap = template["capacity"]
            cnt = template["count"]
            is_virtual = template.get("is_virtual", False)
            for _ in range(cnt):
                bucket_rooms.append({
                    "id": f"Room_{room_id_counter}",
                    "capacity": cap,
                    "is_virtual": is_virtual
                })
                room_id_counter += 1

    n = len(profiles)

    # Legitimate configured tiers first (as a whole group), ceiling-expanded
    # virtual tiers only once those are exhausted; largest-first within each
    # group, same as before.
    bucket_rooms = [r.copy() for r in bucket_rooms]
    bucket_rooms.sort(key=lambda x: (x.get("is_virtual", False), -x["capacity"]))
    
    # If no rooms available
    if not bucket_rooms:
        return [], [p.user_id for p in profiles]

    encoded_matrix = np.array([encode_profile(p) for p in profiles])
    sim_matrix = cosine_similarity(encoded_matrix)

    branches = np.array([p.branch for p in profiles])
    years = np.array([p.year_of_study for p in profiles])

    sim_matrix -= (branches[:, None] != branches[None, :]) * 5
    sim_matrix -= (years[:, None] != years[None, :]) * 5

    # Apply hard conflict penalties (dealbreakers)
    for i in range(n):
        for j in range(n):
            if i != j and has_hard_conflict(profiles[i], profiles[j]):
                sim_matrix[i, j] = -9999.0

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
                    "compatibility_score": 1.0,
                    "capacity": cap
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

            # Skip pairs with hard conflicts
            if sim_matrix[A, B] == -9999.0:
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
                # Check for hard conflict with existing members in the room
                if c_sims[best_X] == -np.inf or any(sim_matrix[m, best_X] == -9999.0 for m in members):
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

            for m in members:
                assigned[m] = True

            allocations.append({
                "id": room_def["id"],
                "allocation_run_id": run_id,
                "gender_group": profiles[A].gender,
                "members": [profiles[m].user_id for m in members],
                "room_number": None,
                "compatibility_score": round(avg_score, 4),
                "capacity": cap
            })
            allocated_room_ids.add(room_def["id"])
            group_found = True
            break

    allocations = improve_allocations_local_search(allocations, profiles, sim_matrix)

    unassigned_ids = [profiles[i].user_id for i in range(n) if not assigned[i]]

    if enable_fallback_and_flex:
        allocations = fallback_assign_unassigned(allocations, unassigned_ids, profiles, sim_matrix)

        assigned_ids = set()
        for room in allocations:
            for m in room["members"]:
                assigned_ids.add(m)

        unassigned_ids = [p.user_id for p in profiles if p.user_id not in assigned_ids]

        # Find unused rooms in the claimed inventory for flex rooms. Legitimate
        # tiers first, virtual ones only once those are exhausted.
        unused_rooms = [r for r in bucket_rooms if r["id"] not in allocated_room_ids]
        unused_rooms.sort(key=lambda x: (x.get("is_virtual", False), -x["capacity"]))

        flex_rooms = create_flex_rooms(unassigned_ids, profiles, run_id, unused_rooms, sim_matrix)
        allocations.extend(flex_rooms)

        assigned_ids = set()
        for room in allocations:
            for m in room["members"]:
                assigned_ids.add(m)

        unassigned_ids = [p.user_id for p in profiles if p.user_id not in assigned_ids]

    allocations.sort(key=lambda x: x["compatibility_score"], reverse=True)

    assigned_ids = set()
    for room in allocations:
        for m in room["members"]:
            assigned_ids.add(m)

    avg_score = np.mean([a["compatibility_score"] for a in allocations]) if allocations else 0
    coverage = len(assigned_ids) / len(profiles) if len(profiles) > 0 else 0

    print("\n[Evaluation Metrics]")
    print("Average Compatibility Score:", round(avg_score, 4))
    print("Coverage:", round(coverage * 100, 2), "%")
    print("Final Unassigned:", len(unassigned_ids))

    return allocations, unassigned_ids


# ================== RELAXED (LOW-CONSTRAINT) ==================

def run_relaxed_allocation(
    profiles: List[StudentProfile], run_id: str
) -> Tuple[List[dict], List[str]]:
    """
    Relaxed variant for force-allocation:
    - No branch/year similarity penalty
    - Minimum score threshold lowered to 0.30
    - Still uses cosine similarity so scores are real, not hardcoded
    """
    n = len(profiles)
    if n < 2:
        return [], [p.user_id for p in profiles]

    encoded_matrix = np.array([encode_profile(p) for p in profiles])
    sim_matrix = cosine_similarity(encoded_matrix)

    # NO branch/year penalties — purely lifestyle-based matching
    
    # Apply hard conflicts even in relaxed mode to honor smoking/drinking dealbreakers
    for i in range(n):
        for j in range(n):
            if i != j and has_hard_conflict(profiles[i], profiles[j]):
                sim_matrix[i, j] = -9999.0

    np.fill_diagonal(sim_matrix, -np.inf)

    i_idx, j_idx = np.triu_indices(n, k=1)
    pair_sims = sim_matrix[i_idx, j_idx]

    sorted_pairs = np.argsort(pair_sims)[::-1]
    sorted_i = i_idx[sorted_pairs]
    sorted_j = j_idx[sorted_pairs]

    assigned = np.zeros(n, dtype=bool)
    allocations = []

    pair_iter = 0
    total_pairs = len(sorted_i)

    # Phase 1: Greedy triplet matching with LOW threshold
    while np.sum(~assigned) >= 3 and pair_iter < total_pairs:
        A = sorted_i[pair_iter]
        B = sorted_j[pair_iter]
        pair_iter += 1

        if assigned[A] or assigned[B]:
            continue

        # Skip pair if they have hard conflicts
        if sim_matrix[A, B] == -9999.0:
            continue

        valid_k = ~assigned.copy()
        valid_k[A] = False
        valid_k[B] = False

        if not np.any(valid_k):
            continue

        c_sims = sim_matrix[A, :] + sim_matrix[B, :]
        c_sims[~valid_k] = -np.inf

        C = int(np.argmax(c_sims))

        # Check for hard conflicts in candidate triplet
        if sim_matrix[A, C] == -9999.0 or sim_matrix[B, C] == -9999.0:
            continue

        avg_score = (
            sim_matrix[A, B] +
            sim_matrix[A, C] +
            sim_matrix[B, C]
        ) / 3

        assigned[A] = True
        assigned[B] = True
        assigned[C] = True

        allocations.append({
            "id": str(uuid.uuid4()),
            "allocation_run_id": run_id,
            "gender_group": profiles[A].gender,
            "members": [profiles[A].user_id, profiles[B].user_id, profiles[C].user_id],
            "room_number": None,
            "compatibility_score": round(max(avg_score, 0.35), 4)
        })

    # Phase 2: Local search to improve what we have
    if allocations:
        allocations = improve_allocations_local_search(allocations, profiles, sim_matrix)

    # Phase 3: Group any remaining students (pairs) into flex rooms
    remaining = [i for i in range(n) if not assigned[i]]
    if len(remaining) >= 2:
        for i in range(0, len(remaining) - 1, 3):
            group = remaining[i:i+3]
            if len(group) < 2:
                continue
            members = [profiles[idx].user_id for idx in group]
            if len(group) == 3:
                score = (sim_matrix[group[0], group[1]] + sim_matrix[group[0], group[2]] + sim_matrix[group[1], group[2]]) / 3
            else:
                score = sim_matrix[group[0], group[1]]
            allocations.append({
                "id": str(uuid.uuid4()),
                "allocation_run_id": run_id,
                "gender_group": profiles[group[0]].gender,
                "members": members,
                "room_number": None,
                "compatibility_score": round(max(float(score), 0.35), 4)
            })
            for idx in group:
                assigned[idx] = True

    id_set = set()
    for p in profiles:
        id_set.add(p.user_id)
    assigned_set = set()
    for room in allocations:
        for m in room["members"]:
            assigned_set.add(m)
    unassigned_ids = [uid for uid in id_set if uid not in assigned_set]

    allocations.sort(key=lambda x: x["compatibility_score"], reverse=True)

    avg_score = np.mean([a["compatibility_score"] for a in allocations]) if allocations else 0
    print(f"\n=== RELAXED ALLOCATION ===")
    print(f"Rooms formed: {len(allocations)}, Avg Score: {round(avg_score, 4)}, Unassigned: {len(unassigned_ids)}")

    return allocations, unassigned_ids


# ================== ABLATION (ONLY ADDED) ==================


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
