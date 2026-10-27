const router = require('express').Router();
const SosRequest = require('../models/SosRequest');
const { createSos, updateSosStatus } = require('../services/sosService');

const notFound = (res) => res.status(404).json({ error: 'SOS request not found' });

// CREATE (manual entry by barangay staff, e.g. a walk-in or phone call)
router.post('/', async (req, res) => {
  res.status(201).json(await createSos({ ...req.body, channel: 'manual' }));
});

// READ (list) — ?status=pending or ?active=true (pending/acknowledged/responding)
router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.active === 'true') filter.status = { $in: ['pending', 'acknowledged', 'responding'] };
  res.json(await SosRequest.find(filter).populate('resident', 'firstName lastName purok vulnerable householdSize').sort({ createdAt: -1 }));
});

// READ (one)
router.get('/:id', async (req, res) => {
  const sos = await SosRequest.findById(req.params.id).populate('resident');
  sos ? res.json(sos) : notFound(res);
});

// UPDATE — details and/or status. Body: { status, note, notify, name, purok, message, peopleCount, location }
router.put('/:id', async (req, res) => {
  const sos = await SosRequest.findById(req.params.id);
  if (!sos) return notFound(res);
  const { status, note, notify, ...rest } = req.body;
  for (const k of ['name', 'purok', 'message', 'peopleCount', 'location']) if (k in rest) sos[k] = rest[k];
  const result = await updateSosStatus(sos, { status, note, notify });
  res.json({ ...result.sos.toJSON(), notified: result.notified });
});

// DELETE
router.delete('/:id', async (req, res) => {
  const sos = await SosRequest.findByIdAndDelete(req.params.id);
  sos ? res.status(204).end() : notFound(res);
});

module.exports = router;
