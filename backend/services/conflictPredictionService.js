const Profile = require('../models/Profile');

const CONFLICT_LEVELS = {
    EXCELLENT: 'Excellent',
    GOOD: 'Good',
    NEEDS_ATTENTION: 'Needs Attention',
    HIGH_RISK: 'High Risk'
};

const RISK_THRESHOLDS = {
    EXCELLENT: 0,            // Conflict score = 0
    GOOD: 6,                 // Conflict score < 6
    NEEDS_ATTENTION: 15,     // Conflict score < 15
    HIGH_RISK: 15            // Conflict score >= 15
};

// Conversions for ordinal mappings
const sleepMap = { "Before 10 pm": 1, "10 pm to 12 am": 2, "12 am to 2 am": 3, "After 2 am": 4 };
const cleanMap = { "Messy": 1, "Average": 2, "Moderately Clean": 3, "Very Clean": 4 };
const guestMap = { "No": 1, "Rarely": 1, "Occasionally": 2, "Weekly": 3, "Frequently": 4, "Yes": 4 };

// Rules Registry
const rules = [
    {
        id: 'sleep_schedule',
        category: 'Sleep Schedule',
        severity: 'High',
        contributionScore: 8,
        evaluate: (profiles) => {
            const conflicts = [];
            let positive = null;
            let allClose = true;

            for (let i = 0; i < profiles.length; i++) {
                for (let j = i + 1; j < profiles.length; j++) {
                    const p1 = profiles[i];
                    const p2 = profiles[j];
                    const val1 = sleepMap[p1.sleep_time] || 2;
                    const val2 = sleepMap[p2.sleep_time] || 2;

                    if (Math.abs(val1 - val2) >= 2) {
                        allClose = false;
                        conflicts.push({
                            text: `${p1.name} (${p1.sleep_time}) and ${p2.name} (${p2.sleep_time}) have conflicting sleep schedules.`,
                            score: 8,
                            recommendation: "Establish a quiet/lights-out hours agreement."
                        });
                    } else if (Math.abs(val1 - val2) > 1) {
                        allClose = false;
                    }
                }
            }

            if (profiles.length > 1 && allClose && conflicts.length === 0) {
                positive = "Highly compatible sleep schedules.";
            }

            return { conflicts, positive };
        }
    },
    {
        id: 'cleanliness',
        category: 'Cleanliness',
        severity: 'High',
        contributionScore: 8,
        evaluate: (profiles) => {
            const conflicts = [];
            let positive = null;
            let allClose = true;

            for (let i = 0; i < profiles.length; i++) {
                for (let j = i + 1; j < profiles.length; j++) {
                    const p1 = profiles[i];
                    const p2 = profiles[j];
                    const val1 = cleanMap[p1.cleanliness] || 2;
                    const val2 = cleanMap[p2.cleanliness] || 2;

                    if (Math.abs(val1 - val2) >= 2) {
                        allClose = false;
                        conflicts.push({
                            text: `${p1.name} (${p1.cleanliness}) and ${p2.name} (${p2.cleanliness}) have a significant cleanliness mismatch.`,
                            score: 8,
                            recommendation: "Agree on a chore checklist and cleaning schedule."
                        });
                    } else if (Math.abs(val1 - val2) > 1) {
                        allClose = false;
                    }
                }
            }

            if (profiles.length > 1 && allClose && conflicts.length === 0) {
                positive = "Aligned cleanliness standards.";
            }

            return { conflicts, positive };
        }
    },
    {
        id: 'smoking',
        category: 'Smoking',
        severity: 'High',
        contributionScore: 10,
        evaluate: (profiles) => {
            const conflicts = [];
            let positive = null;
            let smokersCount = 0;

            for (let i = 0; i < profiles.length; i++) {
                if (profiles[i].smoking_habit === 'Yes') {
                    smokersCount++;
                }
            }

            if (smokersCount > 0 && smokersCount < profiles.length) {
                // Mismatch: Smoker assigned with Non-Smoker
                const smokerNames = profiles.filter(p => p.smoking_habit === 'Yes').map(p => p.name).join(', ');
                const nonSmokerNames = profiles.filter(p => p.smoking_habit !== 'Yes').map(p => p.name).join(', ');

                conflicts.push({
                    text: `Smoker assigned with non-smoker roommate(s): ${smokerNames} (Smoker) vs ${nonSmokerNames} (Non-smoker).`,
                    score: 10,
                    recommendation: "Suggest room swap to maintain smoke-free rooms."
                });
            } else if (smokersCount === 0 && profiles.length > 1) {
                positive = "Clean room environment (All Non-Smokers).";
            }

            return { conflicts, positive };
        }
    },
    {
        id: 'study_env',
        category: 'Noise',
        severity: 'Medium',
        contributionScore: 5,
        evaluate: (profiles) => {
            const conflicts = [];
            let positive = null;
            let silencePref = false;
            let musicPref = false;

            profiles.forEach(p => {
                if (p.study_env === 'Complete Silence') silencePref = true;
                if (p.study_env === 'Music While Studying') musicPref = true;
            });

            if (silencePref && musicPref) {
                conflicts.push({
                    text: `Clash on study environments (Complete Silence vs Music While Studying).`,
                    score: 5,
                    recommendation: "Advise using headphones during shared study hours."
                });
            } else if (profiles.length > 1 && !silencePref && !musicPref) {
                positive = "Flexible study habit expectations.";
            }

            return { conflicts, positive };
        }
    },
    {
        id: 'guests',
        category: 'Guests',
        severity: 'Medium',
        contributionScore: 5,
        evaluate: (profiles) => {
            const conflicts = [];
            let positive = null;

            for (let i = 0; i < profiles.length; i++) {
                for (let j = i + 1; j < profiles.length; j++) {
                    const p1 = profiles[i];
                    const p2 = profiles[j];
                    const v1 = guestMap[p1.guest_frequency] || 2;
                    const v2 = guestMap[p2.guest_frequency] || 2;

                    if (Math.abs(v1 - v2) >= 2) {
                        conflicts.push({
                            text: `${p1.name} (${p1.guest_frequency} guests) and ${p2.name} (${p2.guest_frequency} guests) have conflicting visitor expectations.`,
                            score: 5,
                            recommendation: "Draft a room guest policy outlining visit hours."
                        });
                    }
                }
            }

            const allLow = profiles.every(p => (guestMap[p.guest_frequency] || 2) <= 2);
            if (profiles.length > 1 && allLow) {
                positive = "Shared boundary for quiet privacy (low guests).";
            }

            return { conflicts, positive };
        }
    },
    {
        id: 'active_late',
        category: 'Noise',
        severity: 'Medium',
        contributionScore: 5,
        evaluate: (profiles) => {
            const conflicts = [];
            let positive = null;
            let hasActiveLate = false;
            let hasNoActiveLate = false;

            profiles.forEach(p => {
                if (p.active_late === 'Yes') hasActiveLate = true;
                if (p.active_late === 'No') hasNoActiveLate = true;
            });

            if (hasActiveLate && hasNoActiveLate) {
                conflicts.push({
                    text: `Mismatched late-night activity levels (Active vs Sleep-priority).`,
                    score: 5,
                    recommendation: "Install dim night lights/desk shields to isolate light/noise."
                });
            } else if (profiles.length > 1 && !hasActiveLate) {
                positive = "Compatible resting styles (low late-night activity).";
            }

            return { conflicts, positive };
        }
    },
    {
        id: 'room_temp',
        category: 'Temperature',
        severity: 'Low',
        contributionScore: 3,
        evaluate: (profiles) => {
            const conflicts = [];
            let positive = null;
            let coldPref = false;
            let warmPref = false;

            profiles.forEach(p => {
                if (p.temp_preference === 'Cold') coldPref = true;
                if (p.temp_preference === 'Warm') warmPref = true;
            });

            if (coldPref && warmPref) {
                conflicts.push({
                    text: `Different temperature preferences (Cold vs Warm).`,
                    score: 3,
                    recommendation: "Position beds optimally relative to AC/heater vents."
                });
            } else if (profiles.length > 1 && (coldPref || warmPref)) {
                positive = "Homogeneous room temperature preferences.";
            }

            return { conflicts, positive };
        }
    },
    {
        id: 'noise_tolerance',
        category: 'Noise',
        severity: 'Medium',
        contributionScore: 5,
        evaluate: (profiles) => {
            const conflicts = [];
            let positive = null;

            for (let i = 0; i < profiles.length; i++) {
                for (let j = i + 1; j < profiles.length; j++) {
                    const p1 = profiles[i];
                    const p2 = profiles[j];
                    const n1 = p1.noise_tolerance ?? 3;
                    const n2 = p2.noise_tolerance ?? 3;

                    if (Math.abs(n1 - n2) >= 3) {
                        conflicts.push({
                            text: `Wide gap in noise tolerance between ${p1.name} (Tol: ${n1}) and ${p2.name} (Tol: ${n2}).`,
                            score: 5,
                            recommendation: "Establish a clear noise covenant for shared hours."
                        });
                    }
                }
            }

            const allClose = profiles.every((p, _, arr) => Math.abs((p.noise_tolerance ?? 3) - (arr[0].noise_tolerance ?? 3)) <= 1);
            if (profiles.length > 1 && allClose) {
                positive = "Aligned noise tolerance expectations.";
            }

            return { conflicts, positive };
        }
    },
    {
        id: 'sharing_comfort',
        category: 'Sharing',
        severity: 'Medium',
        contributionScore: 5,
        evaluate: (profiles) => {
            const conflicts = [];
            let positive = null;

            for (let i = 0; i < profiles.length; i++) {
                for (let j = i + 1; j < profiles.length; j++) {
                    const p1 = profiles[i];
                    const p2 = profiles[j];
                    const s1 = p1.sharing_comfort ?? 3;
                    const s2 = p2.sharing_comfort ?? 3;

                    if (Math.abs(s1 - s2) >= 3) {
                        conflicts.push({
                            text: `Differing boundaries on sharing belongings (${p1.name} vs ${p2.name}).`,
                            score: 5,
                            recommendation: "Establish boundaries on shared items on day one."
                        });
                    }
                }
            }

            const allComfortable = profiles.every(p => (p.sharing_comfort ?? 3) >= 4);
            if (profiles.length > 1 && allComfortable) {
                positive = "Mutual comfort with sharing belongings.";
            }

            return { conflicts, positive };
        }
    }
];

/**
 * Analyzes conflict data for a single room
 */
const analyzeRoom = (room, roommateProfiles) => {
    const roomId = room.room_number || room._id.toString();
    // Raw compatibility can now be negative: rooms form even at very low/negative
    // compatibility rather than being rejected (see matcher_greedy.py's removed
    // score-threshold gates), since 100% placement is a hard requirement.
    // rawCompatibilityScore keeps that number for internal ranking/debugging;
    // compatibilityScore is floored at 0 so nothing student-facing ever shows a
    // confusing negative percentage.
    const rawCompatibilityScore = Math.round((room.compatibility_score || 0) * 100);
    const compatibilityScore = Math.max(0, rawCompatibilityScore);

    const conflictReasons = [];
    const positiveFactors = [];
    const recommendationsSet = new Set();
    let totalConflictScore = 0;

    // Run rules
    rules.forEach(rule => {
        const { conflicts, positive } = rule.evaluate(roommateProfiles);
        
        if (conflicts && conflicts.length > 0) {
            conflicts.forEach(c => {
                conflictReasons.push({
                    text: c.text,
                    category: rule.category,
                    severity: rule.severity,
                    score: c.score
                });
                totalConflictScore += c.score;
                if (c.recommendation) {
                    recommendationsSet.add(c.recommendation);
                }
            });
        }
        
        if (positive) {
            positiveFactors.push(positive);
        }
    });

    // Determine risk category based on score
    let conflictRisk = CONFLICT_LEVELS.EXCELLENT;
    if (totalConflictScore >= RISK_THRESHOLDS.HIGH_RISK) {
        conflictRisk = CONFLICT_LEVELS.HIGH_RISK;
    } else if (totalConflictScore > 0 && totalConflictScore < RISK_THRESHOLDS.GOOD) {
        conflictRisk = CONFLICT_LEVELS.GOOD;
    } else if (totalConflictScore >= RISK_THRESHOLDS.GOOD) {
        conflictRisk = CONFLICT_LEVELS.NEEDS_ATTENTION;
    }

    // Default recommendation if empty
    if (recommendationsSet.size === 0) {
        if (conflictRisk === CONFLICT_LEVELS.EXCELLENT) {
            recommendationsSet.add("No action required. Perfect matching parameters.");
        } else {
            recommendationsSet.add("Standard roommate agreement recommended.");
        }
    }

    // Map roommate preferences securely (privacy-sensitive)
    const roommatePreferences = roommateProfiles.map(p => ({
        name: p.name,
        email: p.user_id,
        sleep_time: p.sleep_time,
        cleanliness: p.cleanliness,
        study_env: p.study_env,
        smoking: p.smoking_habit === 'Yes' ? 'Smoker' : 'Non-smoker'
    }));

    return {
        roomId,
        compatibilityScore,
        rawCompatibilityScore,
        conflictRisk,
        conflictScore: totalConflictScore,
        conflictReasons: conflictReasons.sort((a, b) => b.score - a.score), // Rank by contribution score
        positiveFactors,
        recommendations: Array.from(recommendationsSet),
        roommatePreferences
    };
};

/**
 * Aggregates statistics across all rooms
 */
const analyzeAllRooms = (allocations, profiles) => {
    let excellentCount = 0;
    let goodCount = 0;
    let needsAttentionCount = 0;
    let highRiskCount = 0;

    const conflictCausesCounts = {
        "Sleep Schedule": 0,
        "Cleanliness": 0,
        "Smoking": 0,
        "Noise": 0,
        "Guests": 0
    };

    const analyzedRooms = allocations.map(a => {
        // Find matching roommate profiles
        const roommates = profiles.filter(p => a.members.includes(p.user_id));
        const analysis = analyzeRoom(a, roommates);

        // Count levels
        if (analysis.conflictRisk === CONFLICT_LEVELS.EXCELLENT) excellentCount++;
        else if (analysis.conflictRisk === CONFLICT_LEVELS.GOOD) goodCount++;
        else if (analysis.conflictRisk === CONFLICT_LEVELS.NEEDS_ATTENTION) needsAttentionCount++;
        else if (analysis.conflictRisk === CONFLICT_LEVELS.HIGH_RISK) highRiskCount++;

        // Count category causes
        analysis.conflictReasons.forEach(cr => {
            if (conflictCausesCounts[cr.category] !== undefined) {
                conflictCausesCounts[cr.category]++;
            }
        });

        return analysis;
    });

    // Dynamic administrative insight recommendations
    const insights = [];
    
    if (highRiskCount > 0) {
        insights.push({
            id: 'risk-action',
            text: `${highRiskCount} room(s) have been flagged as HIGH RISK and require immediate manual review or swapping.`,
            type: 'danger'
        });
    }

    if (needsAttentionCount > 0) {
        insights.push({
            id: 'attention-monitoring',
            text: `${needsAttentionCount} room(s) have minor conflicts (Needs Attention) and should be monitored.`,
            type: 'warning'
        });
    }

    // Specific conflict warnings
    Object.entries(conflictCausesCounts).forEach(([category, count]) => {
        if (count >= 5) {
            insights.push({
                id: `conflict-${category.toLowerCase().replace(' ', '-')}`,
                text: `${count} rooms have conflicting preferences regarding ${category}.`,
                type: 'warning'
            });
        }
    });

    if (highRiskCount === 0 && needsAttentionCount === 0) {
        insights.push({
            id: 'allocation-excellence',
            text: `Hostel allocation quality is excellent! No rooms require manual review.`,
            type: 'success'
        });
    }

    return {
        summary: {
            excellentCount,
            goodCount,
            needsAttentionCount,
            highRiskCount
        },
        conflictCauses: conflictCausesCounts,
        insights,
        rooms: analyzedRooms
    };
};

module.exports = {
    analyzeRoom,
    analyzeAllRooms,
    CONFLICT_LEVELS,
    RISK_THRESHOLDS
};
