// Emergency action guides (before / during / after each disaster type).
const actionForm = $('#action-form');
let actionsById = {};

alertMeta.then(({ disasterTypes }) => {
  const opts = disasterTypes.map((v) => `<option value="${v}">${label(v)}</option>`).join('');
  actionForm.disasterType.innerHTML = opts;
  $('#action-filter').innerHTML = '<option value="">All disaster types</option>' + opts;
});

async function loadActions() {
  const type = $('#action-filter').value;
  const list = await api(`/emergency-actions${type ? `?disasterType=${type}` : ''}`);
  actionsById = Object.fromEntries(list.map((a) => [a._id, a]));
  $('#action-list').innerHTML = list.map((a) => `
    <div class="action-card phase-${a.phase}">
      <div class="action-head">
        <span class="badge">${label(a.disasterType)}</span> <span class="badge phase">${a.phase}</span>
      </div>
      <h3>${esc(a.title)}</h3>
      <ol>${a.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <div class="actions">
        <button class="small" data-act="alert" data-id="${a._id}">Use in alert</button>
        <button class="small secondary" data-act="edit" data-id="${a._id}">Edit</button>
        <button class="small secondary" data-act="delete" data-id="${a._id}">Delete</button>
      </div>
    </div>`).join('') || '<small>No guides yet.</small>';
}

function resetActionForm() {
  actionForm.reset();
  actionForm.id.value = '';
  $('#action-form-title').textContent = 'Add Emergency Action Guide';
  $('#action-cancel').hidden = true;
}

actionForm.addEventListener('submit', safe(async (e) => {
  e.preventDefault();
  const f = actionForm;
  const body = {
    disasterType: f.disasterType.value,
    phase: f.phase.value,
    order: Number(f.order.value) || 0,
    title: f.title.value,
    steps: f.steps.value.split('\n').map((s) => s.trim()).filter(Boolean),
  };
  const id = f.id.value;
  await api(id ? `/emergency-actions/${id}` : '/emergency-actions', { method: id ? 'PUT' : 'POST', body });
  toast(id ? 'Guide updated' : 'Guide added');
  resetActionForm();
  await loadActions();
}));
$('#action-cancel').addEventListener('click', resetActionForm);
$('#action-filter').addEventListener('change', safe(loadActions));

$('#action-list').addEventListener('click', safe(async (e) => {
  const { act, id } = e.target.dataset;
  if (!act) return;
  const a = actionsById[id];
  if (act === 'alert') {
    prefillAlert({
      title: a.title,
      disasterType: a.disasterType,
      severity: a.phase === 'during' ? 'warning' : 'advisory',
      message: a.steps.map((s, i) => `${i + 1}) ${s}`).join(' '),
    });
  } else if (act === 'edit') {
    const f = actionForm;
    f.id.value = id;
    f.disasterType.value = a.disasterType;
    f.phase.value = a.phase;
    f.order.value = a.order;
    f.title.value = a.title;
    f.steps.value = a.steps.join('\n');
    $('#action-form-title').textContent = 'Edit Emergency Action Guide';
    $('#action-cancel').hidden = false;
    f.scrollIntoView({ behavior: 'smooth' });
  } else if (act === 'delete') {
    if (!confirm(`Delete "${a.title}"?`)) return;
    await api(`/emergency-actions/${id}`, { method: 'DELETE' });
    toast('Guide deleted');
    await loadActions();
  }
}));

onTab('actions', safe(loadActions));
