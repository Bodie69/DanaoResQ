const mongoose = require('mongoose');

const shelterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['evacuation_center', 'safe_zone'], default: 'evacuation_center' },
    purok: { type: String, trim: true },
    address: { type: String, trim: true },
    location: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
    },
    capacity: { type: Number, min: 0, default: 0 },
    currentOccupancy: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ['open', 'full', 'closed'], default: 'closed' },
    facilities: { type: [String], default: [] }, // e.g. water, toilets, medical, power
    contactPerson: { type: String, trim: true },
    contactNumber: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

// An open shelter that reaches capacity is marked full (and reopens when space frees up).
shelterSchema.pre('save', function () {
  if (!this.capacity) return;
  if (this.status === 'open' && this.currentOccupancy >= this.capacity) this.status = 'full';
  else if (this.status === 'full' && this.currentOccupancy < this.capacity) this.status = 'open';
});

module.exports = mongoose.model('Shelter', shelterSchema);
