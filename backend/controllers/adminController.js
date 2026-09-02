const axios = require('axios');
const csv = require('csv-parser');
const Profile = require('../models/Profile');
const RoomAllocation = require('../models/RoomAllocation');
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
                                    gender: row["Gender"] || row["gender"] || "Other",
                                    year_of_study: row["Year of Study"] || "1st Year",
                                    
                                    sleep_time: getValue(row, "sleep time", "sleeping time"),
                                    wake_time: getValue(row, "wake-up time", "wake time"),
                                    cleanliness: getValue(row, "cleanliness level", "How clean"),
                                    study_env: getValue(row, "study environment", "study_env"),
                                    guest_frequency: getValue(row, "guest", "friends frequency"),
                                    smoking_habit: getValue(row, "smoke", "smoking"),
                                    drinking_habit: getValue(row, "drink", "drinking"),
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
        
        const result = await runPythonAllocation(profilesJson, activeConfig);
        
        // Rebuild the global rooms inventory exactly like the Python executor to map room capacities
        const globalRoomCapacities = {};
        if (activeConfig && activeConfig.roomTemplates) {
            let roomIdCounter = 1;
            for (const template of activeConfig.roomTemplates) {
                const cap = template.capacity;
                const cnt = template.count;
                for (let i = 0; i < cnt; i++) {
                    globalRoomCapacities[`Room_${roomIdCounter}`] = cap;
                    roomIdCounter++;
                }
            }
        }

        let roomCounter = 1;
        const newAllocations = result.allocations.map(a => {
            const num = `Room ${roomCounter++}`;
            const capacity = globalRoomCapacities[a.id] || a.members.length;
            return {
                allocation_run_id: result.run_id,
                gender_group: a.gender_group,
                compatibility_score: a.compatibility_score,
                members: a.members,
                room_number: num,
                room_capacity: capacity
            };
        });

        const runPool = async (pool) => {
            if (pool.length === 0) return { allocations: [], unassigned_ids: [] };
            return await runPythonAllocation(pool);
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

        // Determine offset for numbering so we don't overlap with locked rooms
        let nextIds = { A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1 };
        
        const assignRoom = (allowedBlocks) => {
            for (let blockId of allowedBlocks) {
                // simple linear increment for demo
                let id = nextIds[blockId]++;
                let f = Math.floor(id / ROOMS_PER_FLOOR) + 1;
                let r = (id % ROOMS_PER_FLOOR) + 1;
                const roomNumber = `${blockId}-${f}0${r}`;
                return { block: blockId, floor: f, room_number: roomNumber };
            }
            return null; 
        };

        const finalAllocations = [];
        
        const processResults = (result, allowedBlocks) => {
            if (!result || !result.allocations) return;
            for (let alloc of result.allocations) {
                const roomData = assignRoom(allowedBlocks);
                if (roomData) {
                    finalAllocations.push({
                        allocation_run_id: result.run_id || 'manual_id',
                        gender_group: alloc.gender_group,
                        compatibility_score: alloc.compatibility_score,
                        members: alloc.members,
                        block: roomData.block,
                        floor: roomData.floor,
                        room_number: roomData.room_number,
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
        await RoomAllocation.deleteMany({ isLocked: { $ne: true } });
        await RoomAllocation.insertMany(finalAllocations);

        res.json({
            message: 'Allocation completed successfully',
            run_id: result.run_id,
            total_rooms: newAllocations.length,
            unassigned: result.unassigned_ids.length,
            metrics: result.metrics || null,
            validationMetrics: result.validationMetrics || null
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
        const allocs = await analyticsService.getEnrichedAllocations(rawAllocs);
        
        const conflictService = require('../services/conflictPredictionService');

        for(let a of allocs) {
            a.memberDetails = a.members.map(email => {
                allocatedEmails.add(email);
                const p = profileMap.get(email);
                return p ? `${p.name} (${p.branch})` : email;
            });

            // Run conflict prediction and attach result
            a.conflict_analysis = conflictService.analyzeRoom(a, profiles);
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
