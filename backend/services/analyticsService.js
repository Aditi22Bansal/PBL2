const User = require('../models/User');
const Profile = require('../models/Profile');
const RoomAllocation = require('../models/RoomAllocation');

// Configurable constants for risk analysis
const HIGH_RISK_THRESHOLD = 0.80;   // below 80% compatibility is High Risk
const MEDIUM_RISK_THRESHOLD = 0.88; // below 88% compatibility is Medium Risk

/**
 * Enriches raw allocations with computed status properties
 */
const getEnrichedAllocations = async (allocations) => {
    return allocations.map(a => {
        const cap = a.room_capacity || a.members.length;
        const count = a.members.length;
        const score = a.compatibility_score || 0;

        // Determine occupancy status
        let occupancy_status = 'Full';
        if (count === 0) occupancy_status = 'Empty';
        else if (count < cap) occupancy_status = 'Partial';

        // Determine risk indicator
        let risk_indicator = 'Low';
        if (score < HIGH_RISK_THRESHOLD || (a.gender_group && a.gender_group.includes('FLEX'))) {
            risk_indicator = 'High';
        } else if (score < MEDIUM_RISK_THRESHOLD) {
            risk_indicator = 'Medium';
        }

        return {
            ...a,
            room_capacity: cap,
            occupancy_status,
            risk_indicator
        };
    });
};

/**
 * Generates dynamic system insights based on current metrics
 */
const generateDynamicInsights = (systemOverview, allocationQuality, compBuckets, highRiskRoomsCount) => {
    const insights = [];

    // 1. High risk rooms warning
    if (highRiskRoomsCount > 0) {
        insights.push({
            id: 'high-risk',
            text: `${highRiskRoomsCount} room(s) have compatibility scores below ${HIGH_RISK_THRESHOLD * 100}% (or are flex groups) and may require administrative review.`,
            type: 'danger'
        });
    }

    // 2. Unassigned students warning
    if (allocationQuality.unassignedStudents > 0) {
        insights.push({
            id: 'unassigned-students',
            text: `${allocationQuality.unassignedStudents} student(s) remain unassigned after the matching run.`,
            type: 'warning'
        });
    }

    // 3. Pending profiles warning
    if (systemOverview.profilesPending > 0) {
        insights.push({
            id: 'pending-profiles',
            text: `${systemOverview.profilesPending} student questionnaire submission(s) are still pending.`,
            type: 'warning'
        });
    }

    // 4. Empty beds success
    if (systemOverview.emptyBeds > 0) {
        insights.push({
            id: 'empty-beds',
            text: `${systemOverview.emptyBeds} empty bed(s) remain available for allocation across rooms.`,
            type: 'success'
        });
    } else if (systemOverview.totalBeds > 0 && systemOverview.emptyBeds === 0) {
        insights.push({
            id: 'no-beds',
            text: `Hostel is at absolute 100% capacity! No empty beds remain.`,
            type: 'danger'
        });
    }

    // 5. Utilization warning/info
    if (systemOverview.hostelUtilization >= 95) {
        insights.push({
            id: 'high-utilization',
            text: `Hostel utilization is very high (${systemOverview.hostelUtilization}%)—approaching operational limits.`,
            type: 'warning'
        });
    } else if (systemOverview.hostelUtilization > 0) {
        insights.push({
            id: 'utilization-info',
            text: `Hostel utilization is currently optimized at ${systemOverview.hostelUtilization}%.`,
            type: 'info'
        });
    }

    // 6. Compatibility success
    if (allocationQuality.averageCompatibility >= 90) {
        insights.push({
            id: 'compatibility-high',
            text: `Excellent match quality! The average room compatibility score is ${allocationQuality.averageCompatibility}%.`,
            type: 'success'
        });
    }

    return insights;
};

/**
 * Calculates complete dashboard analytics
 */
const calculateAnalytics = async (organizationId) => {
    // 1. System Overview Metrics
    const studentsFromUsers = await User.find({ role: { $ne: 'ADMIN' }, organizationId }).distinct('email');
    const studentsFromProfiles = await Profile.find({ organizationId }).distinct('user_id');
    const allStudentEmails = new Set([...studentsFromUsers, ...studentsFromProfiles]);

    const totalStudents = allStudentEmails.size;
    const profilesCompleted = await Profile.countDocuments({ profileCompleted: { $ne: false }, organizationId });
    const profilesPending = Math.max(0, totalStudents - profilesCompleted);

    // 2. Fetch allocations
    const allocations = await RoomAllocation.find({ organizationId }).lean();
    const totalRoomsGenerated = allocations.length;

    let totalBeds = 0;
    let occupiedBeds = 0;
    let sumCompatibility = 0;
    let highestComp = null;
    let lowestComp = null;
    let flexRoomsCount = 0;
    let emptyRoomsCount = 0;
    let highRiskRoomsCount = 0;

    const sizeDist = {};
    const compBuckets = {
        "95-100": 0,
        "90-95": 0,
        "85-90": 0,
        "80-85": 0,
        "Below 80": 0
    };

    const allocatedStudentEmails = new Set();

    for (const a of allocations) {
        const cap = a.room_capacity || a.members.length;
        const countAssigned = a.members.length;
        const score = a.compatibility_score || 0;

        totalBeds += cap;
        occupiedBeds += countAssigned;
        sumCompatibility += score;

        if (countAssigned === 0) emptyRoomsCount++;
        if (countAssigned < cap) flexRoomsCount++;

        // High risk count
        if (score < HIGH_RISK_THRESHOLD || (a.gender_group && a.gender_group.includes('FLEX'))) {
            highRiskRoomsCount++;
        }

        // Room Size Distribution
        sizeDist[cap] = (sizeDist[cap] || 0) + 1;

        // Compatibility buckets
        const scorePct = score * 100;
        if (scorePct >= 95) compBuckets["95-100"]++;
        else if (scorePct >= 90) compBuckets["90-95"]++;
        else if (scorePct >= 85) compBuckets["85-90"]++;
        else if (scorePct >= 80) compBuckets["80-85"]++;
        else compBuckets["Below 80"]++;

        a.members.forEach(m => allocatedStudentEmails.add(m));

        // High / Low Compatibility Room Search
        if (!highestComp || score > highestComp.compatibility_score) {
            highestComp = a;
        }
        if (!lowestComp || score < lowestComp.compatibility_score) {
            lowestComp = a;
        }
    }

    const emptyBeds = Math.max(0, totalBeds - occupiedBeds);
    const hostelUtilization = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
    // sumCompatibility is the sum of raw (possibly negative) scores - kept as-is
    // for an accurate average internally. Only the displayed percentage is
    // floored at 0, same treatment as the student dashboard fix.
    const averageCompatibility = totalRoomsGenerated > 0 ? Math.max(0, Math.round((sumCompatibility / totalRoomsGenerated) * 100)) : 0;
    const averageRoomSize = totalRoomsGenerated > 0 ? Number((occupiedBeds / totalRoomsGenerated).toFixed(1)) : 0;

    // Find completed profiles that are not assigned
    const completedProfilesDocs = await Profile.find({ profileCompleted: { $ne: false }, organizationId }).distinct('user_id');
    const unassignedStudentsCount = completedProfilesDocs.filter(email => !allocatedStudentEmails.has(email)).length;

    // 3. Demographics calculations
    const branchDist = {};
    const yearDist = {};
    const genderDist = {};

    const completedProfiles = await Profile.find({ profileCompleted: { $ne: false }, organizationId }).lean();
    for (const p of completedProfiles) {
        const b = p.branch || 'Unknown';
        const y = p.year_of_study || 'Unknown';
        const g = p.gender || 'Unknown';

        branchDist[b] = (branchDist[b] || 0) + 1;
        yearDist[y] = (yearDist[y] || 0) + 1;
        genderDist[g] = (genderDist[g] || 0) + 1;
    }

    const systemOverview = {
        totalStudents,
        profilesCompleted,
        profilesPending,
        totalRoomsGenerated,
        totalBeds,
        occupiedBeds,
        emptyBeds,
        hostelUtilization
    };

    // Same treatment as the student dashboard fix (conflictPredictionService.js):
    // expose the raw (possibly negative) percentage for admin-side sorting/
    // debugging, and floor the displayed compatibility_score at 0. The frontend
    // uses raw_compatibility_score < 0 (the same threshold as the student
    // dashboard's "Below Average Match" label) to decide whether to show a
    // qualitative label instead of the number.
    const highestRawPercent = highestComp ? Math.round(highestComp.compatibility_score * 100) : null;
    const lowestRawPercent = lowestComp ? Math.round(lowestComp.compatibility_score * 100) : null;

    const allocationQuality = {
        averageCompatibility,
        highestCompatibilityRoom: highestComp ? {
            room_number: highestComp.room_number,
            compatibility_score: Math.max(0, highestRawPercent),
            raw_compatibility_score: highestRawPercent
        } : null,
        lowestCompatibilityRoom: lowestComp ? {
            room_number: lowestComp.room_number,
            compatibility_score: Math.max(0, lowestRawPercent),
            raw_compatibility_score: lowestRawPercent
        } : null,
        averageRoomSize,
        unassignedStudents: unassignedStudentsCount,
        flexRooms: flexRoomsCount
    };

    const insights = generateDynamicInsights(systemOverview, allocationQuality, compBuckets, highRiskRoomsCount);

    return {
        systemOverview,
        allocationQuality,
        compatibilityAnalytics: compBuckets,
        roomSizeDistribution: sizeDist,
        studentDemographics: {
            branch: branchDist,
            year: yearDist,
            gender: genderDist
        },
        insights
    };
};

module.exports = {
    getEnrichedAllocations,
    calculateAnalytics,
    HIGH_RISK_THRESHOLD,
    MEDIUM_RISK_THRESHOLD
};
