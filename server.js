const express = require('express');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const db      = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

const AUTH_USER   = 'yashu';
const AUTH_PASS   = 'Yashu@2005';
const AUTH_SECRET = process.env.AUTH_SECRET || 'hackathon_secret_yashu_2005_auth_token';

const PUBLIC_DIR = fs.existsSync(path.join(__dirname, 'public'))
  ? path.join(__dirname, 'public')
  : path.join(process.cwd(), 'public');

// ── Helpers ────────────────────────────────────────────────────────
const normalize = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

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

function requireAdmin(req, res, next) {
  if (isAuthenticated(req)) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Admin authorization required. Please login.' });
  }
  return res.redirect(`/login?redirect=${encodeURIComponent(req.originalUrl)}`);
}

const host = req => `${req.protocol}://${req.get('host')}`;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

// ── Auth Endpoints ─────────────────────────────────────────────────
app.get('/login', (req, res) => {
  const redirect = req.query.redirect;
  if (redirect && (redirect.startsWith('/m/') || redirect.startsWith('/p/') || redirect.startsWith('/participants/'))) {
    return res.redirect(redirect);
  }
  if (isAuthenticated(req)) return res.redirect('/admin');
  res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
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

// ── Participant Member Specific Unlock & View ──────────────────────
// Password verification: user must submit their registered name as password
app.post('/api/members/:id/unlock', (req, res) => {
  const result = db.getMember(req.params.id);
  if (!result || !result.member) return res.status(404).json({ error: 'Participant not found' });

  const input = normalize(req.body.name || req.body.password);
  const expected = normalize(result.member.name);

  if (isAuthenticated(req) || (input && input === expected)) {
    return res.json({
      success: true,
      member: {
        ...result.member,
        profile_url: `${host(req)}/participants/${result.member.id}`,
      },
      team: result.team,
      teammates: result.teammates.map(m => ({
        ...m,
        profile_url: `${host(req)}/participants/${m.id}`,
      })),
      event: result.event || {},
    });
  }
  return res.status(401).json({ error: 'Incorrect password. Please enter the full name as registered.' });
});

app.get('/api/members/:id', (req, res) => {
  const result = db.getMember(req.params.id);
  if (!result || !result.member) return res.status(404).json({ error: 'Member not found' });
  
  if (isAuthenticated(req)) {
    return res.json({
      ...result,
      member: {
        ...result.member,
        profile_url: `${host(req)}/participants/${result.member.id}`,
      },
      teammates: result.teammates.map(m => ({
        ...m,
        profile_url: `${host(req)}/participants/${m.id}`,
      })),
    });
  }
  // Public without auth returns locked state (zero private data leaked)
  return res.json({ locked: true, id: result.member.id });
});

// ── Team Specific Unlock & View ────────────────────────────────────
app.post('/api/participants/:id/unlock', (req, res) => {
  const team = db.getTeam(req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const members = db.getMembersForTeam(team.id);

  const input = normalize(req.body.name || req.body.password);
  const allowedNames = [
    team.lead_name,
    team.member2,
    team.member3,
    team.member4,
    ...members.map(m => m.name)
  ].map(normalize).filter(Boolean);

  if (isAuthenticated(req) || (input && allowedNames.includes(input))) {
    return res.json({
      success: true,
      participant: { ...team, profile_url: `${host(req)}/participants/${team.id}` },
      members: members.map(m => ({
        ...m,
        profile_url: `${host(req)}/participants/${m.id}`,
      })),
      event: db.getEvent() || {},
    });
  }
  return res.status(401).json({ error: 'Incorrect password. Please enter the team lead or member name.' });
});

app.get('/api/participants/:id', (req, res) => {
  const team = db.getTeam(req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  if (isAuthenticated(req)) {
    const members = db.getMembersForTeam(team.id).map(m => ({
      ...m,
      profile_url: `${host(req)}/participants/${m.id}`,
    }));
    return res.json({
      participant: { ...team, profile_url: `${host(req)}/participants/${team.id}` },
      members,
      event: db.getEvent() || {},
    });
  }
  return res.json({ locked: true, id: team.id });
});

// ── Admin-Only Directory & Management APIs (No Public Access) ──────
// Only Admin can view all teams and all members
app.get('/api/participants', requireAdmin, (req, res) => {
  const list = db.getTeams(req.query.search);
  res.json({ participants: list, total: list.length });
});

app.get('/api/members', requireAdmin, (req, res) => {
  const list = db.getAllMembers(req.query.search);
  res.json({ members: list, total: list.length });
});

app.get('/api/event', (req, res) => res.json(db.getEvent() || {}));
app.post('/api/event', requireAdmin, (req, res) => {
  if (!req.body.name) return res.status(400).json({ error: 'Event name required' });
  res.json(db.saveEvent(req.body));
});

app.post('/api/participants', requireAdmin, (req, res) => {
  const { lead_name, email, team_name } = req.body;
  if (!lead_name || !email || !team_name)
    return res.status(400).json({ error: 'team_name, lead_name and email are required' });
  const { team, members } = db.addTeam(req.body);
  res.status(201).json({
    ...team,
    profile_url: `${host(req)}/participants/${team.id}`,
    members: members.map(m => ({
      ...m,
      profile_url: `${host(req)}/participants/${m.id}`,
    })),
  });
});

app.put('/api/participants/:id', requireAdmin, (req, res) => {
  const t = db.updateTeam(req.params.id, req.body);
  if (!t) return res.status(404).json({ error: 'Not found' });
  res.json({ ...t, profile_url: `${host(req)}/participants/${t.id}` });
});

app.delete('/api/participants/:id', requireAdmin, (req, res) => {
  const r = db.deleteTeam(req.params.id);
  if (!r.deleted) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

app.put('/api/members/:id', requireAdmin, (req, res) => {
  const m = db.updateMember(req.params.id, req.body);
  if (!m) return res.status(404).json({ error: 'Not found' });
  res.json({ ...m, profile_url: `${host(req)}/participants/${m.id}` });
});

app.post('/api/members', requireAdmin, (req, res) => {
  const { team_id, name, usn, role } = req.body;
  if (!team_id || !name) return res.status(400).json({ error: 'team_id and name are required' });
  const team = db.getTeam(team_id);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const m = db.addMember({ team_id, name, usn: usn || '', role: role || 'Member', registered_at: new Date().toLocaleString('en-IN') });
  res.status(201).json({ ...m, profile_url: `${host(req)}/participants/${m.id}` });
});

app.get('/api/export', requireAdmin, (req, res) => {
  res.setHeader('Content-Disposition', `attachment; filename="hackathon-${Date.now()}.json"`);
  res.json(db.exportAll());
});

// ── Pages & Direct Public Views ────────────────────────────────────
// Individual member / team profiles (Protected with participant's name as password)
app.get('/participants/:id', (req, res) => {
  const id = req.params.id || '';
  if (id.includes('-M') || db.getMember(id)) {
    return res.sendFile(path.join(PUBLIC_DIR, 'member.html'));
  }
  return res.sendFile(path.join(PUBLIC_DIR, 'profile.html'));
});

app.get('/m/:id', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'member.html')));
app.get('/p/:id', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'profile.html')));

// Admin Panel (Protected with yashu / Yashu@2005)
app.get('/admin', requireAdmin, (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));

// Public Portal Home Page & Participant Lookup
app.get('/participants', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// Fallback
app.use((req, res) => res.redirect('/'));

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n✦ Hackathon Participant ID System (Admin Protected Directory)`);
    console.log(`  Admin Panel  : http://localhost:${PORT}/admin`);
    console.log(`  Participant  : http://localhost:${PORT}/participants/:id`);
  });
}

module.exports = app;
