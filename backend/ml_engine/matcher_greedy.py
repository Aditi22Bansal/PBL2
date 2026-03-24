import numpy as np
import uuid
from typing import List, Tuple
from sklearn.metrics.pairwise import cosine_similarity
from domain.schemas import StudentProfile
from ml_engine.encoder import encode_profile, has_hard_conflict, get_structural_penalty

def run_greedy_allocation_for_gender(
    profiles: List[StudentProfile], run_id: str
) -> Tuple[List[dict], List[str]]:
    """
    Groups students into triplets using a greedy optimization strategy based on their 
    weighted cosine similarities, whilst enforcing hard-conflict rules for incompatibilities.
    Uses optimized NumPy array operations to scale to 10k+ records.
    
    Returns:
        allocations (List[dict]): The created room allocations.
        unassigned_ids (List[str]): Student IDs that didn't fit into a triplet.
    """
    n = len(profiles)
    if n < 3:
        return [], [p.user_id for p in profiles]
        
    encoded_matrix = np.array([encode_profile(p) for p in profiles])
    sim_matrix = cosine_similarity(encoded_matrix)
    
    # Vectorized computation of penalties
    branches = np.array([p.branch for p in profiles])
    years = np.array([p.year_of_study for p in profiles])
    freq_map = {"No": 0, "Rarely": 1, "Occasionally": 2, "Weekly": 3, "Frequently": 4, "Yes": 4}
    smokes = np.array([freq_map.get(p.smoking_habit, 0) for p in profiles])
    mifs = np.array([p.most_important_factor for p in profiles])
    
    # 1. Match Structural Penalties
    branch_penalty = (branches[:, None] != branches[None, :]) * 10.0
    year_penalty = (years[:, None] != years[None, :]) * 10.0
    sim_matrix -= (branch_penalty + year_penalty)
    
    # 2. Hard conflicts
    smoke_diff = np.abs(smokes[:, None] - smokes[None, :]) >= 3
    ls_str = "Lifestyle Habits ( Smoking, Drinking, Guests, etc.)"
    has_ls_focus = (mifs == ls_str)
    ls_focus_matrix = has_ls_focus[:, None] | has_ls_focus[None, :]
    conflict_matrix = smoke_diff & ls_focus_matrix
    
    sim_matrix[conflict_matrix] = -9999.0
    np.fill_diagonal(sim_matrix, -np.inf)
    
    # Extract list of upper triangular pairs and sort by similarity
    i_idx, j_idx = np.triu_indices(n, k=1)
    pair_sims = sim_matrix[i_idx, j_idx]
    
    sorted_pairs = np.argsort(pair_sims)[::-1]
    sorted_i = i_idx[sorted_pairs]
    sorted_j = j_idx[sorted_pairs]
    
    assigned = np.zeros(n, dtype=bool)
    allocations = []
    
    total_pairs = len(sorted_i)
    pair_iter = 0
    chunk_size = 10000
    
    while np.sum(~assigned) >= 3 and pair_iter < total_pairs:
        # Fast-forward using Numpy chunks to instantly find the next valid A and B
        found_valid = False
        while pair_iter < total_pairs:
            end_idx = min(pair_iter + chunk_size, total_pairs)
            A_chunk = sorted_i[pair_iter:end_idx]
            B_chunk = sorted_j[pair_iter:end_idx]
            
            valid_mask = ~(assigned[A_chunk] | assigned[B_chunk])
            valid_indices = np.nonzero(valid_mask)[0]
            
            if len(valid_indices) > 0:
                pair_iter += int(valid_indices[0])
                found_valid = True
                break
            else:
                pair_iter = end_idx
                
        if not found_valid:
            break
            
        A = sorted_i[pair_iter]
        B = sorted_j[pair_iter]
        pair_iter += 1
            
        if sim_matrix[A, B] == -9999.0:
            # If highest similarity remaining is a hard conflict, break out.
            break
            
        valid_k = ~assigned.copy()
        valid_k[A] = False
        valid_k[B] = False
        valid_k &= (sim_matrix[A, :] != -9999.0)
        valid_k &= (sim_matrix[B, :] != -9999.0)
        
        if not np.any(valid_k):
            # Continue looking for other pairs since A & B couldn't find a C
            continue
            
        c_sims = sim_matrix[A, :] + sim_matrix[B, :]
        c_sims[~valid_k] = -np.inf
        
        best_C = int(np.argmax(c_sims))
        
        if c_sims[best_C] == -np.inf:
            continue
            
        assigned[A] = True
        assigned[B] = True
        assigned[best_C] = True
        
        avg_score = (sim_matrix[A, B] + sim_matrix[A, best_C] + sim_matrix[B, best_C]) / 3.0
        
        allocations.append({
            "id": f"room_{uuid.uuid4().hex[:8]}",
            "allocation_run_id": run_id,
            "gender_group": profiles[A].gender,
            "compatibility_score": round(float(avg_score), 4),
            "members": [profiles[A].user_id, profiles[B].user_id, profiles[best_C].user_id],
            "room_number": None
        })
        
    unassigned_ids = [profiles[i].user_id for i in range(n) if not assigned[i]]
    return allocations, unassigned_ids
