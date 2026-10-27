const mongoose = require('mongoose');

const DISASTER_TYPES = ['typhoon', 'flood', 'earthquake', 'landslide', 'fire', 'tsunami', 'storm_surge', 'other'];
const SEVERITY_LEVELS = ['advisory', 'watch', 'warning', 'emergency'];

const alertSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true, maxlength: 459 }, // 3 SMS parts
    disasterType: { type: String, enum: DISASTER_TYPES, required: true },
    severity: { type: String, enum: SEVERITY_LEVELS, default: 'advisory' },
    // Empty array = all puroks
    targetPuroks: { type: [String], default: [] },
    status: { type: String, enum: ['draft', 'sending', 'sent', 'failed'], default: 'draft' },
    sentAt: Date,
    stats: {
      total: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    createdBy: { type: String, trim: true },
  },
  { timestamps: true }
);

alertSchema.statics.DISASTER_TYPES = DISASTER_TYPES;
alertSchema.statics.SEVERITY_LEVELS = SEVERITY_LEVELS;

module.exports = mongoose.model('Alert', alertSchema);
