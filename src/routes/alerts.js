const router = require('express').Router();
const Alert = require('../models/Alert');
const SmsLog = require('../models/SmsLog');
const { dispatchAlert } = require('../services/alertDispatcher');

const notFound = (res) => res.status(404).json({ error: 'Alert not found' });
const EDITABLE = ['title', 'message', 'disasterType', 'severity', 'targetPuroks', 'createdBy'];
const pick = (body) => Object.fromEntries(EDITABLE.filter((k) => k in body).map((k) => [k, body[k]]));

router.get('/meta', (req, res) => {
  res.json({ disasterTypes: Alert.DISASTER_TYPES, severityLevels: Alert.SEVERITY_LEVELS });
});

// CREATE — pass ?send=true to create and send immediately
router.post('/', async (req, res) => {
  let alert = await Alert.create(pick(req.body));
  if (req.query.send === 'true') alert = await dispatchAlert(alert);
  res.status(201).json(alert);
});

// READ (list) — filters: ?status=&disasterType=&severity=
router.get('/', async (req, res) => {
  const filter = {};
  for (const k of ['status', 'disasterType', 'severity']) if (req.query[k]) filter[k] = req.query[k];
  res.json(await Alert.find(filter).sort({ createdAt: -1 }));
});

// READ (one)
router.get('/:id', async (req, res) => {
  const alert = await Alert.findById(req.params.id);
  alert ? res.json(alert) : notFound(res);
});

// UPDATE — only drafts can be edited; sent alerts are kept as records
router.put('/:id', async (req, res) => {
  const alert = await Alert.findById(req.params.id);
  if (!alert) return notFound(res);
  if (alert.status !== 'draft') return res.status(409).json({ error: 'Only draft alerts can be edited' });
  alert.set(pick(req.body));
  res.json(await alert.save());
});

// DELETE — also removes its SMS logs
router.delete('/:id', async (req, res) => {
  const alert = await Alert.findByIdAndDelete(req.params.id);
  if (!alert) return notFound(res);
  await SmsLog.deleteMany({ alert: alert._id });
  res.status(204).end();
});

// SEND a draft (or retry a failed one) via SMS
router.post('/:id/send', async (req, res) => {
  const alert = await Alert.findById(req.params.id);
  if (!alert) return notFound(res);
  if (!['draft', 'failed'].includes(alert.status)) {
    return res.status(409).json({ error: `Alert is already ${alert.status}` });
  }
  res.json(await dispatchAlert(alert));
});

// SMS delivery logs for one alert
router.get('/:id/logs', async (req, res) => {
  const logs = await SmsLog.find({ alert: req.params.id })
    .populate('resident', 'firstName lastName purok')
    .sort({ createdAt: -1 });
  res.json(logs);
});

module.exports = router;
