const express = require('express');
const bodyParser = require('express').json;
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');
const { db, write } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_with_env_secret';

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser());
app.use(cookieParser());

function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '8h' });
}

function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// Auth routes
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });
  const user = (db.data.users || []).find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });
  const token = generateToken(user);
  res.cookie('token', token, { httpOnly: true });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

// Certificates
app.get('/api/certificates', authMiddleware, (req, res) => {
  const certs = db.data.certificates || [];
  const users = db.data.users || [];
  if (req.user.role === 'STUDENT') {
    return res.json(certs.filter(c => c.user_id === req.user.id));
  }
  const joined = certs.map(c => Object.assign({}, c, { owner: (users.find(u => u.id === c.user_id) || {}).name }));
  res.json(joined);
});

app.post('/api/certificates', authMiddleware, requireRole('ADMIN'), (req, res) => {
  const { user_id, title, description } = req.body;
  if (!user_id || !title) return res.status(400).json({ error: 'Missing fields' });
  const id = (db.data._id.certificates = (db.data._id.certificates || 0) + 1);
  const cert = { id, user_id, title, description: description || '', present_in_office: 1, status: 'present', created_at: new Date().toISOString() };
  db.data.certificates.push(cert);
  write();
  res.json({ id });
});

app.put('/api/certificates/:id/present', authMiddleware, requireRole('ADMIN'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { present } = req.body;
  const cert = (db.data.certificates || []).find(c => c.id === id);
  if (!cert) return res.status(404).json({ error: 'Not found' });
  cert.present_in_office = present ? 1 : 0;
  cert.status = present ? 'present' : 'issued';
  write();
  res.json({ ok: true });
});

app.post('/api/certificates/:id/issue', authMiddleware, requireRole('ADMIN'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const userId = req.user.id;
  const now = new Date().toISOString();
  const cert = (db.data.certificates || []).find(c => c.id === id);
  if (!cert) return res.status(404).json({ error: 'Not found' });
  cert.status = 'issued';
  cert.issue_date = now;
  const logId = (db.data._id.logs = (db.data._id.logs || 0) + 1);
  const log = { id: logId, certificate_id: id, action: 'issue', by_user_id: userId, timestamp: now, notes: req.body.notes || 'Issued by admin' };
  db.data.logs.push(log);
  write();
  res.json({ ok: true, issued_at: now });
});

app.post('/api/certificates/:id/return', authMiddleware, requireRole('ADMIN'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const userId = req.user.id;
  const now = new Date().toISOString();
  const cert = (db.data.certificates || []).find(c => c.id === id);
  if (!cert) return res.status(404).json({ error: 'Not found' });
  cert.status = 'returned';
  cert.return_date = now;
  const logId = (db.data._id.logs = (db.data._id.logs || 0) + 1);
  const log = { id: logId, certificate_id: id, action: 'return', by_user_id: userId, timestamp: now, notes: req.body.notes || 'Returned to office' };
  db.data.logs.push(log);
  write();
  res.json({ ok: true, returned_at: now });
});

// Requests
app.post('/api/requests', authMiddleware, requireRole('STUDENT'), (req, res) => {
  const { certificate_id, purpose } = req.body;
  if (!certificate_id) return res.status(400).json({ error: 'Missing certificate_id' });
  const id = (db.data._id.requests = (db.data._id.requests || 0) + 1);
  const r = { id, user_id: req.user.id, certificate_id, purpose: purpose || '', status: 'pending', created_at: new Date().toISOString() };
  db.data.requests.push(r);
  write();
  res.json({ id });
});

app.get('/api/requests', authMiddleware, (req, res) => {
  const requests = db.data.requests || [];
  const certificates = db.data.certificates || [];
  const users = db.data.users || [];
  if (req.user.role === 'STUDENT') {
    const rows = requests.filter(r => r.user_id === req.user.id).map(r => Object.assign({}, r, { title: (certificates.find(c => c.id === r.certificate_id) || {}).title }));
    return res.json(rows);
  }
  const rows = requests.map(r => Object.assign({}, r, { requester: (users.find(u => u.id === r.user_id) || {}).name, title: (certificates.find(c => c.id === r.certificate_id) || {}).title }));
  res.json(rows);
});

app.post('/api/requests/:id/decision', authMiddleware, requireRole('ADMIN'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { decision } = req.body; // 'approved' or 'rejected'
  if (!['approved','rejected'].includes(decision)) return res.status(400).json({ error: 'Invalid decision' });
  const now = new Date().toISOString();
  const reqs = db.data.requests || [];
  const r = reqs.find(x => x.id === id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  r.status = decision;
  r.decided_by = req.user.id;
  r.decided_at = now;
  write();
  res.json({ ok: true });
});

// Logs (management + admin)
app.get('/api/logs', authMiddleware, requireRole('ADMIN','MANAGEMENT'), (req, res) => {
  const logs = db.data.logs || [];
  const users = db.data.users || [];
  const certificates = db.data.certificates || [];
  const rows = logs.map(l => Object.assign({}, l, { by: (users.find(u => u.id === l.by_user_id) || {}).name, title: (certificates.find(c => c.id === l.certificate_id) || {}).title })).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(rows);
});

// Start
(async () => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
})();
