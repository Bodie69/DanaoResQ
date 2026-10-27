// Dashboard: live overview of SOS, shelters, alerts and residents.
let dashMap, dashLayer;

// cls sets the tile's gradient (c-red, c-blue, ...) plus state classes (alarm, warn).
function tile(value, title, sub = '', cls = '', icon = '') {
  return `<div class="stat ${cls}">${icon ? `<div class="stat-icon">${icon}</div>` : ''}<div class="stat-value">${value}</div><div class="stat-title">${title}</div>${sub ? `<small>${sub}</small>` : ''}</div>`;
}

async function loadDashboard() {
  const d = await api('/dashboard');
  const sos = d.sos.byStatus;
  const pending = sos.pending || 0;
  const active = pending + (sos.acknowledged || 0) + (sos.responding || 0);
  const sent = d.sms30d.sent || 0;
  const failed = d.sms30d.failed || 0;

  $('#stat-tiles').innerHTML = [
    tile(active, 'Active SOS', `${pending} pending`, `c-red ${pending ? 'alarm' : ''}`, '&#128680;'),
    tile(d.residents.total, 'Registered households', `${d.residents.subscribed} receive SMS`, 'c-blue', '&#127968;'),
    tile(d.residents.people, 'People covered', 'total household members', 'c-teal', '&#128101;'),
    tile(`${d.shelters.open}`, 'Open shelters', `${d.shelters.occupancy}/${d.shelters.capacity} occupied`, 'c-green', '&#9978;'),
    tile(d.alerts.byStatus.sent || 0, 'Alerts sent', `${d.alerts.byStatus.draft || 0} drafts`, 'c-orange', '&#128226;'),
    tile(sent, 'SMS sent (30 days)', failed ? `${failed} failed` : 'no failures', `c-violet ${failed ? 'warn' : ''}`, '&#128172;'),
  ].join('');

  $('#dash-sos').innerHTML = d.sos.active.map((s) => `
    <li>
      <span class="badge ${s.status}">${s.status}</span>
      <strong>${esc(s.name || s.mobileNumber)}</strong> ${s.purok ? `&middot; ${esc(s.purok)}` : ''} &middot; ${s.peopleCount} pax
      <small>${timeAgo(s.createdAt)}</small>
      ${s.message ? `<br><small>${esc(s.message)}</small>` : ''}
    </li>`).join('') || '<li><small>No active SOS requests.</small></li>';

  $('#dash-shelters').innerHTML = d.shelters.list.map((s) => {
    const pct = s.capacity ? Math.min(100, Math.round((s.currentOccupancy / s.capacity) * 100)) : 0;
    return `
      <div class="bar-row">
        <div><strong>${esc(s.name)}</strong> <span class="badge ${s.status}">${s.status}</span>
          <small>${s.currentOccupancy}/${s.capacity || '?'}</small></div>
        <div class="bar"><div style="width:${pct}%" class="${pct >= 90 ? 'hi' : pct >= 60 ? 'mid' : ''}"></div></div>
      </div>`;
  }).join('') || '<small>No shelters added yet.</small>';

  $('#dash-alerts').innerHTML = d.alerts.recent.map((a) => `
    <li><span class="badge ${a.severity}">${a.severity}</span> <strong>${esc(a.title)}</strong>
      <small>${a.sentAt ? timeAgo(a.sentAt) : ''} &middot; ${a.stats.sent}/${a.stats.total} delivered</small></li>`).join('')
    || '<li><small>No alerts sent yet.</small></li>';

  $('#dash-puroks').innerHTML = d.residents.byPurok.map((p) =>
    `<tr><td>${esc(p._id)}</td><td>${p.residents}</td><td>${p.people}</td></tr>`).join('')
    || '<tr><td colspan="3"><small>No residents yet.</small></td></tr>';

  const v = d.residents.vulnerable;
  $('#dash-vulnerable').innerHTML = [
    tile(v.senior, 'With seniors', '', 'c-violet', '&#128116;'),
    tile(v.pwd, 'With PWD', '', 'c-blue', '&#9855;'),
    tile(v.pregnant, 'With pregnant', '', 'c-pink', '&#129328;'),
    tile(v.child, 'With children', '', 'c-orange', '&#128118;'),
  ].join('');

  updateSosBadge(pending);
  await drawDashMap(d);
}

async function drawDashMap(d) {
  if (!dashMap) {
    dashMap = await makeMap($('#dash-map'));
    dashLayer = L.featureGroup().addTo(dashMap);
  }
  dashLayer.clearLayers();
  for (const s of d.shelters.list.filter(hasLoc)) {
    L.circleMarker([s.location.lat, s.location.lng], { radius: 9, color: MARKER_COLORS[s.status], fillOpacity: 0.7 })
      .bindPopup(`<strong>${esc(s.name)}</strong><br>${label(s.type)} &middot; ${s.status}<br>${s.currentOccupancy}/${s.capacity} occupied`)
      .addTo(dashLayer);
  }
  for (const s of d.sos.active.filter(hasLoc)) {
    L.circleMarker([s.location.lat, s.location.lng], { radius: 10, color: MARKER_COLORS.sos, fillOpacity: 0.9 })
      .bindPopup(`<strong>SOS: ${esc(s.name || s.mobileNumber)}</strong><br>${esc(s.mobileNumber)}<br>${s.peopleCount} pax &middot; ${s.status}<br>${esc(s.message)}`)
      .addTo(dashLayer);
  }
  dashMap.invalidateSize();
  if (!dashMap.hasCenter && dashLayer.getLayers().length) dashMap.fitBounds(dashLayer.getBounds(), { maxZoom: 16, padding: [30, 30] });
}

onTab('dashboard', safe(loadDashboard));
setInterval(() => currentTab === 'dashboard' && !document.hidden && safe(loadDashboard)(), 30000);
safe(loadDashboard)();
