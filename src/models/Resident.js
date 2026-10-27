const mongoose = require('mongoose');
const { normalizePHMobile } = require('../utils/phone');

const residentSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    mobileNumber: {
      type: String,
      required: true,
      unique: true,
      set: (v) => normalizePHMobile(v) || v,
      validate: {
        validator: (v) => /^\+639\d{9}$/.test(v),
        message: 'Invalid PH mobile number (use 09XXXXXXXXX)',
      },
    },
    purok: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    householdSize: { type: Number, min: 1, default: 1 },
    // Flags that help prioritize rescue/evacuation
    vulnerable: {
      senior: { type: Boolean, default: false },
      pwd: { type: Boolean, default: false },
      pregnant: { type: Boolean, default: false },
      child: { type: Boolean, default: false },
    },
    isSubscribed: { type: Boolean, default: true },
  },
  { timestamps: true }
);

residentSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});
residentSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Resident', residentSchema);
