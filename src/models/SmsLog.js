const mongoose = require('mongoose');

const smsLogSchema = new mongoose.Schema(
  {
    alert: { type: mongoose.Schema.Types.ObjectId, ref: 'Alert', index: true },
    resident: { type: mongoose.Schema.Types.ObjectId, ref: 'Resident' },
    mobileNumber: { type: String, required: true },
    message: { type: String, required: true },
    provider: String,
    providerMessageId: String,
    status: { type: String, enum: ['sent', 'failed'], required: true },
    error: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('SmsLog', smsLogSchema);
