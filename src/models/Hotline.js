const mongoose = require('mongoose');

// Emergency contact numbers shown in the offline safety toolkit.
const hotlineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    number: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['barangay', 'rescue', 'police', 'fire', 'medical', 'utility', 'other'],
      default: 'other',
    },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Hotline', hotlineSchema);
