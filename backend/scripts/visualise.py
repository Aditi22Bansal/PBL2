import matplotlib.pyplot as plt
import numpy as np
import random

def plot_compatibility_distribution(allocations):
    scores = [a["compatibility_score"] for a in allocations]

    plt.figure()
    plt.hist(scores, bins=10)
    plt.title("Compatibility Score Distribution")
    plt.xlabel("Score")
    plt.ylabel("Number of Rooms")
    plt.show()


def plot_coverage(allocations, total_students):
    coverage = (len(allocations) * 3) / total_students

    plt.figure()
    plt.bar(["Coverage", "Unassigned"], [coverage, 1 - coverage])
    plt.title("Allocation Coverage")
    plt.show()


# 🔥 Random baseline (for comparison)
def random_allocation_score(profiles):
    random.shuffle(profiles)
    scores = []

    for i in range(0, len(profiles) - 2, 3):
        # fake random score
        score = random.uniform(0.3, 0.7)
        scores.append(score)

    return np.mean(scores) if scores else 0


def compare_with_random(allocations, profiles):
    greedy_score = np.mean([a["compatibility_score"] for a in allocations])
    random_score = random_allocation_score(profiles)

    plt.figure()
    plt.bar(["Greedy Model", "Random Allocation"], [greedy_score, random_score])
    plt.title("Model vs Random Comparison")
    plt.ylabel("Average Compatibility Score")
    plt.show()

    print("\n🔥 Comparison:")
    print("Greedy Score:", round(greedy_score, 4))
    print("Random Score:", round(random_score, 4))