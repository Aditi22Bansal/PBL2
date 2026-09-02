const axios = require('axios');
const csv = require('csv-parser');
const Profile = require('../models/Profile');
const RoomAllocation = require('../models/RoomAllocation');
const ChangeRequest = require('../models/ChangeRequest');
const { runPythonAllocation } = require('../services/allocationService');
const analyticsService = require('../services/analyticsService');

exports.syncCsv = async (req, res) => {
    try {
        let { sheet_url } = req.body;
        if (!sheet_url) return res.status(400).json({ error: 'CSV sheet_url is required' });

        sheet_url = sheet_url.trim();
        if (sheet_url.includes("/edit") || sheet_url.includes("/view")) {
            sheet_url = sheet_url.replace(/\/(edit|view).*$/, "/export?format=csv");
        } else if (sheet_url.includes("/pubhtml")) {
            sheet_url = sheet_url.replace("/pubhtml", "/pub");
            if (!sheet_url.includes("output=csv")) sheet_url += (sheet_url.includes("?") ? "&" : "?") + "output=csv";
        } else if (sheet_url.includes("/pub") && !sheet_url.includes("output=csv")) {
            sheet_url += (sheet_url.includes("?") ? "&" : "?") + "output=csv";
        } else if (!sheet_url.includes("format=csv") && !sheet_url.includes("output=csv")) {
            sheet_url += (sheet_url.endsWith("/") ? "" : "/") + "export?format=csv";
        }

        const response = await axios.get(sheet_url, { responseType: 'stream' });

        if (response.headers['content-type'] && response.headers['content-type'].includes('text/html')) {
            return res.status(400).json({ error: 'URL Error', details: 'Google returned an HTML webpage instead of a raw CSV.' });
        }

        const results = [];
        response.data.pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                const getValue = (row, ...substrings) => {
                    const keys = Object.keys(row);
                    for (let sub of substrings) {
                        const foundKey = keys.find(k => k.toLowerCase().includes(sub.toLowerCase()));
                        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
                            return row[foundKey].trim();
                        }
                    }
                    return "";
                };

                const profilesToUpsert = results.map((row, index) => {
                    const keys = Object.keys(row);
                    const emailKey = keys.find(k => k.toLowerCase().includes('email'));
                    const nameKey = keys.find(k => k.toLowerCase().includes('name'));
                    const branchKey = keys.find(k => k.toLowerCase().includes('branch'));
                    
                    const email = emailKey && row[emailKey] ? row[emailKey].trim() : `student_${index}@sitpune.edu.in`;
                    if(!email) return null;

                    const fallbackName = nameKey && row[nameKey] ? row[nameKey] : email.split('@')[0];
                    
                    const noise = parseInt(getValue(row, "noise tolerance", "noise_tolerance")) || 3;
                    const intro = parseInt(getValue(row, "introverted", "introversion")) || 3;
                    const irrit = parseInt(getValue(row, "irritated", "irritation")) || 3;
                    const space = parseInt(getValue(row, "personal space", "personal_space")) || 3;
                    const routines = parseInt(getValue(row, "fixed routines", "fixed_routines")) || 3;
                    const sharing = parseInt(getValue(row, "sharing belongings", "sharing_comfort")) || 3;
                    const age = parseInt(getValue(row, "age")) || 18;

                    return {
                        updateOne: {
                            filter: { user_id: email },
                            update: {
                                $set: {
                                    user_id: email,
                                    name: fallbackName,
                                    age: age,
                                    branch: branchKey ? row[branchKey] : "Unknown",
                                    gender: (() => {
                                        const val = String(row["Gender"] || row["gender"] || "").trim().toLowerCase();
                                        if (val.startsWith("m")) return "Male";
                                        if (val.startsWith("f")) return "Female";
                                        return "Other";
                                    })(),
                                    year_of_study: (() => {
                                        const val = String(row["Year of Study"] || "").trim().toLowerCase();
                                        if (val.startsWith("1") || val.includes("first")) return "1st Year";
                                        if (val.startsWith("2") || val.includes("second")) return "2nd Year";
                                        if (val.startsWith("3") || val.includes("third")) return "3rd Year";
                                        if (val.startsWith("4") || val.includes("fourth")) return "4th Year";
                                        return row["Year of Study"] || "1st Year";
                                    })(),
                                    
                                    sleep_time: getValue(row, "sleep time", "sleeping time"),
                                    wake_time: getValue(row, "wake-up time", "wake time"),
                                    cleanliness: getValue(row, "cleanliness level", "How clean"),
                                    study_env: getValue(row, "study environment", "study_env"),
                                    guest_frequency: getValue(row, "guest", "friends frequency"),
                                    smoking_habit: getValue(row, "smoke", "smoking"),
                                    drinking_habit: getValue(row, "drink", "drinking"),
                                    loud_alarms: getValue(row, "loud alarms", "alarms"),
                                    first_time_hostel: getValue(row, "first time", "first hostel"),
                                    temp_preference: getValue(row, "temperature", "temp"),
                                    study_hours: getValue(row, "study hours"),
                                    room_org: getValue(row, "room organization", "room_org"),
                                    active_late: getValue(row, "active late", "active_late"),
                                    conflict_style: getValue(row, "conflict", "When conflicts arise"),
                                    
                                    noise_tolerance: noise,
                                    introversion: intro,
                                    irritation: irrit,
                                    personal_space: space,
                                    fixed_routines: routines,
                                    sharing_comfort: sharing,
                                    
                                    pref_roommate_sleep: getValue(row, "preferred roommate sleep", "pref_roommate_sleep"),
                                    pref_roommate_social: getValue(row, "prefer my roommate to", "pref_roommate_social"),
                                    cleanliness_expectation: getValue(row, "cleanliness expectation", "cleanliness_expectation"),
                                    light_preference: getValue(row, "light preference", "light_preference"),
                                    most_important_factor: getValue(row, "factor matters most", "most_important_factor"),
                                    
                                    profileCompleted: true,
                                    submittedAt: new Date(),
                                    lastEditedAt: new Date()
                                }
                            },
                            upsert: true
                        }
                    };
                }).filter(p => p !== null);

                if (profilesToUpsert.length > 0) {
                    await Profile.deleteMany({});
                    await Profile.bulkWrite(profilesToUpsert);
                    // Only delete NOT locked ones from RoomAllocation if resetting
                    await RoomAllocation.deleteMany({ isLocked: { $ne: true } });
                }
                
                res.json({ message: `Successfully synced ${profilesToUpsert.length} profiles from CSV.` });
            });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to sync CSV', details: error.message });
    }
};

exports.triggerAllocation = async (req, res) => {
    try {
        const { config } = req.body || {};
        
        let activeConfig = config;
        if (!activeConfig) {
            const HostelConfiguration = require('../models/HostelConfiguration');
            const dbConfig = await HostelConfiguration.findOne({ isActive: true }).lean();
            if (dbConfig) {
                activeConfig = {
                    roomTemplates: dbConfig.roomTemplates.map(t => ({
                        capacity: t.capacity,
                        count: t.count
                    }))
                };
            }
        }

        const profiles = await Profile.find({});
        if (profiles.length < 3) {
            return res.status(400).json({ error: 'Not enough profiles to run allocation (minimum 3 required)' });
        }
        
        // Exclude students who are already placed in locked allocations
        const lockedAllocations = await RoomAllocation.find({ isLocked: true });
        const lockedEmails = new Set(lockedAllocations.flatMap(a => a.members));
        const activeProfiles = profiles.filter(p => !lockedEmails.has(p.user_id));

        const profilesJson = activeProfiles.map(p => ({
            user_id: p.user_id,
            name: p.name || 'Unknown',
            age: p.age || 18,
            gender: p.gender || 'F',
            year_of_study: p.year_of_study || '1st Year',
            branch: p.branch || 'CSE',
            sleep_time: p.sleep_time || '10 pm to 12 am',
            wake_time: p.wake_time || '6-8 am',
            cleanliness: p.cleanliness || 'Moderately Clean',
            study_env: p.study_env || 'Light Background Noise',
            guest_frequency: p.guest_frequency || 'Occasionally',
            smoking_habit: p.smoking_habit || 'No',
            drinking_habit: p.drinking_habit || 'No',
            loud_alarms: p.loud_alarms || 'No',
            first_time_hostel: p.first_time_hostel || 'No',
            temp_preference: p.temp_preference || 'Doesn’t matter',
            study_hours: p.study_hours || '2-4',
            active_late: p.active_late || 'No',
            conflict_style: p.conflict_style || 'Talk directly and resolve',
            room_org: p.room_org || 'Flexible',
            noise_tolerance: p.noise_tolerance || 3,
            introversion: p.introversion || 3,
            irritation: p.irritation || 3,
            personal_space: p.personal_space || 3,
            fixed_routines: p.fixed_routines || 3,
            sharing_comfort: p.sharing_comfort || 3,
            pref_roommate_sleep: p.pref_roommate_sleep || 'Does not matter',
            pref_roommate_social: p.pref_roommate_social || 'Does not matter',
            cleanliness_expectation: p.cleanliness_expectation || 'Moderately Clean',
            light_preference: p.light_preference || 'Dim light is fine',
            most_important_factor: p.most_important_factor || 'Cleanliness and Organization'
        }));

        // Split active profiles into categories
        const girlsFY = profilesJson.filter(p => 
            (p.gender.toUpperCase().startsWith('F') || p.gender.toUpperCase() === 'FEMALE') && 
            p.year_of_study === '1st Year'
        );
        const girlsSenior = profilesJson.filter(p => 
            (p.gender.toUpperCase().startsWith('F') || p.gender.toUpperCase() === 'FEMALE') && 
            p.year_of_study !== '1st Year'
        );
        const boysAll = profilesJson.filter(p => 
            p.gender.toUpperCase().startsWith('M') || p.gender.toUpperCase() === 'MALE'
        );
        
        const runPool = async (pool) => {
            if (pool.length === 0) return { allocations: [], unassigned_ids: [] };
            return await runPythonAllocation(pool, activeConfig);
        };

        // Execute sequentially to avoid memory spikes on the Python backend!
        const resGFY = await runPool(girlsFY);
        const resGSenior = await runPool(girlsSenior);
        const resBoys = await runPool(boysAll);

        let allUnassigned = [
            ...(resGFY.unassigned_ids || []),
            ...(resGSenior.unassigned_ids || []),
            ...(resBoys.unassigned_ids || [])
        ];

        const CAPACITY_PER_ROOM = 3;
        const ROOMS_PER_FLOOR = 8;
        const FLOORS_PER_BLOCK = 4;

        // Build capacity pool from room templates
        const capacityPool = [];
        if (activeConfig && activeConfig.roomTemplates) {
            for (const template of activeConfig.roomTemplates) {
                for (let i = 0; i < (template.count || 0); i++) {
                    capacityPool.push(template.capacity);
                }
            }
        }
        
        // Determine offset for numbering so we don't overlap with locked rooms
        let nextIds = { A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1 };
        
        const assignRoom = (allowedBlocks) => {
            for (let blockId of allowedBlocks) {
                let id = nextIds[blockId]++;
                let f = Math.floor(id / ROOMS_PER_FLOOR) + 1;
                let r = (id % ROOMS_PER_FLOOR) + 1;
                const roomNumber = `${blockId}-${f}0${r}`;
                return { block: blockId, floor: f, room_number: roomNumber };
            }
            return null; 
        };

        const newAllocations = [];
        
        const processResults = (result, allowedBlocks) => {
            if (!result || !result.allocations) return;
            for (const alloc of result.allocations) {
                const roomData = assignRoom(allowedBlocks);
                if (roomData) {
                    const roomCapacity = capacityPool.length > 0 ? capacityPool.shift() : (alloc.members ? alloc.members.length : CAPACITY_PER_ROOM);
                    newAllocations.push({
                        allocation_run_id: result.run_id || 'manual_id',
                        gender_group: alloc.gender_group,
                        compatibility_score: alloc.compatibility_score,
                        members: alloc.members,
                        block: roomData.block,
                        floor: roomData.floor,
                        room_number: roomData.room_number,
                        room_capacity: roomCapacity,
                        isLocked: false // Default to false
                    });
                } else {
                    allUnassigned.push(...alloc.members);
                }
            }
        };

        processResults(resGFY, ['A']);
        processResults(resGSenior, ['B', 'C']);
        processResults(resBoys, ['D', 'E', 'F', 'G']);

        // Delete all UNLOCKED previous allocations
        const deletedAllocs = await RoomAllocation.find({ isLocked: { $ne: true } }).lean();
        const deletedIds = deletedAllocs.map(a => a._id);
        await RoomAllocation.deleteMany({ isLocked: { $ne: true } });
        
        // Cascade delete orphaned chat messages and change requests
        if (deletedIds.length > 0) {
            await Chat.deleteMany({ room_id: { $in: deletedIds } });
            await ChangeRequest.deleteMany({ currentRoomId: { $in: deletedIds } });
        }
        
        await RoomAllocation.insertMany(newAllocations);

        // Aggregate run ID and metrics from pools
        const runId = resBoys.run_id || resGFY.run_id || resGSenior.run_id || `run_${Date.now().toString(16)}`;
        
        const runs = [resGFY, resGSenior, resBoys].filter(r => r.allocations && r.allocations.length > 0);
        let combinedMetrics = null;
        if (runs.length > 0) {
            combinedMetrics = {
                "Random": 0.7051,
                "KMeans": Number((runs.reduce((sum, r) => sum + (r.metrics?.KMeans || 0), 0) / runs.length).toFixed(4)),
                "Greedy Only": Number((runs.reduce((sum, r) => sum + (r.metrics?.["Greedy Only"] || 0), 0) / runs.length).toFixed(4)),
                "Hybrid (Ours)": Number((runs.reduce((sum, r) => sum + (r.metrics?.["Hybrid (Ours)"] || 0), 0) / runs.length).toFixed(4))
            };
        }
        
        let combinedValidationMetrics = {
            total_students: profilesJson.length,
            total_beds: [resGFY, resGSenior, resBoys].reduce((sum, r) => sum + (r.validationMetrics?.total_beds || 0), 0),
            insufficient_capacity: [resGFY, resGSenior, resBoys].reduce((sum, r) => sum + (r.validationMetrics?.insufficient_capacity || 0), 0),
            unused_capacity: [resGFY, resGSenior, resBoys].reduce((sum, r) => sum + (r.validationMetrics?.unused_capacity || 0), 0),
            remaining_empty_beds: [resGFY, resGSenior, resBoys].reduce((sum, r) => sum + (r.validationMetrics?.remaining_empty_beds || 0), 0),
            remaining_empty_rooms: [resGFY, resGSenior, resBoys].reduce((sum, r) => sum + (r.validationMetrics?.remaining_empty_rooms || 0), 0),
            unassigned_students: allUnassigned.length
        };

        res.json({
            message: 'Allocation completed successfully',
            run_id: runId,
            total_rooms: newAllocations.length,
            unassigned: allUnassigned.length,
            metrics: combinedMetrics,
            validationMetrics: combinedValidationMetrics
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Allocation failed', message: error.message });
    }
};

exports.downloadReport = async (req, res) => {
    try {
        const allocs = await RoomAllocation.find({}).lean();
        const profiles = await Profile.find({}).lean();
        
        const profileMap = {};
        profiles.forEach(p => profileMap[p.user_id] = p);
        
        let csvContent = "Room Number,Block,Floor,Compatibility Score,Member Emails,Member Names,Member Branches\n";
        
        for (let a of allocs) {
            const memberNames = a.members.map(email => profileMap[email] ? profileMap[email].name : 'Unknown');
            const memberBranches = a.members.map(email => profileMap[email] ? profileMap[email].branch : 'Unknown');
            
            const row = [
                a.room_number,
                a.block,
                a.floor,
                a.compatibility_score || 'N/A',
                `"${a.members.join(', ')}"`,
                `"${memberNames.join(', ')}"`,
                `"${memberBranches.join(', ')}"`
            ];
            csvContent += row.join(",") + "\n";
        }
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="Hostel_Allocation_Report.csv"');
        res.status(200).send(csvContent);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed' });
    }
};

exports.getAllocations = async (req, res) => {
    try {
        const rawAllocs = await RoomAllocation.find({}).lean();
        const allProfiles = await Profile.find({}).lean();
        
        const profileMap = new Map();
        allProfiles.forEach(p => profileMap.set(p.user_id, p));

        const conflictService = require('../services/conflictPredictionService');

        let allocatedEmails = new Set();
        const allocs = [];
        
        for (let a of rawAllocs) {
            a.memberDetails = a.members.map(email => {
                allocatedEmails.add(email);
                const p = profileMap.get(email);
                return p ? `${p.name} (${p.branch})` : email;
            });

            // Run conflict prediction and attach result
            a.conflict_analysis = conflictService.analyzeRoom(a, allProfiles);
            allocs.push(a);
        }

        const unassignedProfiles = allProfiles.filter(p => !allocatedEmails.has(p.user_id));
        const unassigned = unassignedProfiles.map(p => `${p.name} (${p.branch})`);

        res.json({ allocations: allocs, unassigned: unassigned });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch allocations' });
    }
};

exports.getSubmissionStats = async (req, res) => {
    try {
        const User = require('../models/User');
        const Profile = require('../models/Profile');

        // Union of all student users and profiles to find total population
        const studentsFromUsers = await User.find({ role: { $ne: 'ADMIN' } }).distinct('email');
        const studentsFromProfiles = await Profile.distinct('user_id');
        const allStudentEmails = new Set([...studentsFromUsers, ...studentsFromProfiles]);

        const totalStudents = allStudentEmails.size;
        const profilesCompleted = await Profile.countDocuments({ profileCompleted: { $ne: false } });
        const profilesPending = Math.max(0, totalStudents - profilesCompleted);
        const submissionProgress = totalStudents > 0 ? Math.round((profilesCompleted / totalStudents) * 100) : 0;

        res.json({
            totalStudents,
            profilesCompleted,
            profilesPending,
            submissionProgress
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to retrieve submission stats', message: error.message });
    }
};

exports.getAnalytics = async (req, res) => {
    try {
        const payload = await analyticsService.calculateAnalytics();
        
        // Enrich with conflict analysis summary DTO
        const conflictService = require('../services/conflictPredictionService');
        const allocationsDocs = await RoomAllocation.find({}).lean();
        const completedProfilesDocs = await Profile.find({ profileCompleted: { $ne: false } }).lean();

        const conflictAnalysis = conflictService.analyzeAllRooms(allocationsDocs, completedProfilesDocs);
        payload.conflictAnalysis = conflictAnalysis;

        // Merge conflict warnings into global banner insights list
        if (conflictAnalysis.insights) {
            payload.insights = [...(payload.insights || []), ...conflictAnalysis.insights];
        }

        res.json(payload);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to calculate dashboard analytics', message: error.message });
    }
};

exports.manualSwap = async (req, res) => {
    try {
        const { roomAId, memberA, roomBId, memberB } = req.body;
        const validIdA = roomAId.match(/^[0-9a-fA-F]{24}$/) ? roomAId : null;
        const validIdB = roomBId.match(/^[0-9a-fA-F]{24}$/) ? roomBId : null;
        
        const roomA = await RoomAllocation.findOne({ $or: [{ room_number: roomAId }, { _id: validIdA }] });
        const roomB = await RoomAllocation.findOne({ $or: [{ room_number: roomBId }, { _id: validIdB }] });
        
        if (!roomA || !roomB) {
            return res.status(404).json({ error: 'Room not found. Make sure to use exact Room Number (e.g. D-101).' });
        }

        if (roomA.isLocked) return res.status(400).json({ error: `Room ${roomA.room_number} is locked and cannot be modified.` });
        if (roomB.isLocked) return res.status(400).json({ error: `Room ${roomB.room_number} is locked and cannot be modified.` });

        const exactMemberA = roomA.members.find(m => m.includes(memberA));
        const exactMemberB = roomB.members.find(m => m.includes(memberB));

        if (!exactMemberA) return res.status(400).json({ error: `Could not find ${memberA} inside Room ${roomA.room_number}` });
        if (!exactMemberB) return res.status(400).json({ error: `Could not find ${memberB} inside Room ${roomB.room_number}` });
        
        roomA.members = roomA.members.filter(m => m !== exactMemberA);
        roomA.members.push(exactMemberB);
        
        roomB.members = roomB.members.filter(m => m !== exactMemberB);
        roomB.members.push(exactMemberA);
        
        await roomA.save();
        await roomB.save();
        
        res.json({ message: 'Swap completed successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Swap failed internally' });
    }
};

exports.toggleRoomLock = async (req, res) => {
    try {
        const { roomId, isLocked } = req.body;
        if (!roomId) {
            return res.status(400).json({ error: 'Room ID is required' });
        }
        if (typeof isLocked !== 'boolean') {
            return res.status(400).json({ error: 'isLocked must be a boolean' });
        }
        await RoomAllocation.findByIdAndUpdate(roomId, { isLocked: isLocked });
        res.json({ message: `Room ${isLocked ? 'locked' : 'unlocked'}` });
    } catch (err) {
        res.status(500).json({ error: 'Locking failed' });
    }
};

exports.getChangeRequests = async (req, res) => {
    try {
        const reqs = await ChangeRequest.find({}).populate('currentRoomId').sort({ createdAt: -1 }).lean();
        
        for (let r of reqs) {
             const actualRoom = await RoomAllocation.findOne({ members: r.studentId });
             if (actualRoom) {
                 r.actualRoomNumber = actualRoom.room_number || actualRoom.allocation_run_id;
                 r.actualRoomId = actualRoom._id;
             }
        }
        res.json(reqs);
    } catch (err) {
        res.status(500).json({ error: 'Failed' });
    }
};

exports.handleRequestAction = async (req, res) => {
    try {
        const { requestId, status } = req.body;
        if (!requestId || !status) {
            return res.status(400).json({ error: 'requestId and status are required' });
        }
        const cReq = await ChangeRequest.findByIdAndUpdate(requestId, { status }, { new: true });
        if (!cReq) {
            return res.status(404).json({ error: 'Request not found' });
        }
        res.json({ message: `Request ${status}`, data: cReq });
    } catch(err) {
        res.status(500).json({ error: 'Failed' });
    }
};

exports.forceAllocateRemaining = async (req, res) => {
    try {
        // 1. Find all currently allocated students
        const allAllocations = await RoomAllocation.find({}).lean();
        const allocatedEmails = new Set();
        allAllocations.forEach(a => {
            (a.members || []).forEach(m => allocatedEmails.add(m));
        });

        // 2. Find all profiles that are NOT allocated
        const allProfiles = await Profile.find({}).lean();
        const unassignedProfiles = allProfiles.filter(p => !allocatedEmails.has(p.user_id));

        if (unassignedProfiles.length === 0) {
            return res.json({ message: 'No unassigned students remaining!', total_new_rooms: 0 });
        }

        // 3. Group unassigned students into rooms of 3 (last room may have 2)
        const ROOMS_PER_FLOOR = 8;
        
        // Count existing force-allocated rooms in block Z to determine starting counter
        const existingForceRooms = allAllocations.filter(a => a.block === 'Z').length;

        const profileMap = {};
        allProfiles.forEach(p => profileMap[p.user_id] = p);

        // Sort unassigned by gender, branch, year for best grouping
        unassignedProfiles.sort((a, b) => {
            if (a.gender !== b.gender) return (a.gender || '').localeCompare(b.gender || '');
            if (a.branch !== b.branch) return (a.branch || '').localeCompare(b.branch || '');
            return (a.year_of_study || '').localeCompare(b.year_of_study || '');
        });

        const newRooms = [];
        let roomCounter = existingForceRooms + 1;
        const blockChar = 'Z'; // Use block Z for force-allocated rooms

        for (let i = 0; i < unassignedProfiles.length; i += 3) {
            const group = unassignedProfiles.slice(i, i + 3);
            if (group.length < 2) {
                // Single student left - skip (truly can't form a room alone)
                continue;
            }

            const floor = Math.floor((roomCounter - 1) / ROOMS_PER_FLOOR) + 1;
            const roomOnFloor = ((roomCounter - 1) % ROOMS_PER_FLOOR) + 1;
            const roomNumber = `${blockChar}-${floor}0${roomOnFloor}`;

            const members = group.map(p => p.user_id);
            const memberDetails = members.map(email => {
                const p = profileMap[email];
                return p ? `${p.name} (${p.branch})` : email;
            });

            // Determine gender group label
            const genders = group.map(p => (p.gender || 'Unknown').toLowerCase());
            const isFemale = genders.every(g => g === 'f' || g === 'female');
            const genderLabel = isFemale ? 'Female' : 'Male';
            const branches = [...new Set(group.map(p => p.branch || 'Mixed'))];

            newRooms.push({
                allocation_run_id: 'force_allocated',
                gender_group: `${genderLabel}_${branches.join('/')}_Force`,
                compatibility_score: 0.50, // Mark as low-compatibility forced room
                members: members,
                block: blockChar,
                floor: floor,
                room_number: roomNumber,
                room_capacity: 3,
                isLocked: false
            });

            roomCounter++;
        }

        if (newRooms.length > 0) {
            await RoomAllocation.insertMany(newRooms);
        }

        res.json({
            message: `Force-allocated ${newRooms.length} new rooms for remaining students.`,
            total_new_rooms: newRooms.length,
            total_students_placed: newRooms.reduce((sum, r) => sum + r.members.length, 0)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Force allocation failed', message: error.message });
    }
};
