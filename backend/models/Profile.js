const mongoose = require('mongoose');

const profileSchema = new mongoose.Schema({
  user_id: { type: String, required: true, unique: true },
  name: { type: String, default: 'Unknown Name' },
  age: { type: Number },
  gender: { type: String },
  year_of_study: { type: String },
  branch: { type: String },
  
  sleep_time: { type: String },
  wake_time: { type: String },
  cleanliness: { type: String },
  study_env: { type: String },
  guest_frequency: { type: String },
  smoking_habit: { type: String },
  drinking_habit: { type: String },
  loud_alarms: { type: String },
  first_time_hostel: { type: String },
  temp_preference: { type: String },
  study_hours: { type: String },
  active_late: { type: String },
  conflict_style: { type: String },
  room_org: { type: String },
  noise_tolerance: { type: Number },
  introversion: { type: Number },
  irritation: { type: Number },
  personal_space: { type: Number },
  fixed_routines: { type: Number },
  sharing_comfort: { type: Number },
  
  pref_roommate_sleep: { type: String },
  pref_roommate_social: { type: String },
  cleanliness_expectation: { type: String },
  light_preference: { type: String },
  most_important_factor: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Profile', profileSchema);
