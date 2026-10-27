const router = require('express').Router();
const Resident = require('../models/Resident');

const notFound = (res) => res.status(404).json({ error: 'Resident not found' });
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// CREATE
router.post('/', async (req, res) => {
  const resident = await Resident.create(req.body);
  res.status(201).json(resident);
});

// READ (list) — filters: ?purok=&subscribed=true|false&q=name-or-number
router.get('/', async (req, res) => {
  const { purok, subscribed, q } = req.query;
  const filter = {};
  if (purok) filter.purok = purok;
  if (subscribed !== undefined) filter.isSubscribed = subscribed === 'true';
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ firstName: rx }, { lastName: rx }, { mobileNumber: rx }];
  }
  res.json(await Resident.find(filter).sort({ lastName: 1, firstName: 1 }));
});

router.get('/puroks', async (req, res) => {
  res.json((await Resident.distinct('purok')).sort());
});

// READ (one)
router.get('/:id', async (req, res) => {
  const resident = await Resident.findById(req.params.id);
  resident ? res.json(resident) : notFound(res);
});

// UPDATE
router.put('/:id', async (req, res) => {
  const resident = await Resident.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  resident ? res.json(resident) : notFound(res);
});

// DELETE
router.delete('/:id', async (req, res) => {
  const resident = await Resident.findByIdAndDelete(req.params.id);
  resident ? res.status(204).end() : notFound(res);
});

module.exports = router;
