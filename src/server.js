require('dotenv').config();
const path = require('path');
const express = require('express');
const connectDB = require('./config/db');
const seedDefaults = require('./seed');
const crudRouter = require('./routes/crudRouter');
const errorHandler = require('./middleware/errorHandler');
const { providerName } = require('./services/sms');
const Shelter = require('./models/Shelter');
const EmergencyAction = require('./models/EmergencyAction');
const Hotline = require('./models/Hotline');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // SMS gateway webhooks post form data
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/residents', require('./routes/residents'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/sos', require('./routes/sos'));
app.use('/api/shelters', crudRouter(Shelter, { filters: ['status', 'type', 'purok'], sort: { name: 1 } }));
app.use('/api/emergency-actions', crudRouter(EmergencyAction, {
  filters: ['disasterType', 'phase'],
  sort: { disasterType: 1, order: 1 },
  label: 'Emergency action',
}));
app.use('/api/hotlines', crudRouter(Hotline, { filters: ['category'], sort: { order: 1, name: 1 } }));
app.use('/api/sms', require('./routes/smsInbound'));
app.use('/api/public', require('./routes/public'));
app.get('/api/health', (req, res) => res.json({ ok: true, smsProvider: providerName() }));
// Maps are limited to Sibuyan Island unless MAP_BOUNDS ("south,west,north,east") says otherwise.
const SIBUYAN_BOUNDS = '12.2672,122.4234,12.5057,122.6987';
app.get('/api/config', (req, res) => {
  const [lat, lng] = (process.env.MAP_CENTER || '').split(',').map(Number);
  const b = (process.env.MAP_BOUNDS || SIBUYAN_BOUNDS).split(',').map(Number);
  res.json({
    mapCenter: Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null,
    mapBounds: b.length === 4 && b.every(Number.isFinite) ? [[b[0], b[1]], [b[2], b[3]]] : null,
  });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

connectDB(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/danaoresq')
  .then(seedDefaults)
  .then(() => app.listen(PORT, () => {
    console.log(`DanaoResQ admin:   http://localhost:${PORT} (SMS: ${providerName()})`);
    console.log(`Safety toolkit:    http://localhost:${PORT}/toolkit.html`);
  }))
  .catch((err) => {
    console.error('Startup failed:', err.message);
    process.exit(1);
  });
