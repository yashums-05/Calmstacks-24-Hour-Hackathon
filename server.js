const express = require('express');
const path    = require('path');
const crypto  = require('crypto');
const db      = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

const AUTH_USER   = 'yashu';
const AUTH_PASS   = 'Yashu@2005';
const AUTH_SECRET = process.env.AUTH_SECRET || 'hackathon_secret_yashu_2005_auth_token';

// ── Helpers ────────────────────────────────────────────────────────
function generateToken(user) {
  const ts = Date.now().toString();
  const data = `${user}:${ts}`;
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('hex');
  return `${user}.${ts}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [user, ts, sig] = parts;
  if (user !== AUTH_USER) return false;
  
  // 7 days expiration
  const tokenAge = Date.now() - parseInt(ts, 10);
  if (isNaN(tokenAge) || tokenAge < 0 || tokenAge > 7 * 24 * 60 * 60 * 1000) return false;

  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(`${user}:${ts}`).digest('hex');
  return sig === expectedSig;
}

function getCookie(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

function isAuthenticated(req) {
  const token = getCookie(req, 'auth_session') || req.headers['x-auth-token'];
  return verifyToken(token);
}

const host = req => `${req.protocol}://${req.get('host')}`;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Auth Public Endpoints ──────────────────────────────────────────
app.get('/login', (req, res) => {
  if (isAuthenticated(req)) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', (req, res) => {
  const { userid, username, password } = req.body || {};
  const user = (userid || username || '').trim();
  
  if (user === AUTH_USER && password === AUTH_PASS) {
    const token = generateToken(user);
    res.setHeader('Set-Cookie', `auth_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
    return res.json({ success: true, user: AUTH_USER, token });
  }
  return res.status(401).json({ error: 'Invalid user ID or password' });
});

app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'auth_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  return res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  if (isAuthenticated(req)) {
    return res.json({ authenticated: true, user: AUTH_USER });
  }
  return res.json({ authenticated: false });
});

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Authentication Guard Middleware ─────────────────────────────────
app.use((req, res, next) => {
  if (isAuthenticated(req)) {
    return next();
  }
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized. Please login.' });
  }
  res.redirect(`/login?redirect=${encodeURIComponent(req.originalUrl)}`);
});

// ── Protected Static Assets & Routes ───────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Event ──────────────────────────────────────────────────────────
app.get('/api/event', (req, res) => res.json(db.getEvent() || {}));
app.post('/api/event', (req, res) => {
  if (!req.body.name) return res.status(400).json({ error: 'Event name required' });
  res.json(db.saveEvent(req.body));
});

// ── Teams ──────────────────────────────────────────────────────────
app.get('/api/participants', (req, res) => {
  const list = db.getTeams(req.query.search);
  res.json({ participants: list, total: list.length });
});

app.post('/api/participants', (req, res) => {
  const { lead_name, email, team_name } = req.body;
  if (!lead_name || !email || !team_name)
    return res.status(400).json({ error: 'team_name, lead_name and email are required' });
  const { team, members } = db.addTeam(req.body);
  res.status(201).json({
    ...team,
    profile_url: `${host(req)}/p/${team.id}`,
    members: members.map(m => ({
      ...m,
      profile_url: `${host(req)}/m/${m.id}`,
    })),
  });
});

app.get('/api/participants/:id', (req, res) => {
  const team = db.getTeam(req.params.id);
  if (!team) return res.status(404).json({ error: 'Not found' });
  const members = db.getMembersForTeam(team.id).map(m => ({
    ...m,
    profile_url: `${host(req)}/m/${m.id}`,
  }));
  res.json({
    participant: { ...team, profile_url: `${host(req)}/p/${team.id}` },
    members,
    event: db.getEvent() || {},
  });
});

app.put('/api/participants/:id', (req, res) => {
  const t = db.updateTeam(req.params.id, req.body);
  if (!t) return res.status(404).json({ error: 'Not found' });
  res.json({ ...t, profile_url: `${host(req)}/p/${t.id}` });
});

app.delete('/api/participants/:id', (req, res) => {
  const r = db.deleteTeam(req.params.id);
  if (!r.deleted) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// ── Members ────────────────────────────────────────────────────────
app.get('/api/members', (req, res) => {
  const list = db.getAllMembers(req.query.search);
  res.json({ members: list, total: list.length });
});

app.get('/api/members/:id', (req, res) => {
  const result = db.getMember(req.params.id);
  if (!result) return res.status(404).json({ error: 'Member not found' });
  res.json({
    ...result,
    member: {
      ...result.member,
      profile_url: `${host(req)}/m/${result.member.id}`,
    },
    teammates: result.teammates.map(m => ({
      ...m,
      profile_url: `${host(req)}/m/${m.id}`,
    })),
  });
});

app.put('/api/members/:id', (req, res) => {
  const m = db.updateMember(req.params.id, req.body);
  if (!m) return res.status(404).json({ error: 'Not found' });
  res.json({ ...m, profile_url: `${host(req)}/m/${m.id}` });
});

app.post('/api/members', (req, res) => {
  const { team_id, name, usn, role } = req.body;
  if (!team_id || !name) return res.status(400).json({ error: 'team_id and name are required' });
  const team = db.getTeam(team_id);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const m = db.addMember({ team_id, name, usn: usn || '', role: role || 'Member', registered_at: new Date().toLocaleString('en-IN') });
  res.status(201).json({ ...m, profile_url: `${host(req)}/m/${m.id}` });
});

// ── Export ─────────────────────────────────────────────────────────
app.get('/api/export', (req, res) => {
  res.setHeader('Content-Disposition', `attachment; filename="hackathon-${Date.now()}.json"`);
  res.json(db.exportAll());
});

// ── Pages ──────────────────────────────────────────────────────────
app.get('/p/:id',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'profile.html')));
app.get('/m/:id',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'member.html')));
app.get('/admin',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n✦ Hackathon Participant ID System`);
    console.log(`  Dashboard  : http://localhost:${PORT}`);
    console.log(`  Admin      : http://localhost:${PORT}/admin`);
    console.log(`  Team URL   : http://localhost:${PORT}/p/:teamId`);
    console.log(`  Member URL : http://localhost:${PORT}/m/:memberId`);
    console.log(`  CSV files  : data/participants.csv + data/members.csv\n`);
  });
}

module.exports = app;
