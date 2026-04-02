import numpy as np

def evaluate_allocations(allocations, profiles, unassigned_ids):
    print("\n📊 EVALUATION METRICS\n")

    # 1. Average Compatibility Score
    if len(allocations) > 0:
        avg_score = np.mean([a["compatibility_score"] for a in allocations])
    else:
        avg_score = 0

    print(f"Average Compatibility Score: {avg_score:.4f}")

    # 2. Coverage
    total_students = len(profiles)
    assigned_students = len(allocations) * 3
    coverage = assigned_students / total_students if total_students > 0 else 0

    print(f"Coverage: {coverage*100:.2f}%")

    # 3. Unassigned Students
    print(f"Unassigned Students: {len(unassigned_ids)}")

    # 4. Basic Insight
    if coverage > 0.9:
        print("✅ Excellent allocation coverage")
    elif coverage > 0.7:
        print("⚠️ Moderate coverage")
    else:
        print("❌ Low coverage — needs improvement")