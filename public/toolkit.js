// Resident-facing safety toolkit. Data is saved on the phone (localStorage) so it keeps
// working without internet; the service worker (sw.js) caches the page itself.
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const label = (s) => String(s ?? '').replace(/_/g, ' ');

const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
  },
};

// Used when the phone has never been online with this page.
const FALLBACK = {
  sosNumber: '',
  hotlines: [
    { name: 'National Emergency Hotline', number: '911', category: 'rescue' },
    { name: 'Philippine Red Cross', number: '143', category: 'medical' },
  ],
  actions: [],
  shelters: [],
  updatedAt: null,
};
let data = store.get('toolkit-data', FALLBACK);
let myLocation = null;

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const smsLink = (number, body) => `sms:${number}${isIOS ? '&' : '?'}body=${encodeURIComponent(body)}`;

// ---------- Online status & sync ----------
function renderNet() {
  const el = $('#net-status');
  el.textContent = navigator.onLine ? 'Online' : 'Offline';
  el.classList.toggle('offline', !navigator.onLine);
  $('#sync-info').textContent = data.updatedAt
    ? `Info saved ${new Date(data.updatedAt).toLocaleString()}`
    : 'Connect to the internet once to save barangay info';
}
window.addEventListener('online', () => { renderNet(); sync(); });
window.addEventListener('offline', renderNet);

async function sync() {
  try {
    const res = await fetch('/api/public/toolkit', { cache: 'no-store' });
    if (!res.ok) throw new Error();
    data = await res.json();
    store.set('toolkit-data', data);
    renderAll();
  } catch { /* offline: keep saved copy */ }
  renderNet();
}

// ---------- Tabs ----------
document.querySelectorAll('.tabs button').forEach((btn) =>
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b === btn));
    for (const sec of ['hotlines', 'guides', 'shelters', 'gobag', 'tools']) $(`#sec-${sec}`).hidden = sec !== btn.dataset.sec;
    if (btn.dataset.sec === 'shelters') locate().then(renderShelters);
  })
);

// ---------- Location ----------
function locate() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        myLocation = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy };
        resolve(myLocation);
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

function distanceKm(a, b) {
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ---------- SOS ----------
const sosForm = $('#sos-form');
const profile = store.get('profile', {});
for (const k of ['name', 'mobileNumber', 'purok']) if (profile[k]) sosForm[k].value = profile[k];

$('#sos-big').addEventListener('click', async () => {
  sosForm.hidden = false;
  $('#sos-big').hidden = true;
  $('#sos-fallback').hidden = true;
  $('#loc-info').textContent = 'Getting your location…';
  const loc = await locate();
  $('#loc-info').textContent = loc
    ? `Location found (±${Math.round(loc.accuracy)} m). It will be sent with your SOS.`
    : 'Location unavailable. Please describe where you are in the message.';
});

$('#sos-close').addEventListener('click', () => {
  sosForm.hidden = true;
  $('#sos-big').hidden = false;
});

function sosText(f) {
  const parts = [`SOS ${f.name.value || ''}`.trim()];
  if (f.purok.value) parts.push(f.purok.value);
  parts.push(`${f.peopleCount.value || 1} pax`);
  if (f.message.value) parts.push(f.message.value);
  if (myLocation) parts.push(`loc ${myLocation.lat.toFixed(5)},${myLocation.lng.toFixed(5)}`);
  return parts.join(', ');
}

function showFallback(f) {
  const link = $('#sos-sms');
  if (data.sosNumber) {
    link.href = smsLink(data.sosNumber, sosText(f));
    link.hidden = false;
  } else link.hidden = true;
  $('#sos-fallback').hidden = false;
}

sosForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = sosForm;
  store.set('profile', { name: f.name.value, mobileNumber: f.mobileNumber.value, purok: f.purok.value });

  if (!navigator.onLine) return showFallback(f);
  const btn = f.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Sending…';
  try {
    const res = await fetch('/api/public/sos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: f.name.value,
        mobileNumber: f.mobileNumber.value,
        purok: f.purok.value,
        peopleCount: Number(f.peopleCount.value) || 1,
        message: f.message.value,
        location: myLocation,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      if (res.status === 400) return alertBox(body.error);
      throw new Error(body.error);
    }
    store.set('last-sos', { id: body.id, at: body.createdAt });
    f.hidden = true;
    $('#sos-big').hidden = false;
    f.message.value = '';
    renderSosStatus({ status: body.status });
  } catch {
    showFallback(f);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send SOS';
  }
});

function alertBox(msg) {
  const el = $('#sos-status');
  el.className = 'notice';
  el.textContent = msg;
  el.hidden = false;
}

const STATUS_TEXT = {
  pending: 'Your SOS was received. Barangay responders will contact you. Stay where it is safe and keep your phone on.',
  acknowledged: 'The barangay has seen your SOS and is coordinating help.',
  responding: 'Responders are on the way. Stay visible and keep your phone on.',
  resolved: 'Your SOS has been marked resolved.',
  cancelled: 'Your SOS was cancelled.',
};

function renderSosStatus(s) {
  const el = $('#sos-status');
  el.className = 'notice ok';
  el.innerHTML = `<strong>SOS status: ${esc(s.status)}</strong><br>${STATUS_TEXT[s.status] || ''}${s.responderNotes ? `<br><em>Note: ${esc(s.responderNotes)}</em>` : ''}`;
  el.hidden = false;
}

// Keep checking the last SOS for 6 hours.
async function pollSos() {
  const last = store.get('last-sos');
  if (!last || Date.now() - new Date(last.at) > 6 * 3600 * 1000 || !navigator.onLine) return;
  try {
    const res = await fetch(`/api/public/sos/${last.id}`, { cache: 'no-store' });
    if (res.ok) renderSosStatus(await res.json());
  } catch { /* offline */ }
}
setInterval(pollSos, 20000);

// ---------- Hotlines ----------
function renderHotlines() {
  $('#hotline-list').innerHTML = data.hotlines.map((h) => `
    <li>
      <div><strong>${esc(h.name)}</strong><br><span class="cat">${esc(h.category)}</span> ${esc(h.number)}</div>
      <a class="btn call" href="tel:${esc(h.number)}">Call</a>
    </li>`).join('') || '<li class="muted">No hotlines saved.</li>';
}

// ---------- Emergency action guides ----------
function renderGuideOptions() {
  const types = [...new Set(data.actions.map((a) => a.disasterType))];
  const sel = $('#guide-type');
  const current = sel.value || store.get('guide-type', types[0]);
  sel.innerHTML = types.map((t) => `<option value="${t}">${label(t)}</option>`).join('');
  if (types.includes(current)) sel.value = current;
  renderGuide();
}

function renderGuide() {
  const type = $('#guide-type').value;
  store.set('guide-type', type);
  const items = data.actions.filter((a) => a.disasterType === type);
  $('#guide-content').innerHTML = items.map((a) => `
    <div class="phase ${a.phase}">
      <h3>${esc(a.title)}</h3>
      <ol>${a.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
    </div>`).join('') || '<p class="muted">Connect to the internet once to download the guides.</p>';
}
$('#guide-type').addEventListener('change', renderGuide);

// ---------- Shelters ----------
function renderShelters() {
  let list = data.shelters.map((s) => ({
    ...s,
    km: myLocation && s.location?.lat != null ? distanceKm(myLocation, s.location) : null,
  }));
  list.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
  $('#shelter-note').textContent = data.updatedAt
    ? `Status as of ${new Date(data.updatedAt).toLocaleString()}.${myLocation ? ' Sorted by distance from you.' : ''}`
    : '';
  $('#shelter-list').innerHTML = list.map((s) => `
    <li>
      <div>
        <strong>${esc(s.name)}</strong> <span class="badge ${s.status}">${s.status}</span><br>
        <span class="cat">${label(s.type)}</span> ${esc([s.purok, s.address].filter(Boolean).join(', '))}<br>
        ${s.capacity ? `<small>${Math.max(s.capacity - s.currentOccupancy, 0)} of ${s.capacity} slots free</small>` : ''}
        ${s.km != null ? `<small> &middot; ${s.km.toFixed(1)} km away</small>` : ''}
        ${s.facilities?.length ? `<br><small>${s.facilities.map(label).join(', ')}</small>` : ''}
      </div>
      ${s.location?.lat != null ? `<a class="btn call" target="_blank" href="https://www.google.com/maps/dir/?api=1&destination=${s.location.lat},${s.location.lng}">Go</a>` : ''}
    </li>`).join('') || '<li class="muted">No open shelters right now.</li>';
}

// ---------- Go-bag checklist ----------
const GOBAG = {
  'Water & food': ['Drinking water (4 L per person per day)', 'Ready-to-eat food / canned goods', 'Can opener & utensils'],
  'Health': ['First aid kit', 'Maintenance medicines (1 week)', 'Face masks & alcohol', 'Hygiene kit (soap, toothbrush, sanitary pads)'],
  'Tools & light': ['Flashlight & extra batteries', 'Battery-powered radio', 'Whistle', 'Power bank (fully charged)', 'Multi-tool or knife'],
  'Documents & money': ['IDs and birth certificates in a waterproof bag', 'Cash in small bills', 'List of emergency contacts on paper'],
  'Clothing': ['Extra clothes & underwear', 'Raincoat / umbrella', 'Blanket or sleeping mat', 'Sturdy footwear'],
  'Special needs': ['Baby supplies (milk, diapers)', 'Items for seniors / PWD (glasses, cane)', 'Pet food & leash'],
};

function renderGobag() {
  const checked = store.get('gobag', {});
  let html = '';
  for (const [group, items] of Object.entries(GOBAG)) {
    html += `<li class="group">${group}</li>`;
    html += items.map((item) => `<li><label><input type="checkbox" data-item="${esc(item)}" ${checked[item] ? 'checked' : ''}> ${esc(item)}</label></li>`).join('');
  }
  $('#gobag-list').innerHTML = html;
  updateGobagProgress();
}

function updateGobagProgress() {
  const all = Object.values(GOBAG).flat().length;
  const done = Object.values(store.get('gobag', {})).filter(Boolean).length;
  $('#gobag-progress > div').style.width = `${Math.round((done / all) * 100)}%`;
}

$('#gobag-list').addEventListener('change', (e) => {
  const checked = store.get('gobag', {});
  checked[e.target.dataset.item] = e.target.checked;
  store.set('gobag', checked);
  updateGobagProgress();
});
$('#gobag-reset').addEventListener('click', () => {
  if (!confirm('Clear all go-bag checks?')) return;
  store.set('gobag', {});
  renderGobag();
});

// ---------- Tools ----------
let siren = null;
$('#tool-siren').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  if (siren) {
    siren.ctx.close();
    siren = null;
    btn.classList.remove('on');
    return;
  }
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = 1100;
  lfo.frequency.value = 1.5; // wail up and down
  lfoGain.gain.value = 500;
  lfo.connect(lfoGain).connect(osc.frequency);
  osc.connect(ctx.destination);
  osc.start();
  lfo.start();
  siren = { ctx };
  btn.classList.add('on');
});

$('#tool-light').addEventListener('click', async () => {
  $('#light-overlay').hidden = false;
  try { await document.documentElement.requestFullscreen?.(); } catch { /* optional */ }
  try { window.wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* optional */ }
});
$('#light-overlay').addEventListener('click', () => {
  $('#light-overlay').hidden = true;
  if (document.fullscreenElement) document.exitFullscreen();
  window.wakeLock?.release?.();
});

$('#tool-safe').addEventListener('click', async (e) => {
  e.preventDefault();
  const loc = myLocation || (await locate());
  const p = store.get('profile', {});
  const msg = `I'm safe.${p.name ? ` - ${p.name}` : ''}${loc ? ` Location: ${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}` : ''}`;
  location.href = smsLink('', msg);
});

$('#tool-share-loc').addEventListener('click', async () => {
  const el = $('#coords');
  el.hidden = false;
  el.textContent = 'Getting location…';
  const loc = await locate();
  el.textContent = loc
    ? `Lat ${loc.lat.toFixed(5)}, Lng ${loc.lng.toFixed(5)} (±${Math.round(loc.accuracy)} m). Read these to responders over the phone.`
    : 'Location unavailable. Turn on GPS / location services.';
});

$('#profile-clear').addEventListener('click', () => {
  store.set('profile', {});
  for (const k of ['name', 'mobileNumber', 'purok']) sosForm[k].value = '';
});

// ---------- Init ----------
function renderAll() {
  renderHotlines();
  renderGuideOptions();
  renderShelters();
}

renderAll();
renderGobag();
renderNet();
sync();
pollSos();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
