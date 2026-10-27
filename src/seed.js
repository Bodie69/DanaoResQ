// Default content inserted on first run (only when the collections are empty).
// Staff can edit or delete all of it from the admin page.
const EmergencyAction = require('./models/EmergencyAction');
const Hotline = require('./models/Hotline');

const ACTIONS = {
  typhoon: {
    before: ['Monitor PAGASA bulletins and Brgy. Danao SMS alerts.', 'Prepare a go-bag good for at least 3 days.', 'Reinforce roofs and windows; tie down loose objects outside.', 'Charge phones and power banks; store drinking water.', 'Know your nearest evacuation center and the safest route to it.'],
    during: ['Stay indoors and away from windows and glass.', 'Evacuate immediately when the barangay orders it.', 'Turn off the main power switch if water starts entering your home.', 'Keep listening to the radio or official SMS updates.', 'Do not go outside during the eye of the storm; strong winds will return.'],
    after: ['Return home only when officials say it is safe.', 'Stay away from fallen power lines and damaged structures.', 'Check family members and neighbors, especially seniors and PWDs.', 'Boil water or use bottled water until the supply is declared safe.', 'Report damages and missing persons to the barangay.'],
  },
  flood: {
    before: ['Know if your home is in a flood-prone area of Brgy. Danao.', 'Move valuables, documents and appliances to higher places.', 'Prepare a go-bag and keep it within reach.', 'Clear drainage canals around your home.'],
    during: ['Move to higher ground or evacuate at once when water rises.', 'Never walk, swim or drive through floodwater; 15 cm of moving water can knock you down.', 'Turn off electricity and gas if it is safe to do so.', 'Stay away from rivers, creeks and drainage channels.', 'Text SOS to the barangay if you are trapped.'],
    after: ['Avoid floodwater; it may be contaminated or electrically charged.', 'Watch out for snakes and debris when cleaning.', 'Have a licensed electrician check wiring before turning power back on.', 'Clean and disinfect everything that got wet. Watch for signs of leptospirosis.'],
  },
  earthquake: {
    before: ['Secure heavy furniture, cabinets and appliances to walls.', 'Identify safe spots in each room: under sturdy tables, away from glass.', 'Practice DROP, COVER and HOLD ON with your family.', 'Prepare a go-bag and agree on a family meeting place.'],
    during: ['DROP to the ground, take COVER under a sturdy table, HOLD ON until shaking stops.', 'Stay away from windows, shelves and hanging objects.', 'If outdoors, move to an open area away from buildings, trees and power lines.', 'Do not use elevators or run outside while the ground is shaking.'],
    after: ['Expect aftershocks; drop, cover and hold on again when they happen.', 'Evacuate damaged buildings calmly; use stairs, not elevators.', 'Check for injuries and give first aid.', 'Check for gas leaks; do not light matches or switch on lights if you smell gas.', 'If near the coast and the quake was strong, move to high ground at once.'],
  },
  landslide: {
    before: ['Know if you live on or near a steep slope.', 'Watch for cracks in the ground, tilting trees or posts, and new springs.', 'Plant trees and maintain drainage on slopes.', 'Plan an evacuation route away from the slope.'],
    during: ['Evacuate immediately if you hear rumbling or see moving soil.', 'Move away from the path of the slide, to the sides, not downhill.', 'If you cannot escape, curl into a ball and protect your head.'],
    after: ['Stay away from the slide area; more slides may follow.', 'Help search for trapped persons only if trained and it is safe.', 'Report broken utility lines and blocked roads to the barangay.'],
  },
  fire: {
    before: ['Never leave cooking, candles or mosquito coils unattended.', 'Avoid overloading electrical outlets (octopus connections).', 'Keep a fire extinguisher or a pail of water/sand ready.', 'Plan two ways out of every room.'],
    during: ['Shout to alert others and get out immediately.', 'Crawl low under smoke; cover nose and mouth with a wet cloth.', 'Feel doors before opening; if hot, use another exit.', 'If your clothes catch fire: STOP, DROP and ROLL.', 'Call 911 or the Bureau of Fire Protection once you are safe.'],
    after: ['Do not go back inside until firefighters say it is safe.', 'Get burns and smoke inhalation checked by health workers.', 'Report to the barangay for assistance and documentation.'],
  },
  tsunami: {
    before: ['Know if your home, school or workplace is in a coastal hazard zone.', 'Learn the natural warnings: strong earthquake, sudden sea retreat, loud roar from the sea.', 'Know the route to high ground at least 10 meters above sea level.'],
    during: ['Do not wait for an official warning after a strong coastal earthquake. Go to high ground immediately.', 'Go on foot if possible; roads may be blocked.', 'Never go to the shore to watch the waves.', 'If caught in water, grab something that floats.'],
    after: ['Stay on high ground; more waves may come for hours.', 'Return only when officials declare it safe.', 'Avoid damaged buildings and floodwater.'],
  },
  storm_surge: {
    before: ['Know if you live in a low-lying coastal area.', 'Prepare to evacuate early when a storm surge warning is issued.', 'Secure fishing boats and gear well inland.'],
    during: ['Evacuate to inland evacuation centers immediately when ordered.', 'Stay away from the coastline, river mouths and beaches.', 'Do not return home until the warning is lifted.'],
    after: ['Watch out for debris, damaged structures and contaminated water.', 'Check on neighbors and report damages to the barangay.'],
  },
};

const PHASE_TITLE = { before: 'Before', during: 'During', after: 'After' };
const TYPE_TITLE = { typhoon: 'a Typhoon', flood: 'a Flood', earthquake: 'an Earthquake', landslide: 'a Landslide', fire: 'a Fire', tsunami: 'a Tsunami', storm_surge: 'a Storm Surge' };

// Numbers known to be nationwide. Barangay and MDRRMO numbers must be added by staff.
const HOTLINES = [
  { name: 'National Emergency Hotline', number: '911', category: 'rescue', order: 1 },
  { name: 'Philippine Red Cross', number: '143', category: 'medical', order: 2 },
];

async function seedDefaults() {
  if ((await EmergencyAction.estimatedDocumentCount()) === 0) {
    const docs = [];
    let order = 0;
    for (const [disasterType, phases] of Object.entries(ACTIONS)) {
      for (const [phase, steps] of Object.entries(phases)) {
        docs.push({ disasterType, phase, steps, order: order++, title: `${PHASE_TITLE[phase]} ${TYPE_TITLE[disasterType]}` });
      }
    }
    await EmergencyAction.insertMany(docs);
    console.log(`Seeded ${docs.length} emergency action guides`);
  }
  if ((await Hotline.estimatedDocumentCount()) === 0) {
    await Hotline.insertMany(HOTLINES);
    console.log(`Seeded ${HOTLINES.length} hotlines`);
  }
}

module.exports = seedDefaults;
