import http from 'k6/http';
import { check, sleep } from 'k6';

// Sustained CPU-intensive load directly against python-service's real
// /allocate/v2 endpoint (not through the Node backend) - this isolates
// python-service's own CPU cost (cosine similarity + greedy matching in
// ml_engine/), which is the one service docs/decisions.md #1 claimed REST
// would let scale independently. Hitting the backend's trigger-allocation
// route instead would also load Mongo/Express, muddying which service's CPU
// pressure is actually driving the HPA - going direct isolates the variable
// under test.
export const options = {
  scenarios: {
    sustained_load: {
      executor: 'constant-vus',
      vus: 40,
      duration: '6m',
    },
  },
};

const TARGET = __ENV.TARGET || 'http://python-service:8000/allocate/v2';
const INTERNAL_SERVICE_KEY = __ENV.INTERNAL_SERVICE_KEY;

const GENDERS = ['Male', 'Female'];
const BRANCHES = ['CSE', 'AIML', 'RNA', 'MECHANICAL', 'ENTC', 'CIVIL'];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const YESNO = ['Yes', 'No'];
const SLEEP_TIMES = ['Before 10 pm', '10-12 am', 'After 12 am'];
const CLEAN = ['Very Clean', 'Moderately Clean', 'Messy'];
const STUDY_ENV = ['Complete Silence', 'Some Noise OK', 'Music/TV OK'];
const GUEST_FREQ = ['Rarely', 'Sometimes', 'Often'];
const TEMP_PREF = ['Cool', 'Warm', 'No preference'];
const CONFLICT_STYLE = ['Talk directly and resolve', 'Avoid confrontation', 'Involve a mediator'];
const ROOM_ORG = ['Very Organized', 'Semi Organized', 'Disorganized'];
const MATTER_NOT = 'Does not matter';
const IMPORTANT_FACTOR = ['Cleanliness', 'Noise', 'Sleep schedule', 'Guests'];

function pick(arr, i) {
  return arr[i % arr.length];
}

// 300 synthetic profiles/request - well above the real ~116-profile
// dataset, deliberately sized to make cosine-similarity + greedy matching
// genuinely CPU-heavy per call rather than instant.
const PROFILE_COUNT = 300;

function buildProfiles(seed) {
  const profiles = [];
  for (let i = 0; i < PROFILE_COUNT; i++) {
    const n = seed * PROFILE_COUNT + i;
    profiles.push({
      user_id: `loadtest_${seed}_${i}`,
      name: `Load Test Student ${n}`,
      age: 18 + (n % 8),
      gender: pick(GENDERS, n),
      year_of_study: pick(YEARS, n + 1),
      branch: pick(BRANCHES, n + 2),
      preferred_room_size: 'No preference',
      accessibility_need: 'None',
      sleep_time: pick(SLEEP_TIMES, n + 3),
      wake_time: '6-8 am',
      cleanliness: pick(CLEAN, n + 4),
      study_env: pick(STUDY_ENV, n + 5),
      guest_frequency: pick(GUEST_FREQ, n + 6),
      smoking_habit: pick(YESNO, n + 7),
      drinking_habit: pick(YESNO, n + 8),
      loud_alarms: pick(YESNO, n + 9),
      first_time_hostel: pick(YESNO, n + 10),
      temp_preference: pick(TEMP_PREF, n + 11),
      study_hours: '2-4',
      active_late: pick(YESNO, n + 12),
      conflict_style: pick(CONFLICT_STYLE, n + 13),
      room_org: pick(ROOM_ORG, n + 14),
      noise_tolerance: 1 + (n % 5),
      introversion: 1 + (n % 5),
      irritation: 1 + (n % 5),
      personal_space: 1 + (n % 5),
      fixed_routines: 1 + (n % 5),
      sharing_comfort: 1 + (n % 5),
      pref_roommate_sleep: MATTER_NOT,
      pref_roommate_social: MATTER_NOT,
      cleanliness_expectation: MATTER_NOT,
      light_preference: MATTER_NOT,
      most_important_factor: pick(IMPORTANT_FACTOR, n + 15),
    });
  }
  return profiles;
}

export default function () {
  const profiles = buildProfiles(__VU * 1000 + __ITER);
  const payload = JSON.stringify({ profiles });
  const res = http.post(TARGET, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Service-Key': INTERNAL_SERVICE_KEY,
    },
    timeout: '60s',
  });
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has allocations': (r) => {
      try {
        return JSON.parse(r.body).allocations !== undefined;
      } catch (e) {
        return false;
      }
    },
  });
  sleep(0.2);
}
