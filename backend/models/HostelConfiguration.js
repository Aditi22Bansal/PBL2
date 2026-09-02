const mongoose = require('mongoose');
const { SIT_PUNE_ORG_ID } = require('../config/defaultOrg');

const roomTemplateSchema = new mongoose.Schema({
  capacity: { 
    type: Number, 
    required: true, 
    validate: {
      validator: function(v) {
        return v > 0;
      },
      message: 'Room capacity must be greater than 0'
    }
  },
  count: { 
    type: Number, 
    required: true, 
    validate: {
      validator: function(v) {
        return v >= 0;
      },
      message: 'Room count cannot be negative'
    }
  }
});

const hostelConfigurationSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, default: SIT_PUNE_ORG_ID },
  hostelName: {
    type: String, 
    required: [true, 'Hostel name is required'] 
  },
  hostelCode: { 
    type: String 
  },
  gender: { 
    type: String, 
    enum: ['Male', 'Female', 'Mixed'], 
    default: 'Mixed' 
  },
  roomTemplates: { 
    type: [roomTemplateSchema], 
    required: true,
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length > 0;
      },
      message: 'roomTemplates cannot be empty'
    }
  },
  isActive: { 
    type: Boolean, 
    default: false 
  }
}, { timestamps: true });

module.exports = mongoose.model('HostelConfiguration', hostelConfigurationSchema);
