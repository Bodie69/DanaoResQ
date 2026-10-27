// Emergency distress SOS inbox.
const SOS_NEXT = {
  pending: [['acknowledged', 'Acknowledge'], ['responding', 'Dispatch']],
  acknowledged: [['responding', 'Dispatch']],
  responding: [['resolved', 'Resolve']],
  resolved: [],
  cancelled: [],
};
let sosById = {};
let lastPending = null;

function updateSosBadge(pending) {
  const badge = $('#sos-badge');
  badge.textContent = pending;
  badge.hidden = !pending;
  if (lastPending !== null && pending > lastPending) {
    toast(`New SOS request received (${pending} pending)`, true);
    beep();
  }
  lastPending = pending;
  document.title = pending ? `(${pending}) SOS - DanaoResQ Admin` : 'DanaoResQ Admin';
}

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch { /* audio blocked until user interacts */ }
}

async function loadSos() {
  const f = $('#sos-filter').value;
  const list = await api(f === 'active' ? '/sos?active=true' : f ? `/sos?status=${f}` : '/sos');
  sosById = Object.fromEntries(list.map((s) => [s._id, s]));
  $('#sos-rows').innerHTML = list.map((s) => {
    const r = s.resident;
    const flags = r ? Object.entries(r.vulnerable || {}).filter(([, v]) => v).map(([k]) => `<span class="badge">${k.toUpperCase()}</span>`).join(' ') : '';
    return `
    <tr class="${s.status === 'pending' ? 'row-alarm' : ''}">
      <td>${new Date(s.createdAt).toLocaleString()}<br><small>${timeAgo(s.createdAt)} &middot; via ${s.channel}</small></td>
      <td><strong>${esc(s.name || '(unknown)')}</strong><br><a href="tel:${esc(s.mobileNumber)}">${esc(s.mobileNumber)}</a>
        ${r ? '<br><small>registered resident</small>' : ''} ${flags}</td>
      <td>${esc(s.purok || '—')}</td>
      <td>${s.peopleCount}</td>
      <td>${esc(s.message || '')}${s.responderNotes ? `<br><small>Note: ${esc(s.responderNotes)}</small>` : ''}</td>
      <td>${hasLoc(s) ? `<a href="${osmLink(s.location)}" target="_blank">Open map</a>${s.location.accuracy ? `<br><small>&plusmn;${Math.round(s.location.accuracy)} m</small>` : ''}` : '—'}</td>
      <td><span class="badge ${s.status}">${s.status}</span></td>
      <td>
        ${SOS_NEXT[s.status].map(([st, txt]) => `<button class="small ${st === 'resolved' ? '' : 'danger'}" data-act="status" data-status="${st}" data-id="${s._id}">${txt}</button>`).join('')}
        <button class="small secondary" data-act="note" data-id="${s._id}">Note</button>
        ${['pending', 'acknowledged'].includes(s.status) ? `<button class="small secondary" data-act="status" data-status="cancelled" data-id="${s._id}">Cancel</button>` : ''}
        <button class="small secondary" data-act="delete" data-id="${s._id}">Delete</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="8"><small>No SOS requests.</small></td></tr>';
}

$('#sos-filter').addEventListener('change', safe(loadSos));

$('#sos-rows').addEventListener('click', safe(async (e) => {
  const { act, id, status } = e.target.dataset;
  if (!act) return;
  const s = sosById[id];
  if (act === 'status') {
    const note = status === 'resolved' || status === 'responding' ? prompt('Note for this update (optional):', '') : '';
    if (note === null) return;
    const res = await api(`/sos/${id}`, { method: 'PUT', body: { status, note: note || undefined, notify: $('#sos-notify').checked } });
    toast(`SOS marked ${status}${res.notified ? ' — requester notified by SMS' : ''}`);
  } else if (act === 'note') {
    const note = prompt('Responder note:', s.responderNotes || '');
    if (note === null) return;
    await api(`/sos/${id}`, { method: 'PUT', body: { note } });
    toast('Note saved');
  } else if (act === 'delete') {
    if (!confirm('Delete this SOS record permanently?')) return;
    await api(`/sos/${id}`, { method: 'DELETE' });
    toast('SOS deleted');
  }
  await loadSos();
}));

$('#sos-form').addEventListener('submit', safe(async (e) => {
  e.preventDefault();
  const f = e.target;
  await api('/sos', {
    method: 'POST',
    body: { name: f.name.value, mobileNumber: f.mobileNumber.value, purok: f.purok.value, peopleCount: Number(f.peopleCount.value) || 1, message: f.message.value },
  });
  f.reset();
  toast('SOS logged');
  await loadSos();
}));

onTab('sos', safe(loadSos));

// Poll for new SOS requests so staff are alerted from any tab.
setInterval(safe(async () => {
  if (document.hidden) return;
  const pending = await api('/sos?status=pending');
  updateSosBadge(pending.length);
  if (currentTab === 'sos') await loadSos();
}), 15000);
