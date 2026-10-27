// Emergency hotlines shown in the offline toolkit.
const hotlineForm = $('#hotline-form');
let hotlinesById = {};

async function loadHotlines() {
  const list = await api('/hotlines');
  hotlinesById = Object.fromEntries(list.map((h) => [h._id, h]));
  $('#hotline-rows').innerHTML = list.map((h) => `
    <tr>
      <td>${esc(h.name)}</td>
      <td><a href="tel:${esc(h.number)}">${esc(h.number)}</a></td>
      <td>${esc(h.category)}</td>
      <td>${h.order}</td>
      <td>
        <button class="small" data-act="edit" data-id="${h._id}">Edit</button>
        <button class="small secondary" data-act="delete" data-id="${h._id}">Delete</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="5"><small>No hotlines yet.</small></td></tr>';
}

function resetHotlineForm() {
  hotlineForm.reset();
  hotlineForm.id.value = '';
  $('#hotline-form-title').textContent = 'Add Hotline';
  $('#hotline-cancel').hidden = true;
}

hotlineForm.addEventListener('submit', safe(async (e) => {
  e.preventDefault();
  const f = hotlineForm;
  const body = { name: f.name.value, number: f.number.value, category: f.category.value, order: Number(f.order.value) || 0 };
  const id = f.id.value;
  await api(id ? `/hotlines/${id}` : '/hotlines', { method: id ? 'PUT' : 'POST', body });
  toast(id ? 'Hotline updated' : 'Hotline added');
  resetHotlineForm();
  await loadHotlines();
}));
$('#hotline-cancel').addEventListener('click', resetHotlineForm);

$('#hotline-rows').addEventListener('click', safe(async (e) => {
  const { act, id } = e.target.dataset;
  if (!act) return;
  const h = hotlinesById[id];
  if (act === 'edit') {
    for (const k of ['name', 'number', 'category', 'order']) hotlineForm[k].value = h[k];
    hotlineForm.id.value = id;
    $('#hotline-form-title').textContent = 'Edit Hotline';
    $('#hotline-cancel').hidden = false;
  } else if (act === 'delete') {
    if (!confirm(`Delete ${h.name}?`)) return;
    await api(`/hotlines/${id}`, { method: 'DELETE' });
    toast('Hotline deleted');
    await loadHotlines();
  }
}));

onTab('hotlines', safe(loadHotlines));
