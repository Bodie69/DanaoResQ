const router = require('express').Router();
const Resident = require('../models/Resident');
const Alert = require('../models/Alert');
const SmsLog = require('../models/SmsLog');
const Shelter = require('../models/Shelter');
const SosRequest = require('../models/SosRequest');

const countBy = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.count]));

router.get('/', async (req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    residentTotal, subscribed, households, vulnerable, byPurok,
    alertsByStatus, recentAlerts, smsByStatus,
    shelters, sosByStatus, activeSos,
  ] = await Promise.all([
    Resident.countDocuments(),
    Resident.countDocuments({ isSubscribed: true }),
    Resident.aggregate([{ $group: { _id: null, people: { $sum: '$householdSize' } } }]),
    Resident.aggregate([{
      $group: {
        _id: null,
        senior: { $sum: { $cond: ['$vulnerable.senior', 1, 0] } },
        pwd: { $sum: { $cond: ['$vulnerable.pwd', 1, 0] } },
        pregnant: { $sum: { $cond: ['$vulnerable.pregnant', 1, 0] } },
        child: { $sum: { $cond: ['$vulnerable.child', 1, 0] } },
      },
    }]),
    Resident.aggregate([
      { $group: { _id: '$purok', residents: { $sum: 1 }, people: { $sum: '$householdSize' } } },
      { $sort: { _id: 1 } },
    ]),
    Alert.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Alert.find({ status: { $ne: 'draft' } }).sort({ sentAt: -1 }).limit(5).select('title severity disasterType sentAt stats'),
    SmsLog.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Shelter.find().sort({ name: 1 }).select('name type purok status capacity currentOccupancy location'),
    SosRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    SosRequest.find({ status: { $in: ['pending', 'acknowledged', 'responding'] } })
      .sort({ createdAt: -1 }).limit(20).select('name mobileNumber purok status location createdAt peopleCount message'),
  ]);

  const openShelters = shelters.filter((s) => s.status !== 'closed');
  res.json({
    residents: {
      total: residentTotal,
      subscribed,
      people: households[0]?.people || 0,
      vulnerable: vulnerable[0] ? { ...vulnerable[0], _id: undefined } : { senior: 0, pwd: 0, pregnant: 0, child: 0 },
      byPurok,
    },
    alerts: { byStatus: countBy(alertsByStatus), recent: recentAlerts },
    sms30d: countBy(smsByStatus),
    shelters: {
      list: shelters,
      open: openShelters.length,
      capacity: openShelters.reduce((n, s) => n + s.capacity, 0),
      occupancy: openShelters.reduce((n, s) => n + s.currentOccupancy, 0),
    },
    sos: { byStatus: countBy(sosByStatus), active: activeSos },
  });
});

module.exports = router;
