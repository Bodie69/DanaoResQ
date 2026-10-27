const mongoose = require('mongoose');

const SOS_STATUSES = ['pending', 'acknowledged', 'responding', 'resolved', 'cancelled'];

const sosRequestSchema = new mongoose.Schema(
  {
    resident: { type: mongoose.Schema.Types.ObjectId, ref: 'Resident' },
    name: { type: String, trim: true },
    mobileNumber: { type: String, required: true },
    purok: { type: String, trim: true },
    message: { type: String, trim: true, maxlength: 500 },
    peopleCount: { type: Number, min: 1, default: 1 },
    location: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
      accuracy: Number,
    },
    channel: { type: String, enum: ['sms', 'web', 'manual'], default: 'web' },
    status: { type: String, enum: SOS_STATUSES, default: 'pending', index: true },
    responderNotes: { type: String, trim: true },
    history: [
      {
        status: String,
        note: String,
        at: { type: Date, default: Date.now },
      },
    ],
    resolvedAt: Date,
  },
  { timestamps: true }
);

sosRequestSchema.statics.STATUSES = SOS_STATUSES;

module.exports = mongoose.model('SosRequest', sosRequestSchema);
