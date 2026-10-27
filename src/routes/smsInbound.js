// Webhook for incoming SMS from residents. Point your gateway's inbound URL to POST /api/sms/inbound.
// Accepts Twilio fields (From, Body) or generic ones (from/number/mobile_number, message/text).
//
// Keywords:
//   SOS <details>  — creates an SOS request
//   SHELTER        — replies with open shelters (own purok first)
//   STOP / START   — turns alerts off / on for a registered number
const router = require('express').Router();
const Resident = require('../models/Resident');
const Shelter = require('../models/Shelter');
const { createSos } = require('../services/sosService');
const { sendSms } = require('../services/sms');
const { normalizePHMobile } = require('../utils/phone');

const HELP = 'Brgy. Danao Alerts: text SOS <details> for emergency help, SHELTER for open evacuation centers, STOP to stop alerts, START to resume.';

async function shelterReply(number) {
  const resident = await Resident.findOne({ mobileNumber: number });
  const open = await Shelter.find({ status: 'open' });
  if (!open.length) return 'No evacuation centers are open right now. Text SOS <details> if you need help.';
  open.sort((a, b) => (b.purok === resident?.purok) - (a.purok === resident?.purok));
  const list = open.slice(0, 4).map((s) => {
    const space = s.capacity ? ` (${Math.max(s.capacity - s.currentOccupancy, 0)} slots)` : '';
    return `- ${s.name}${s.purok ? `, ${s.purok}` : ''}${space}`;
  });
  return `Open evacuation centers:\n${list.join('\n')}`;
}

async function handleInbound(rawFrom, rawText) {
  const number = normalizePHMobile(rawFrom);
  if (!number) return null;
  const text = String(rawText || '').trim();
  const [keyword, ...rest] = text.split(/\s+/);
  const details = rest.join(' ');

  switch ((keyword || '').toUpperCase()) {
    case 'SOS':
    case 'HELP':
    case 'TULONG': {
      // The offline toolkit adds "3 pax" and "loc <lat>,<lng>" to the text when it can.
      const loc = details.match(/loc\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i);
      const pax = details.match(/(\d+)\s*pax/i);
      await createSos({
        mobileNumber: number,
        message: details || text,
        peopleCount: pax ? Number(pax[1]) : undefined,
        location: loc ? { lat: Number(loc[1]), lng: Number(loc[2]) } : undefined,
        channel: 'sms',
      });
      return 'SOS RECEIVED by Brgy. Danao. Stay calm and stay where it is safe. Reply with your exact location and number of people if you have not yet.';
    }
    case 'SHELTER':
    case 'EVAC':
      return shelterReply(number);
    case 'STOP': {
      const r = await Resident.findOneAndUpdate({ mobileNumber: number }, { isSubscribed: false });
      return r ? 'You will no longer receive Brgy. Danao alerts. Text START to resume.' : HELP;
    }
    case 'START':
    case 'JOIN': {
      const r = await Resident.findOneAndUpdate({ mobileNumber: number }, { isSubscribed: true });
      return r
        ? 'You will now receive Brgy. Danao disaster alerts.'
        : 'Your number is not registered. Please register at the Brgy. Danao hall to receive alerts.';
    }
    default:
      return HELP;
  }
}

router.post('/inbound', async (req, res) => {
  const b = req.body;
  const from = b.From || b.from || b.number || b.mobile_number;
  const text = b.Body ?? b.message ?? b.text;
  const reply = await handleInbound(from, text);

  if (reply) {
    try {
      await sendSms(normalizePHMobile(from), reply);
    } catch (err) {
      console.error('Inbound reply failed:', err.message);
    }
  }
  // Twilio expects TwiML; other gateways just need a 200.
  if (b.From) return res.type('text/xml').send('<Response></Response>');
  res.json({ ok: true, reply });
});

module.exports = router;
