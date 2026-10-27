// Endpoints used by the resident-facing offline safety toolkit (no admin access needed).
const router = require('express').Router();
const EmergencyAction = require('../models/EmergencyAction');
const Hotline = require('../models/Hotline');
const Shelter = require('../models/Shelter');
const SosRequest = require('../models/SosRequest');
const { createSos } = require('../services/sosService');

// Simple in-memory limit so the public SOS form can't be flooded: 5 requests / 10 min per IP.
const hits = new Map();
function rateLimit(req, res, next) {
  const now = Date.now();
  const recent = (hits.get(req.ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 5) return res.status(429).json({ error: 'Too many SOS requests. Please call 911 directly.' });
  recent.push(now);
  hits.set(req.ip, recent);
  next();
}

// Everything the toolkit caches for offline use, in one request.
router.get('/toolkit', async (req, res) => {
  const [actions, hotlines, shelters] = await Promise.all([
    EmergencyAction.find().sort({ disasterType: 1, order: 1 }).select('-__v'),
    Hotline.find().sort({ order: 1, name: 1 }).select('-__v'),
    Shelter.find({ status: { $ne: 'closed' } }).sort({ name: 1 }).select('-__v -notes'),
  ]);
  res.json({
    sosNumber: process.env.BARANGAY_SOS_NUMBER || '',
    actions,
    hotlines,
    shelters,
    updatedAt: new Date(),
  });
});

router.post('/sos', rateLimit, async (req, res) => {
  const { name, mobileNumber, purok, message, peopleCount, location } = req.body;
  const sos = await createSos({ name, mobileNumber, purok, message, peopleCount, location, channel: 'web' });
  res.status(201).json({ id: sos._id, status: sos.status, createdAt: sos.createdAt });
});

// Lets the requester check their SOS status from the toolkit.
router.get('/sos/:id', async (req, res) => {
  const sos = await SosRequest.findById(req.params.id).select('status responderNotes updatedAt');
  sos ? res.json(sos) : res.status(404).json({ error: 'SOS request not found' });
});

module.exports = router;
