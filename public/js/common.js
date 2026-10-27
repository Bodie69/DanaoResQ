// Shared helpers for the admin page.
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const label = (s) => String(s ?? '').replace(/_/g, ' ');
const timeAgo = (d) => {
  const s = Math.round((Date.now() - new Date(d)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString();
};

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = isError ? 'error' : '';
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), 3500);
}

// Wraps a handler so API errors show as a toast.
const safe = (fn) => async (...args) => {
  try { return await fn(...args); } catch (err) { toast(err.message, true); }
};

// ---------- Tabs (sidebar navigation) ----------
let currentTab = 'dashboard';
function showTab(name) {
  currentTab = name;
  $$('nav button[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('main > section').forEach((s) => (s.hidden = s.id !== `tab-${name}`));
  $('#page-title').textContent = $(`nav button[data-tab="${name}"] .nav-label`).textContent;
  toggleSidebar(false);
  window.scrollTo(0, 0);
  document.dispatchEvent(new CustomEvent('tab:shown', { detail: name }));
}
$$('nav button[data-tab]').forEach((btn) => btn.addEventListener('click', () => showTab(btn.dataset.tab)));
const onTab = (name, fn) => document.addEventListener('tab:shown', (e) => e.detail === name && fn());

// On small screens the sidebar slides in over the page.
function toggleSidebar(open) {
  document.body.classList.toggle('sidebar-open', open);
}
$('#menu-toggle').addEventListener('click', () => toggleSidebar(!document.body.classList.contains('sidebar-open')));
$('#sidebar-backdrop').addEventListener('click', () => toggleSidebar(false));
document.addEventListener('keydown', (e) => e.key === 'Escape' && toggleSidebar(false));

// Clock and server / SMS status in the sidebar footer.
function tickClock() {
  $('#topbar-clock').textContent = new Date().toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
async function checkStatus() {
  const el = $('.sys-status');
  try {
    const { smsProvider } = await api('/health');
    el.classList.remove('down');
    $('#sys-status-text').textContent = `Online · SMS: ${smsProvider}`;
  } catch {
    el.classList.add('down');
    $('#sys-status-text').textContent = 'Server unreachable';
  }
}
tickClock();
checkStatus();
setInterval(tickClock, 30000);
setInterval(checkStatus, 60000);

// ---------- Maps (Leaflet + OpenStreetMap) ----------
const configReady = api('/config').catch(() => ({ mapCenter: null, mapBounds: null }));
const PH_CENTER = [12.88, 121.77];

// Creates a map locked to the configured area (Sibuyan Island by default).
async function makeMap(el) {
  const { mapCenter, mapBounds } = await configReady;
  const bounds = mapBounds && L.latLngBounds(mapBounds);
  const map = L.map(el, bounds ? { maxBounds: bounds.pad(0.1), maxBoundsViscosity: 1 } : {});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
  if (bounds) {
    map.fitBounds(bounds);
    map.setMinZoom(map.getZoom()); // can't zoom out past the whole island
  }
  if (mapCenter) map.setView(mapCenter, 15);
  else if (!bounds) map.setView(PH_CENTER, 6);
  // Keep the fixed view instead of auto-zooming to markers when an area is configured.
  map.hasCenter = !!(mapCenter || bounds);
  return map;
}

const MARKER_COLORS = { open: '#2e7d32', full: '#ef6c00', closed: '#78909c', sos: '#c62828' };
const hasLoc = (o) => o?.location?.lat != null && o?.location?.lng != null;
const osmLink = (loc) => `https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=18/${loc.lat}/${loc.lng}`;
