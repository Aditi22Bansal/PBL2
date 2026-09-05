const Profile = require('../models/Profile');
const RoomAllocation = require('../models/RoomAllocation');
const conflictService = require('./conflictPredictionService');

const STABILITY_WEIGHTS = {
    compatibility: 0.6,
    conflict: 0.4
};

/**
 * Aggregates and transforms student allocation, profile, and explainability data into a clean DTO
 */
const getDashboardDTO = async (email, organizationId) => {
    // 1. Fetch current student profile
    const profile = await Profile.findOne({ user_id: email, organizationId }).lean();
    if (!profile) {
        return {
            status: 'NOT_SUBMITTED',
            profile: null,
            allocation: null,
            message: 'No questionnaire submitted yet. Please complete the form.'
        };
    }

    if (profile.profileCompleted === false) {
        return {
            status: 'NOT_SUBMITTED',
            profile: {
                name: profile.name,
                branch: profile.branch,
                year_of_study: profile.year_of_study,
                lastEditedAt: profile.lastEditedAt,
                profileCompleted: false
            },
            allocation: null,
            message: 'Your compatibility questionnaire is currently in draft status.'
        };
    }

    // 2. Fetch room allocation
    const allocation = await RoomAllocation.findOne({ members: email, organizationId }).lean();
    if (!allocation) {
        return {
            status: 'PENDING_ALLOCATION',
            profile: {
                name: profile.name,
                branch: profile.branch,
                year_of_study: profile.year_of_study,
                submittedAt: profile.submittedAt,
                profileCompleted: true
            },
            allocation: null,
            message: 'Your questionnaire responses are submitted. Room assignments are currently in progress.'
        };
    }

    // 3. Find roommates details (excluding current user)
    const roommateEmails = allocation.members.filter(m => m !== email);
    const roommatesDocs = await Profile.find({ user_id: { $in: roommateEmails }, organizationId }).lean();

    // 4. Run conflict & explainability matching service
    const allRoommateProfiles = [profile, ...roommatesDocs];
    const analysis = conflictService.analyzeRoom(allocation, allRoommateProfiles);

    // 5. Calculate Room Stability Score
    // compScore is already floored at 0 (see conflictPredictionService.js), so
    // this can't go negative from that side; the extra Math.max(0, ...) below is
    // just defensive.
    const compScore = analysis.compatibilityScore;
    const conflictComponent = Math.max(0, 100 - analysis.conflictScore * 4);
    const roomStabilityScore = Math.max(0, Math.round(compScore * STABILITY_WEIGHTS.compatibility + conflictComponent * STABILITY_WEIGHTS.conflict));

    // Determine matching quality label. A negative raw score means the room only
    // formed because 100% placement is a hard requirement, not because the match
    // itself was decent - call that out specifically rather than lumping it in
    // with an ordinary sub-70 "Needs Alignment" result.
    let matchLabel = 'Excellent Match';
    if (analysis.rawCompatibilityScore < 0) matchLabel = 'Below Average Match';
    else if (analysis.compatibilityScore < 70) matchLabel = 'Needs Alignment';
    else if (analysis.compatibilityScore < 80) matchLabel = 'Satisfactory Match';
    else if (analysis.compatibilityScore < 90) matchLabel = 'Good Match';

    // Construct constructive roommate guidance reasons ("Things to discuss together" instead of conflicts)
    const thingsToDiscuss = analysis.conflictReasons.map(r => {
        switch (r.category) {
            case 'Sleep Schedule':
                return 'Coordinate sleep/lights-out patterns';
            case 'Cleanliness':
                return 'Set cleanliness expectations and chore splits';
            case 'Noise':
                return 'Align study noise and headphone parameters';
            case 'Guests':
                return 'Establish room guest guidelines and timelines';
            case 'Temperature':
                return 'Discuss thermostat preferences and vent locations';
            case 'Sharing':
                return 'Establish guidelines for sharing clothes, notes, or snacks';
            default:
                return `Coordinate ${r.category.toLowerCase()} habits`;
        }
    });

    // Dynamic matched text explanation DTO
    let matchingExplanation = "You were matched with these roommates because you share highly compatible sleep schedules, cleanliness habits, and study environment preferences.";
    if (analysis.conflictScore >= 15) {
        matchingExplanation = "You were matched based on similar branch cohorts and study habits, but have a few different daily routines to coordinate.";
    } else if (analysis.conflictScore >= 8) {
        matchingExplanation = "Excellent matching indicator! You share key commonalities in resting patterns, with only minor schedule differences to discuss.";
    }

    // Only meaningful when the student actually stated a preference (2/3/4) -
    // "No preference" students get null, same as anyone whose room predates
    // this feature and carries no preference_satisfaction entry for them.
    const hasRoomSizePreference = !!profile.preferred_room_size && profile.preferred_room_size !== 'No preference';
    const preferenceSatisfaction = allocation.preference_satisfaction || {};
    const preferredRoomSizeSatisfied = hasRoomSizePreference && Object.prototype.hasOwnProperty.call(preferenceSatisfaction, email)
        ? !!preferenceSatisfaction[email]
        : null;

    return {
        status: 'ALLOCATED',
        profile: {
            name: profile.name,
            branch: profile.branch,
            year_of_study: profile.year_of_study,
            submittedAt: profile.submittedAt,
            profileCompleted: true
        },
        allocation: {
            roomId: allocation._id.toString(),
            room_number: allocation.room_number,
            block: allocation.block,
            floor: allocation.floor,
            hostelName: allocation.gender_group ? `${allocation.gender_group} Wing` : 'Main Campus Hostel',
            room_capacity: allocation.room_capacity || allocation.members.length,
            room_occupancy: allocation.members.length,
            compatibilityScore: analysis.compatibilityScore,
            stabilityScore: roomStabilityScore,
            matchLabel,
            matchingExplanation,
            preferredRoomSize: hasRoomSizePreference ? profile.preferred_room_size : null,
            preferredRoomSizeSatisfied,
            roommates: roommatesDocs.map(r => ({
                name: r.name,
                branch: r.branch,
                year: r.year_of_study,
                initials: r.name ? r.name.charAt(0).toUpperCase() : 'U'
            })),
            whyWeMatched: analysis.positiveFactors,
            thingsToDiscuss,
            recommendations: analysis.recommendations
        }
    };
};

module.exports = {
    getDashboardDTO
};
