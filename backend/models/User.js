const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  studentId: { type: String, unique: true, sparse: true },
  isFormSubmitted: { type: Boolean, default: false },
  role: { type: String, default: 'STU' },
  avatarUrl: { type: String },
});

module.exports = mongoose.model('User', userSchema);
