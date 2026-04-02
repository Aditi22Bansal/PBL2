const axios = require('axios');
const csv = require('csv-parser');
const Profile = require('../models/Profile');
const RoomAllocation = require('../models/RoomAllocation');
const { runPythonAllocation } = require('../services/allocationService');

exports.syncCsv = async (req, res) => {
    try {
        let { sheet_url } = req.body;
        if (!sheet_url) return res.status(400).json({ error: 'CSV sheet_url is required' });

        // Auto-correct common URL mistakes to force raw CSV output
        sheet_url = sheet_url.trim();
        if (sheet_url.includes("/edit") || sheet_url.includes("/view")) {
            sheet_url = sheet_url.replace(/\/(edit|view).*$/, "/export?format=csv");
        } else if (sheet_url.includes("/pubhtml")) {
            sheet_url = sheet_url.replace("/pubhtml", "/pub");
            if (!sheet_url.includes("output=csv")) sheet_url += (sheet_url.includes("?") ? "&" : "?") + "output=csv";
        } else if (sheet_url.includes("/pub") && !sheet_url.includes("output=csv")) {
            sheet_url += (sheet_url.includes("?") ? "&" : "?") + "output=csv";
        } else if (!sheet_url.includes("format=csv") && !sheet_url.includes("output=csv")) {
            // Absolute fallback
            sheet_url += (sheet_url.endsWith("/") ? "" : "/") + "export?format=csv";
        }

        const response = await axios.get(sheet_url, { responseType: 'stream' });

        if (response.headers['content-type'] && response.headers['content-type'].includes('text/html')) {
            return res.status(400).json({ error: 'URL Error', details: 'Google returned an HTML webpage instead of a raw CSV. Make sure your link is set to "Anyone with the link can view".' });
        }

        
        const results = [];
        response.data.pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', async () => {
                const profilesToUpsert = results.map((row, index) => {
                    const keys = Object.keys(row);
                    const emailKey = keys.find(k => k.toLowerCase().includes('email'));
                    const nameKey = keys.find(k => k.toLowerCase().includes('name'));
                    const branchKey = keys.find(k => k.toLowerCase().includes('branch'));
                    
                    // Fall back to a deterministic synthetic email if no explicit email column exists
                    const email = emailKey && row[emailKey] ? row[emailKey].trim() : `student_${index}@sitpune.edu.in`;
                    
                    if(!email) return null;

                    // Fix: Set name to the student ID prefix instead of Unknown
                    const fallbackName = nameKey && row[nameKey] ? row[nameKey] : email.split('@')[0];
                    
                    return {
                        updateOne: {
                            filter: { user_id: email },
                            update: {
                                $set: {
                                    user_id: email,
                                    name: fallbackName,
                                    branch: branchKey ? row[branchKey] : "Unknown",
                                    gender: row["Gender"] || row["gender"] || "Other",
                                    year_of_study: row["Year of Study"] || "1st Year",
                                    sleep_time: row["When do you usually sleep?"],
                                    wake_time: row["When do you usually wake up?"],
                                    cleanliness: row["How clean do you keep your room?"],
                                    smoking_habit: row["Do you smoke?"],
                                    drinking_habit: row["Do you drink alcohol?"],
                                }
                            },
                            upsert: true
                        }
                    };
                }).filter(p => p !== null);

                if (profilesToUpsert.length > 0) {
                    // WIPE the old student dataset first so it exclusively holds the newly synced sheet data
                    await Profile.deleteMany({});
                    
                    await Profile.bulkWrite(profilesToUpsert);
                    
                    // Clear Previous Allocations to reset matrix state before next run
                    await RoomAllocation.deleteMany({});
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
        const profiles = await Profile.find({});
        if (profiles.length < 3) {
            return res.status(400).json({ error: 'Not enough profiles to run allocation (minimum 3 required)' });
        }
        
        const profilesJson = profiles.map(p => ({
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
        
        const result = await runPythonAllocation(profilesJson);
        
        let roomCounter = 1;
        const newAllocations = result.allocations.map(a => {
            const num = `Room ${roomCounter++}`;
            return {
                allocation_run_id: result.run_id,
                gender_group: a.gender_group,
                compatibility_score: a.compatibility_score,
                members: a.members,
                room_number: num
            };
        });
        
        await RoomAllocation.deleteMany({});
        await RoomAllocation.insertMany(newAllocations);
        
        res.json({
            message: 'Allocation completed successfully',
            run_id: result.run_id,
            total_rooms: newAllocations.length,
            unassigned: result.unassigned_ids.length,
            metrics: result.metrics || null
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Allocation failed', message: error.message });
    }
};

exports.getAllocations = async (req, res) => {
    try {
        const allocs = await RoomAllocation.find({}).lean();
        
        for(let a of allocs) {
            const profiles = await Profile.find({ user_id: { $in: a.members } });
            a.memberDetails = a.members.map(email => {
                const p = profiles.find(pf => pf.user_id === email);
                return p ? `${p.name} (${p.branch})` : email;
            });
        }
        res.json(allocs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch allocations' });
    }
};
