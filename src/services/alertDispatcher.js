const Resident = require('../models/Resident');
const SmsLog = require('../models/SmsLog');
const { sendSms, providerName } = require('./sms');

function formatAlertSms(alert) {
  return `[BRGY DANAO ${alert.severity.toUpperCase()}] ${alert.title}\n${alert.message}`;
}

// Sends the alert to all subscribed residents in the target puroks and logs each SMS.
async function dispatchAlert(alert) {
  const filter = { isSubscribed: true };
  if (alert.targetPuroks.length) filter.purok = { $in: alert.targetPuroks };
  const recipients = await Resident.find(filter).select('mobileNumber');

  alert.status = 'sending';
  alert.stats = { total: recipients.length, sent: 0, failed: 0 };
  await alert.save();

  const text = formatAlertSms(alert);
  const provider = providerName();

  for (const r of recipients) {
    const log = { alert: alert._id, resident: r._id, mobileNumber: r.mobileNumber, message: text, provider };
    try {
      const { messageId } = await sendSms(r.mobileNumber, text);
      await SmsLog.create({ ...log, status: 'sent', providerMessageId: messageId });
      alert.stats.sent++;
    } catch (err) {
      await SmsLog.create({ ...log, status: 'failed', error: err.message });
      alert.stats.failed++;
    }
  }

  alert.status = recipients.length && alert.stats.sent === 0 ? 'failed' : 'sent';
  alert.sentAt = new Date();
  await alert.save();
  return alert;
}

module.exports = { dispatchAlert, formatAlertSms };
