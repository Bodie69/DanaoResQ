const Resident = require('../models/Resident');
const SosRequest = require('../models/SosRequest');
const { sendSms } = require('./sms');
const { normalizePHMobile } = require('../utils/phone');

const STATUS_REPLY = {
  acknowledged: 'Your SOS has been received by Brgy. Danao. Stay where you are if it is safe. Help is being coordinated.',
  responding: 'Responders from Brgy. Danao are on the way to you. Keep your phone on and stay visible.',
  resolved: 'Your SOS has been marked resolved by Brgy. Danao. Text SOS again if you still need help.',
};

// Creates an SOS request, linking it to a registered resident when the number matches.
async function createSos({ mobileNumber, name, purok, message, peopleCount, location, channel }) {
  const number = normalizePHMobile(mobileNumber);
  if (!number) {
    const err = new Error('A valid PH mobile number is required (09XXXXXXXXX)');
    err.status = 400;
    throw err;
  }
  const resident = await Resident.findOne({ mobileNumber: number });
  return SosRequest.create({
    resident: resident?._id,
    name: name || (resident ? `${resident.firstName} ${resident.lastName}` : undefined),
    mobileNumber: number,
    purok: purok || resident?.purok,
    message,
    peopleCount,
    location: location?.lat != null && location?.lng != null ? location : undefined,
    channel,
    history: [{ status: 'pending', note: `Received via ${channel}` }],
  });
}

// Changes SOS status, records history and optionally texts the requester.
async function updateSosStatus(sos, { status, note, notify }) {
  if (status && status !== sos.status) {
    sos.status = status;
    sos.history.push({ status, note });
    if (status === 'resolved') sos.resolvedAt = new Date();
  }
  if (note) sos.responderNotes = note;
  await sos.save();

  let notified = false;
  if (notify && STATUS_REPLY[sos.status]) {
    const text = note ? `${STATUS_REPLY[sos.status]} Note: ${note}` : STATUS_REPLY[sos.status];
    try {
      await sendSms(sos.mobileNumber, text);
      notified = true;
    } catch (err) {
      console.error('SOS notify failed:', err.message);
    }
  }
  return { sos, notified };
}

module.exports = { createSos, updateSosStatus };
