// Shelters & safe zones.
const FACILITIES = ['water', 'food', 'toilets', 'power', 'medical', 'sleeping_area', 'pwd_access', 'pet_area'];
const shelterForm = $('#shelter-form');
let sheltersById = {};
let pickMap, pickMarker;

$('#facility-checkboxes').innerHTML = FACILITIES.map((f) =>
  `<label class="inline"><input type="checkbox" value="${f}"> ${label(f)}</label>`).join('');

async function initPickMap() {
  if (pickMap) return pickMap.invalidateSize();
  pickMap = await makeMap($('#shelter-map'));
  pickMap.on('click', (e) => setPick(e.latlng.lat, e.latlng.lng));
}

function setPick(lat, lng) {
  shelterForm.lat.value = lat?.toFixed?.(6) ?? '';
  shelterForm.lng.value = lng?.toFixed?.(6) ?? '';
  if (pickMarker) pickMarker.remove();
  pickMarker = lat != null ? L.marker([lat, lng]).addTo(pickMap) : null;
}

async function loadShelters() {
  const list = await api('/shelters');
  sheltersById = Object.fromEntries(list.map((s) => [s._id, s]));
  $('#shelter-rows').innerHTML = list.map((s) => `
    <tr>
      <td><strong>${esc(s.name)}</strong>${s.address ? `<br><small>${esc(s.address)}</small>` : ''}
        ${hasLoc(s) ? `<br><a href="${osmLink(s.location)}" target="_blank"><small>map</small></a>` : ''}</td>
      <td>${label(s.type)}</td>
      <td>${esc(s.purok || '—')}</td>
      <td>
        <select data-act="status" data-id="${s._id}">
          ${['open', 'full', 'closed'].map((st) => `<option ${st === s.status ? 'selected' : ''}>${st}</option>`).join('')}
        </select>
      </td>
      <td class="nowrap">
        <button class="small secondary" data-act="occ" data-delta="-1" data-id="${s._id}">&minus;</button>
        <strong>${s.currentOccupancy}</strong>/${s.capacity}
        <button class="small secondary" data-act="occ" data-delta="1" data-id="${s._id}">+</button>
      </td>
      <td>${s.facilities.map((f) => `<span class="badge">${label(f)}</span>`).join(' ') || '—'}</td>
      <td>${esc(s.contactPerson || '')}${s.contactNumber ? `<br><a href="tel:${esc(s.contactNumber)}">${esc(s.contactNumber)}</a>` : ''}</td>
      <td>
        <button class="small" data-act="edit" data-id="${s._id}">Edit</button>
        <button class="small secondary" data-act="delete" data-id="${s._id}">Delete</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="8"><small>No shelters or safe zones yet.</small></td></tr>';
}

function resetShelterForm() {
  shelterForm.reset();
  shelterForm.id.value = '';
  $('#shelter-form-title').textContent = 'Add Shelter / Safe Zone';
  $('#shelter-cancel').hidden = true;
  if (pickMap) setPick(null);
}

shelterForm.addEventListener('submit', safe(async (e) => {
  e.preventDefault();
  const f = shelterForm;
  const lat = f.lat.value === '' ? null : Number(f.lat.value);
  const lng = f.lng.value === '' ? null : Number(f.lng.value);
  const body = {
    name: f.name.value,
    type: f.type.value,
    status: f.status.value,
    purok: f.purok.value,
    address: f.address.value,
    capacity: Number(f.capacity.value) || 0,
    currentOccupancy: Number(f.currentOccupancy.value) || 0,
    contactPerson: f.contactPerson.value,
    contactNumber: f.contactNumber.value,
    notes: f.notes.value,
    facilities: $$('#facility-checkboxes input:checked').map((c) => c.value),
    location: lat != null && lng != null ? { lat, lng } : { lat: undefined, lng: undefined },
  };
  const id = f.id.value;
  await api(id ? `/shelters/${id}` : '/shelters', { method: id ? 'PUT' : 'POST', body });
  toast(id ? 'Shelter updated' : 'Shelter added');
  resetShelterForm();
  await loadShelters();
}));
$('#shelter-cancel').addEventListener('click', resetShelterForm);

const updateShelter = async (id, body) => {
  await api(`/shelters/${id}`, { method: 'PUT', body });
  await loadShelters();
};

$('#shelter-rows').addEventListener('change', safe(async (e) => {
  if (e.target.dataset.act === 'status') await updateShelter(e.target.dataset.id, { status: e.target.value });
}));

$('#shelter-rows').addEventListener('click', safe(async (e) => {
  const { act, id, delta } = e.target.dataset;
  if (!act || act === 'status') return;
  const s = sheltersById[id];
  if (act === 'occ') {
    await updateShelter(id, { currentOccupancy: Math.max(0, s.currentOccupancy + Number(delta)) });
  } else if (act === 'edit') {
    const f = shelterForm;
    f.id.value = id;
    for (const k of ['name', 'type', 'status', 'purok', 'address', 'capacity', 'currentOccupancy', 'contactPerson', 'contactNumber', 'notes']) f[k].value = s[k] ?? '';
    $$('#facility-checkboxes input').forEach((c) => (c.checked = s.facilities.includes(c.value)));
    await initPickMap();
    if (hasLoc(s)) {
      setPick(s.location.lat, s.location.lng);
      pickMap.setView([s.location.lat, s.location.lng], 16);
    } else setPick(null);
    $('#shelter-form-title').textContent = 'Edit Shelter / Safe Zone';
    $('#shelter-cancel').hidden = false;
    f.scrollIntoView({ behavior: 'smooth' });
  } else if (act === 'delete') {
    if (!confirm(`Delete ${s.name}?`)) return;
    await api(`/shelters/${id}`, { method: 'DELETE' });
    toast('Shelter deleted');
    await loadShelters();
  }
}));

onTab('shelters', safe(async () => {
  await initPickMap();
  await loadShelters();
}));
