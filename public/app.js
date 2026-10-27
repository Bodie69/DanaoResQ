// Alerts and residents tabs. Helpers ($, api, toast, safe, ...) come from js/common.js.

// ---------- Puroks ----------
let puroks = [];
async function loadPuroks() {
  puroks = await api('/residents/puroks');
  $('#purok-list').innerHTML = puroks.map((p) => `<option value="${esc(p)}">`).join('');
  const filter = $('#resident-purok-filter');
  const current = filter.value;
  filter.innerHTML = '<option value="">All puroks</option>' + puroks.map((p) => `<option>${esc(p)}</option>`).join('');
  filter.value = current;
  renderPurokCheckboxes();
}

function renderPurokCheckboxes(selected = []) {
  $('#purok-checkboxes').innerHTML = puroks.length
    ? puroks.map((p) => `<label class="inline"><input type="checkbox" value="${esc(p)}" ${selected.includes(p) ? 'checked' : ''}> ${esc(p)}</label>`).join('')
    : '<small>No residents registered yet.</small>';
}

// ---------- Alerts ----------
const alertForm = $('#alert-form');

// Shared with the emergency actions tab, which needs the same disaster type list.
const alertMeta = api('/alerts/meta');

async function loadAlertMeta() {
  const { disasterTypes, severityLevels } = await alertMeta;
  const opts = (list) => list.map((v) => `<option value="${v}">${label(v)}</option>`).join('');
  alertForm.disasterType.innerHTML = opts(disasterTypes);
  alertForm.severity.innerHTML = opts(severityLevels);
}

// Opens the alerts tab with a new draft pre-filled (used by "Use in alert" on emergency actions).
function prefillAlert({ title, message, disasterType, severity = 'advisory' }) {
  resetAlertForm();
  alertForm.title.value = title;
  alertForm.message.value = message.slice(0, 459);
  alertForm.disasterType.value = disasterType;
  alertForm.severity.value = severity;
  $('#char-count').textContent = `${alertForm.message.value.length}/459`;
  showTab('alerts');
  alertForm.scrollIntoView({ behavior: 'smooth' });
}

async function loadAlerts() {
  const alerts = await api('/alerts');
  $('#alert-rows').innerHTML = alerts.map((a) => `
    <tr>
      <td><strong>${esc(a.title)}</strong><br><small>${esc(a.message)}</small></td>
      <td>${esc(label(a.disasterType))}</td>
      <td><span class="badge ${a.severity}">${a.severity}</span></td>
      <td>${a.targetPuroks.length ? a.targetPuroks.map(esc).join(', ') : 'All'}</td>
      <td><span class="badge ${a.status}">${a.status}</span>${a.sentAt ? `<br><small>${new Date(a.sentAt).toLocaleString()}</small>` : ''}</td>
      <td>${a.status === 'draft' ? '—' : `${a.stats.sent}/${a.stats.total} sent${a.stats.failed ? `, ${a.stats.failed} failed` : ''}`}</td>
      <td>
        ${a.status === 'draft' ? `<button class="small" data-act="edit" data-id="${a._id}">Edit</button>` : ''}
        ${['draft', 'failed'].includes(a.status) ? `<button class="small danger" data-act="send" data-id="${a._id}">Send</button>` : ''}
        ${a.status !== 'draft' ? `<button class="small secondary" data-act="logs" data-id="${a._id}">Logs</button>` : ''}
        <button class="small secondary" data-act="delete" data-id="${a._id}">Delete</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="7"><small>No alerts yet.</small></td></tr>';
  window.alertsById = Object.fromEntries(alerts.map((a) => [a._id, a]));
}

function alertPayload() {
  return {
    title: alertForm.title.value,
    message: alertForm.message.value,
    disasterType: alertForm.disasterType.value,
    severity: alertForm.severity.value,
    targetPuroks: [...document.querySelectorAll('#purok-checkboxes input:checked')].map((c) => c.value),
  };
}

function resetAlertForm() {
  alertForm.reset();
  alertForm.id.value = '';
  $('#alert-form-title').textContent = 'New Alert';
  $('#alert-cancel').hidden = true;
  $('#char-count').textContent = '0/459';
  renderPurokCheckboxes();
}

async function saveAlert(send) {
  if (!alertForm.reportValidity()) return;
  const id = alertForm.id.value;
  if (send && !confirm('Send this alert by SMS to all targeted residents now?')) return;
  let alert = id
    ? await api(`/alerts/${id}`, { method: 'PUT', body: alertPayload() })
    : await api('/alerts', { method: 'POST', body: alertPayload() });
  if (send) alert = await api(`/alerts/${alert._id}/send`, { method: 'POST' });
  toast(send ? `Alert sent: ${alert.stats.sent}/${alert.stats.total} delivered` : 'Draft saved');
  resetAlertForm();
  await loadAlerts();
}
onTab('alerts', safe(loadAlerts));

alertForm.addEventListener('submit', safe((e) => { e.preventDefault(); return saveAlert(false); }));
$('#save-send').addEventListener('click', safe(() => saveAlert(true)));
$('#alert-cancel').addEventListener('click', resetAlertForm);
alertForm.message.addEventListener('input', () => ($('#char-count').textContent = `${alertForm.message.value.length}/459`));

$('#alert-rows').addEventListener('click', safe(async (e) => {
  const { act, id } = e.target.dataset;
  if (!act) return;
  const a = window.alertsById[id];
  if (act === 'edit') {
    alertForm.id.value = id;
    for (const k of ['title', 'message', 'disasterType', 'severity']) alertForm[k].value = a[k];
    renderPurokCheckboxes(a.targetPuroks);
    $('#char-count').textContent = `${a.message.length}/459`;
    $('#alert-form-title').textContent = 'Edit Alert';
    $('#alert-cancel').hidden = false;
    alertForm.scrollIntoView({ behavior: 'smooth' });
  } else if (act === 'send') {
    if (!confirm(`Send "${a.title}" by SMS now?`)) return;
    const sent = await api(`/alerts/${id}/send`, { method: 'POST' });
    toast(`Alert sent: ${sent.stats.sent}/${sent.stats.total} delivered`);
    await loadAlerts();
  } else if (act === 'logs') {
    const logs = await api(`/alerts/${id}/logs`);
    $('#logs-title').textContent = a.title;
    $('#log-rows').innerHTML = logs.map((l) => `
      <tr>
        <td>${l.resident ? `${esc(l.resident.firstName)} ${esc(l.resident.lastName)} <small>(${esc(l.resident.purok)})</small>` : '<small>deleted</small>'}</td>
        <td>${esc(l.mobileNumber)}</td>
        <td><span class="badge ${l.status}">${l.status}</span></td>
        <td>${new Date(l.createdAt).toLocaleString()}</td>
        <td><small>${esc(l.error)}</small></td>
      </tr>`).join('') || '<tr><td colspan="5"><small>No recipients matched.</small></td></tr>';
    $('#logs-card').hidden = false;
    $('#logs-card').scrollIntoView({ behavior: 'smooth' });
  } else if (act === 'delete') {
    if (!confirm(`Delete alert "${a.title}" and its SMS logs?`)) return;
    await api(`/alerts/${id}`, { method: 'DELETE' });
    $('#logs-card').hidden = true;
    toast('Alert deleted');
    await loadAlerts();
  }
}));

// ---------- Residents ----------
const residentForm = $('#resident-form');
const VULNERABLE = ['senior', 'pwd', 'pregnant', 'child'];

async function loadResidents() {
  const params = new URLSearchParams();
  if ($('#resident-search').value) params.set('q', $('#resident-search').value);
  if ($('#resident-purok-filter').value) params.set('purok', $('#resident-purok-filter').value);
  const residents = await api(`/residents?${params}`);
  $('#resident-count').textContent = `(${residents.length})`;
  $('#resident-rows').innerHTML = residents.map((r) => `
    <tr>
      <td>${esc(r.lastName)}, ${esc(r.firstName)}${r.address ? `<br><small>${esc(r.address)}</small>` : ''}</td>
      <td>${esc(r.mobileNumber)}</td>
      <td>${esc(r.purok)}</td>
      <td>${r.householdSize}</td>
      <td>${VULNERABLE.filter((v) => r.vulnerable?.[v]).map((v) => `<span class="badge">${v.toUpperCase()}</span>`).join(' ') || '—'}</td>
      <td><span class="badge ${r.isSubscribed ? 'sent' : 'failed'}">${r.isSubscribed ? 'ON' : 'OFF'}</span></td>
      <td>
        <button class="small" data-act="edit" data-id="${r._id}">Edit</button>
        <button class="small secondary" data-act="delete" data-id="${r._id}">Delete</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="7"><small>No residents found.</small></td></tr>';
  window.residentsById = Object.fromEntries(residents.map((r) => [r._id, r]));
}

function resetResidentForm() {
  residentForm.reset();
  residentForm.id.value = '';
  $('#resident-form-title').textContent = 'Register Resident';
  $('#resident-cancel').hidden = true;
}

residentForm.addEventListener('submit', safe(async (e) => {
  e.preventDefault();
  const f = residentForm;
  const body = {
    firstName: f.firstName.value,
    lastName: f.lastName.value,
    mobileNumber: f.mobileNumber.value,
    purok: f.purok.value,
    address: f.address.value,
    householdSize: Number(f.householdSize.value) || 1,
    vulnerable: Object.fromEntries(VULNERABLE.map((v) => [v, f[v].checked])),
    isSubscribed: f.isSubscribed.checked,
  };
  const id = f.id.value;
  await api(id ? `/residents/${id}` : '/residents', { method: id ? 'PUT' : 'POST', body });
  toast(id ? 'Resident updated' : 'Resident registered');
  resetResidentForm();
  await Promise.all([loadResidents(), loadPuroks()]);
}));
$('#resident-cancel').addEventListener('click', resetResidentForm);

$('#resident-rows').addEventListener('click', safe(async (e) => {
  const { act, id } = e.target.dataset;
  if (!act) return;
  const r = window.residentsById[id];
  if (act === 'edit') {
    const f = residentForm;
    f.id.value = id;
    for (const k of ['firstName', 'lastName', 'mobileNumber', 'purok', 'address', 'householdSize']) f[k].value = r[k] ?? '';
    VULNERABLE.forEach((v) => (f[v].checked = !!r.vulnerable?.[v]));
    f.isSubscribed.checked = r.isSubscribed;
    $('#resident-form-title').textContent = 'Edit Resident';
    $('#resident-cancel').hidden = false;
    f.scrollIntoView({ behavior: 'smooth' });
  } else if (act === 'delete') {
    if (!confirm(`Delete ${r.firstName} ${r.lastName}?`)) return;
    await api(`/residents/${id}`, { method: 'DELETE' });
    toast('Resident deleted');
    await Promise.all([loadResidents(), loadPuroks()]);
  }
}));

let searchTimer;
$('#resident-search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(safe(loadResidents), 250);
});
$('#resident-purok-filter').addEventListener('change', safe(loadResidents));

// ---------- Init ----------
safe(async () => {
  await Promise.all([loadAlertMeta(), loadPuroks()]);
  await Promise.all([loadAlerts(), loadResidents()]);
})();
