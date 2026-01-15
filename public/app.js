async function api(path, opts = {}) {
  const res = await fetch('/api' + path, Object.assign({ credentials: 'include', headers: { 'Content-Type': 'application/json' } }, opts));
  if (res.status === 401) throw new Error('unauthorized');
  return res.json();
}

const loginForm = document.getElementById('loginForm');
const loginAlert = document.getElementById('loginAlert');
const loginCard = document.getElementById('loginCard');
const appDiv = document.getElementById('app');
const welcome = document.getElementById('welcome');
const roleViews = document.getElementById('roleViews');
const logoutBtn = document.getElementById('logoutBtn');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginAlert.innerHTML = '';
  try {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const data = await api('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    showApp(data);
  } catch (err) {
    loginAlert.innerHTML = `<div class="alert alert-danger">Login failed</div>`;
  }
});

logoutBtn.addEventListener('click', async () => {
  await api('/logout', { method: 'POST' });
  window.location.reload();
});

async function showApp(user) {
  loginCard.style.display = 'none';
  appDiv.style.display = 'block';
  welcome.innerText = `Welcome, ${user.name} (${user.role})`;
  roleViews.innerHTML = '';
  if (user.role === 'STUDENT') {
    renderStudentView();
  } else if (user.role === 'ADMIN') {
    renderAdminView();
  } else if (user.role === 'MANAGEMENT') {
    renderManagementView();
  }
}

async function renderStudentView() {
  const certs = await api('/certificates');
  const reqs = await api('/requests');
  roleViews.innerHTML = `
    <div class="card mb-3"><div class="card-body"><h5>Your Certificates</h5><div id="certList"></div></div></div>
    <div class="card"><div class="card-body"><h5>Requests</h5><div id="reqList"></div><hr><form id="reqForm"><div class="mb-3"><label>Certificate ID</label><input class="form-control" id="reqCertId"></div><div class="mb-3"><label>Purpose</label><input class="form-control" id="reqPurpose"></div><button class="btn btn-primary">Request</button></form></div></div>
  `;
  const certList = document.getElementById('certList');
  certList.innerHTML = certs.map(c => `<div class="d-flex justify-content-between py-2 border-bottom"><div><strong>${c.title}</strong><div class="small text-muted">${c.description||''}</div></div><div class="text-end"><div class="${statusClass(c.status)}">${c.status}</div><div class="small text-muted">${c.issue_date||''}</div></div></div>`).join('');
  const reqList = document.getElementById('reqList');
  reqList.innerHTML = reqs.map(r => `<div class="py-2 border-bottom"><div><strong>${r.title}</strong> — <span class="text-muted small">${r.status}</span></div><div class="small text-muted">Requested at: ${r.created_at}</div></div>`).join('');
  document.getElementById('reqForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const certificate_id = document.getElementById('reqCertId').value;
    const purpose = document.getElementById('reqPurpose').value;
    await api('/requests', { method: 'POST', body: JSON.stringify({ certificate_id, purpose }) });
    alert('Request submitted');
    renderStudentView();
  });
}

async function renderAdminView() {
  const certs = await api('/certificates');
  const reqs = await api('/requests');
  const logs = await api('/logs');
  roleViews.innerHTML = `
    <div class="card mb-3"><div class="card-body"><h5>Certificates</h5><div id="certAdminList"></div></div></div>
    <div class="card mb-3"><div class="card-body"><h5>Requests</h5><div id="reqAdminList"></div></div></div>
    <div class="card"><div class="card-body"><h5>Activity Logs</h5><div id="logList"></div></div></div>
  `;
  document.getElementById('certAdminList').innerHTML = certs.map(c => `<div class="d-flex justify-content-between py-2 border-bottom"><div><strong>${c.title}</strong><div class="small text-muted">Owner: ${c.owner}</div></div><div class="text-end"><div class="${statusClass(c.status)}">${c.status}</div><div class="mt-2"><button class="btn btn-sm btn-success me-1" data-action="issue" data-id="${c.id}">Issue</button><button class="btn btn-sm btn-secondary" data-action="return" data-id="${c.id}">Mark Return</button></div></div></div>`).join('');
  document.querySelectorAll('[data-action="issue"]').forEach(btn => btn.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    await api(`/certificates/${id}/issue`, { method: 'POST', body: JSON.stringify({}) });
    alert('Issued'); renderAdminView();
  }));
  document.querySelectorAll('[data-action="return"]').forEach(btn => btn.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    await api(`/certificates/${id}/return`, { method: 'POST', body: JSON.stringify({}) });
    alert('Marked returned'); renderAdminView();
  }));

  document.getElementById('reqAdminList').innerHTML = reqs.map(r => `<div class="d-flex justify-content-between py-2 border-bottom"><div><strong>${r.title}</strong><div class="small text-muted">${r.requester} — ${r.purpose||''}</div></div><div><span class="badge bg-${r.status==='pending'?'warning':'success'}">${r.status}</span><div class="mt-2"><button class="btn btn-sm btn-primary me-1" data-approve="${r.id}">Approve</button><button class="btn btn-sm btn-danger" data-reject="${r.id}">Reject</button></div></div></div>`).join('');
  document.querySelectorAll('[data-approve]').forEach(b=>b.addEventListener('click', async e=>{await api(`/requests/${e.target.dataset.approve}/decision`,{method:'POST',body:JSON.stringify({decision:'approved'})});alert('Approved');renderAdminView();}));
  document.querySelectorAll('[data-reject]').forEach(b=>b.addEventListener('click', async e=>{await api(`/requests/${e.target.dataset.reject}/decision`,{method:'POST',body:JSON.stringify({decision:'rejected'})});alert('Rejected');renderAdminView();}));

  document.getElementById('logList').innerHTML = logs.map(l=>`<div class="py-2 border-bottom"><div><strong>${l.action.toUpperCase()}</strong> — ${l.title}</div><div class="small text-muted">By ${l.by} at ${l.timestamp}</div></div>`).join('');
}

async function renderManagementView() {
  const certs = await api('/certificates');
  const reqs = await api('/requests');
  const logs = await api('/logs');
  roleViews.innerHTML = `
    <div class="card mb-3"><div class="card-body"><h5>All Certificates</h5><div id="mgCertList"></div></div></div>
    <div class="card mb-3"><div class="card-body"><h5>All Requests</h5><div id="mgReqList"></div></div></div>
    <div class="card"><div class="card-body"><h5>Activity Logs</h5><div id="mgLogList"></div></div></div>
  `;
  document.getElementById('mgCertList').innerHTML = certs.map(c=>`<div class="py-2 border-bottom"><div><strong>${c.title}</strong> — <span class="small text-muted">Owner: ${c.owner}</span></div><div class="${statusClass(c.status)}">${c.status}</div></div>`).join('');
  document.getElementById('mgReqList').innerHTML = reqs.map(r=>`<div class="py-2 border-bottom"><div><strong>${r.title}</strong> — <span class="small text-muted">${r.status}</span></div></div>`).join('');
  document.getElementById('mgLogList').innerHTML = logs.map(l=>`<div class="py-2 border-bottom"><div><strong>${l.action.toUpperCase()}</strong> — ${l.title}</div><div class="small text-muted">By ${l.by} at ${l.timestamp}</div></div>`).join('');
}

function statusClass(s) {
  return s === 'present' ? 'status-present' : s === 'issued' ? 'status-issued' : 'status-returned';
}

(async function tryAutoLogin(){
  try {
    const me = await api('/me');
    showApp(me);
  } catch(e) {
    // not logged in
  }
})();
