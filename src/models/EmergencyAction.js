const mongoose = require('mongoose');
const { DISASTER_TYPES } = require('./Alert');

const PHASES = ['before', 'during', 'after'];

// Step-by-step guide for what residents should do before/during/after a disaster.
const emergencyActionSchema = new mongoose.Schema(
  {
    disasterType: { type: String, enum: DISASTER_TYPES, required: true },
    phase: { type: String, enum: PHASES, required: true },
    title: { type: String, required: true, trim: true },
    steps: {
      type: [{ type: String, trim: true }],
      validate: { validator: (v) => v.length > 0, message: 'At least one step is required' },
    },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

emergencyActionSchema.statics.PHASES = PHASES;

module.exports = mongoose.model('EmergencyAction', emergencyActionSchema);
