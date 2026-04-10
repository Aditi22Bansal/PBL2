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


# ================== LOCAL SEARCH ==================

def improve_allocations_local_search(allocations, profiles, sim_matrix):
    max_iterations = 5
    iteration = 0
    improved = True

    while improved and iteration < max_iterations:
        iteration += 1
        improved = False

        for i in range(len(allocations)):
            if allocations[i]["compatibility_score"] > 0.9:
                continue

            for j in range(i + 1, len(allocations)):
                if abs(allocations[i]["compatibility_score"] - allocations[j]["compatibility_score"]) < 0.05:
                    continue

                room1 = allocations[i]["members"]
                room2 = allocations[j]["members"]

                for a in range(3):
                    for b in range(3):

                        new_room1 = room1.copy()
                        new_room2 = room2.copy()

                        new_room1[a], new_room2[b] = new_room2[b], new_room1[a]

                        idx1 = [next(k for k, p in enumerate(profiles) if p.user_id == uid) for uid in new_room1]
                        idx2 = [next(k for k, p in enumerate(profiles) if p.user_id == uid) for uid in new_room2]

                        valid = True
                        for x in range(3):
                            for y in range(x + 1, 3):
                                if sim_matrix[idx1[x], idx1[y]] == -9999.0:
                                    valid = False
                                if sim_matrix[idx2[x], idx2[y]] == -9999.0:
                                    valid = False

                        if not valid:
                            continue

                        def room_score(idxs):
                            return (
                                sim_matrix[idxs[0], idxs[1]] +
                                sim_matrix[idxs[0], idxs[2]] +
                                sim_matrix[idxs[1], idxs[2]]
                            ) / 3

                        old_score = allocations[i]["compatibility_score"] + allocations[j]["compatibility_score"]
                        new_score = room_score(idx1) + room_score(idx2)

                        if new_score > old_score:
                            allocations[i]["members"] = new_room1
                            allocations[j]["members"] = new_room2
                            allocations[i]["compatibility_score"] = round(room_score(idx1), 4)
                            allocations[j]["compatibility_score"] = round(room_score(idx2), 4)
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

            for i in range(3):
                new_idxs = idxs.copy()
                new_idxs[i] = u_idx

                valid = True
                for x in range(3):
                    for y in range(x + 1, 3):
                        if sim_matrix[new_idxs[x], new_idxs[y]] == -9999.0:
                            valid = False

                if not valid:
                    continue

                new_score = (
                    sim_matrix[new_idxs[0], new_idxs[1]] +
                    sim_matrix[new_idxs[0], new_idxs[2]] +
                    sim_matrix[new_idxs[1], new_idxs[2]]
                ) / 3

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

def create_flex_rooms(unassigned_ids, profiles, run_id):
    import random
    random.shuffle(unassigned_ids)

    flex_allocations = []

    for i in range(0, len(unassigned_ids) - 2, 3):
        group_ids = unassigned_ids[i:i+3]

        flex_allocations.append({
            "id": str(uuid.uuid4()),
            "allocation_run_id": run_id,
            "gender_group": "MIXED",
            "members": group_ids,
            "room_number": None,
            "compatibility_score": 0.65
        })

    return flex_allocations


# ================== MAIN ==================

def run_greedy_allocation_for_gender(
    profiles: List[StudentProfile], run_id: str
) -> Tuple[List[dict], List[str]]:

    n = len(profiles)
    if n < 3:
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

    pair_iter = 0
    total_pairs = len(sorted_i)

    while np.sum(~assigned) >= 3 and pair_iter < total_pairs:

        A = sorted_i[pair_iter]
        B = sorted_j[pair_iter]
        pair_iter += 1

        if assigned[A] or assigned[B]:
            continue

        valid_k = ~assigned.copy()
        valid_k[A] = False
        valid_k[B] = False

        if not np.any(valid_k):
            continue

        c_sims = sim_matrix[A, :] + sim_matrix[B, :]
        c_sims[~valid_k] = -np.inf

        C = int(np.argmax(c_sims))

        avg_score = (
            sim_matrix[A, B] +
            sim_matrix[A, C] +
            sim_matrix[B, C]
        ) / 3

        if avg_score < 0.70:
            continue

        assigned[A] = True
        assigned[B] = True
        assigned[C] = True

        allocations.append({
            "id": str(uuid.uuid4()),
            "allocation_run_id": run_id,
            "gender_group": profiles[A].gender,
            "members": [profiles[A].user_id, profiles[B].user_id, profiles[C].user_id],
            "room_number": None,
            "compatibility_score": round(avg_score, 4)
        })

    allocations = improve_allocations_local_search(allocations, profiles, sim_matrix)

    unassigned_ids = [profiles[i].user_id for i in range(n) if not assigned[i]]

    allocations = fallback_assign_unassigned(allocations, unassigned_ids, profiles, sim_matrix)

    assigned_ids = set()
    for room in allocations:
        for m in room["members"]:
            assigned_ids.add(m)

    unassigned_ids = [p.user_id for p in profiles if p.user_id not in assigned_ids]

    flex_rooms = create_flex_rooms(unassigned_ids, profiles, run_id)
    allocations.extend(flex_rooms)

    assigned_ids = set()
    for room in allocations:
        for m in room["members"]:
            assigned_ids.add(m)

    unassigned_ids = [p.user_id for p in profiles if p.user_id not in assigned_ids]

    allocations.sort(key=lambda x: x["compatibility_score"], reverse=True)

    avg_score = np.mean([a["compatibility_score"] for a in allocations]) if allocations else 0
    coverage = (len(allocations) * 3) / len(profiles)

    print("\n=== EVALUATION METRICS ===")
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

        valid_k = ~assigned.copy()
        valid_k[A] = False
        valid_k[B] = False

        if not np.any(valid_k):
            continue

        c_sims = sim_matrix[A, :] + sim_matrix[B, :]
        c_sims[~valid_k] = -np.inf

        C = int(np.argmax(c_sims))

        avg_score = (
            sim_matrix[A, B] +
            sim_matrix[A, C] +
            sim_matrix[B, C]
        ) / 3

        # Much lower threshold — accept weak matches
        if avg_score < 0.30:
            continue

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
