/**
 * db.js — 100% File-Based Persistent Data Store & Multi-Admin Management
 * 
 * Stores all data in:
 *   - data/store.json
 *   - data/participants.csv
 *   - data/members.csv
 *   - dataset.js
 */

const fs   = require('node:fs');
const path = require('node:path');
const os   = require('node:os');

let defaultData = { teams: [], members: [], event: null };
try { defaultData = require('./dataset'); } catch (e) {}

const BASE_DIR    = __dirname;
const DATA_DIR    = path.join(BASE_DIR, 'data');
const TEAMS_CSV   = path.join(DATA_DIR, 'participants.csv');
const MEMBERS_CSV = path.join(DATA_DIR, 'members.csv');
const STORE_JSON  = path.join(DATA_DIR, 'store.json');
const DATASET_JS  = path.join(BASE_DIR, 'dataset.js');

try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}

const TMP_DATA_DIR    = path.join(os.tmpdir(), 'calmstacks_data');
try { if (!fs.existsSync(TMP_DATA_DIR)) fs.mkdirSync(TMP_DATA_DIR, { recursive: true }); } catch (e) {}
const TMP_STORE_JSON  = path.join(TMP_DATA_DIR, 'store.json');
const TMP_TEAMS_CSV   = path.join(TMP_DATA_DIR, 'participants.csv');
const TMP_MEMBERS_CSV = path.join(TMP_DATA_DIR, 'members.csv');

// ── Default Primary Super Admin ────────────────────────────────────
const PRIMARY_ADMIN = {
  userid:     'yashu',
  password:   'Yashu@2005',
  name:       'Yashwanth M S',
  role:       'Super Admin',
  created_at: 'Primary Admin'
};

// ── CSV helpers ────────────────────────────────────────────────────
function parseLine(line) {
  const fields = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) { fields.push(cur); cur = ''; }
    else cur += c;
  }
  fields.push(cur);
  return fields;
}

const quoteField = v => {
  const s = String(v ?? '');
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g, '""') + '"' : s;
};

const TEAM_COLS = [
  'id', 'registered_at', 'team_name', 'team_size',
  'lead_name', 'usn', 'email', 'phone', 'year',
  'member2', 'usn2', 'member3', 'usn3', 'member4', 'usn4',
  'payment_status', 'amount', 'utr',
];

const MEMBER_COLS = [
  'id', 'team_id', 'role', 'name', 'usn', 'email', 'phone', 'registered_at'
];

function readCSVFile(filePath, cols) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
      .replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = raw.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const header = parseLine(lines[0]);
    return lines.slice(1).map(line => {
      const f = parseLine(line);
      const obj = {};
      header.forEach((col, i) => obj[col] = f[i] ?? '');
      return obj;
    });
  } catch (e) {
    return [];
  }
}

function writeCSVFile(filePath, cols, rows, tmpFilePath) {
  const header = cols.join(',');
  const body   = rows.map(r => cols.map(c => quoteField(r[c] ?? '')).join(','));
  const payload = [header, ...body].join('\n');
  try { fs.writeFileSync(filePath, payload, 'utf8'); } catch (e) {}
  if (tmpFilePath) {
    try { fs.writeFileSync(tmpFilePath, payload, 'utf8'); } catch (e) {}
  }
}

function formatTeamId(num) {
  return `HACK-${String(num).padStart(3, '0')}`;
}

function nextTeamId(teams) {
  let max = 0;
  for (const t of teams) {
    const match = (t.id || '').match(/^HACK-(\d+)/i);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return formatTeamId(max + 1);
}

function membersFromTeam(team) {
  const members = [];
  let mIdx = 1;
  members.push({
    id:            `${team.id}-M${mIdx++}`,
    team_id:       team.id,
    role:          'Team Lead',
    name:          team.lead_name || '',
    usn:           team.usn || '',
    email:         team.email || '',
    phone:         team.phone || '',
    registered_at: team.registered_at || '',
  });
  if (team.member2?.trim()) members.push({
    id: `${team.id}-M${mIdx++}`, team_id: team.id, role: 'Member 2',
    name: team.member2, usn: team.usn2 || '',
    email: '', phone: '', registered_at: team.registered_at || '',
  });
  if (team.member3?.trim()) members.push({
    id: `${team.id}-M${mIdx++}`, team_id: team.id, role: 'Member 3',
    name: team.member3, usn: team.usn3 || '',
    email: '', phone: '', registered_at: team.registered_at || '',
  });
  if (team.member4?.trim()) members.push({
    id: `${team.id}-M${mIdx++}`, team_id: team.id, role: 'Member 4',
    name: team.member4, usn: team.usn4 || '',
    email: '', phone: '', registered_at: team.registered_at || '',
  });
  return members;
}

// ── In-Memory Store & State ─────────────────────────────────────────
let inMemoryTeams   = [];
let inMemoryMembers = [];
let inMemoryAdmins  = [PRIMARY_ADMIN];
let inMemoryEvent   = defaultData.event || null;

function initLocalStore() {
  // 1. Try local data/store.json
  if (fs.existsSync(STORE_JSON)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(STORE_JSON, 'utf8'));
      if (parsed.teams?.length) {
        inMemoryTeams   = parsed.teams;
        inMemoryMembers = parsed.members || inMemoryTeams.flatMap(membersFromTeam);
        inMemoryEvent   = parsed.event   || inMemoryEvent;
        if (parsed.admins && Array.isArray(parsed.admins)) {
          const hasPrimary = parsed.admins.some(a => a.userid === PRIMARY_ADMIN.userid);
          inMemoryAdmins = hasPrimary ? parsed.admins : [PRIMARY_ADMIN, ...parsed.admins];
        }
        return;
      }
    } catch (e) {}
  }

  // 2. Try temp store
  if (fs.existsSync(TMP_STORE_JSON)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(TMP_STORE_JSON, 'utf8'));
      if (parsed.teams?.length) {
        inMemoryTeams   = parsed.teams;
        inMemoryMembers = parsed.members || inMemoryTeams.flatMap(membersFromTeam);
        inMemoryEvent   = parsed.event   || inMemoryEvent;
        if (parsed.admins && Array.isArray(parsed.admins)) {
          const hasPrimary = parsed.admins.some(a => a.userid === PRIMARY_ADMIN.userid);
          inMemoryAdmins = hasPrimary ? parsed.admins : [PRIMARY_ADMIN, ...parsed.admins];
        }
        return;
      }
    } catch (e) {}
  }

  // 3. Try CSV files
  let teams = readCSVFile(TEAMS_CSV, TEAM_COLS);
  let members = readCSVFile(MEMBERS_CSV, MEMBER_COLS);
  if (!teams.length) teams = readCSVFile(TMP_TEAMS_CSV, TEAM_COLS);
  if (!members.length) members = readCSVFile(TMP_MEMBERS_CSV, MEMBER_COLS);

  // 4. Try dataset.js
  if (!teams.length && defaultData.teams?.length) teams = [...defaultData.teams];
  if (!members.length && defaultData.members?.length) members = [...defaultData.members];

  inMemoryTeams   = teams;
  inMemoryMembers = members.length ? members : teams.flatMap(membersFromTeam);
}

initLocalStore();

function persistToFile() {
  const data = {
    teams: inMemoryTeams,
    members: inMemoryMembers,
    admins: inMemoryAdmins,
    event: inMemoryEvent,
    updated_at: new Date().toISOString()
  };

  const jsonStr = JSON.stringify(data, null, 2);

  // Write to data/store.json
  try { fs.writeFileSync(STORE_JSON, jsonStr, 'utf8'); } catch (e) {}
  // Write to /tmp/calmstacks_data/store.json
  try { fs.writeFileSync(TMP_STORE_JSON, jsonStr, 'utf8'); } catch (e) {}

  // Write to CSV files
  writeCSVFile(TEAMS_CSV, TEAM_COLS, inMemoryTeams, TMP_TEAMS_CSV);
  writeCSVFile(MEMBERS_CSV, MEMBER_COLS, inMemoryMembers, TMP_MEMBERS_CSV);

  // Write to dataset.js
  try {
    const datasetContent = 'module.exports = ' + jsonStr + ';\n';
    fs.writeFileSync(DATASET_JS, datasetContent, 'utf8');
  } catch (e) {}

  return true;
}

// ── Exported API ───────────────────────────────────────────────────
module.exports = {

  sync() {
    return Promise.resolve(true);
  },

  getSyncStatus() {
    return Promise.resolve({
      configured: true,
      status: 'connected',
      message: 'Local File Storage Active (data/store.json & dataset.js)',
      file: 'data/store.json'
    });
  },

  // ── Admins ──────────────────────────────────────────────────────
  getAdmins() {
    return inMemoryAdmins.map(a => ({
      userid:     a.userid,
      name:       a.name || a.userid,
      role:       a.role || 'Admin',
      created_at: a.created_at || 'Active'
    }));
  },

  verifyAdmin(userid, password) {
    const u = String(userid || '').trim();
    const p = String(password || '');
    if (u === PRIMARY_ADMIN.userid && p === PRIMARY_ADMIN.password) {
      return PRIMARY_ADMIN;
    }
    const found = inMemoryAdmins.find(a => a.userid === u && a.password === p);
    return found || null;
  },

  async addAdmin({ userid, password, name, role }) {
    const cleanUser = String(userid || '').trim();
    if (!cleanUser || !password) return { error: 'User ID and password required' };
    if (inMemoryAdmins.some(a => a.userid.toLowerCase() === cleanUser.toLowerCase())) {
      return { error: 'Admin with this User ID already exists' };
    }
    const newAdmin = {
      userid:     cleanUser,
      password:   String(password),
      name:       name || cleanUser,
      role:       role || 'Admin',
      created_at: new Date().toLocaleDateString('en-IN')
    };
    inMemoryAdmins.push(newAdmin);
    persistToFile();
    return { success: true, admin: { userid: newAdmin.userid, name: newAdmin.name, role: newAdmin.role } };
  },

  async deleteAdmin(userid) {
    const cleanUser = String(userid || '').trim().toLowerCase();
    if (cleanUser === PRIMARY_ADMIN.userid.toLowerCase()) {
      return { error: 'Cannot remove primary super admin' };
    }
    const before = inMemoryAdmins.length;
    inMemoryAdmins = inMemoryAdmins.filter(a => a.userid.toLowerCase() !== cleanUser);
    if (inMemoryAdmins.length === before) return { error: 'Admin not found' };
    persistToFile();
    return { success: true };
  },

  // ── Event ───────────────────────────────────────────────────────
  getEvent() {
    return inMemoryEvent;
  },

  async saveEvent(data) {
    const ev = { ...data, updated_at: new Date().toISOString() };
    inMemoryEvent = ev;
    persistToFile();
    return ev;
  },

  // ── Teams ────────────────────────────────────────────────────────
  getTeams(search) {
    const rows = inMemoryTeams;
    if (!search?.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter(r =>
      [r.id, r.team_name, r.lead_name, r.usn, r.email, r.phone,
       r.member2, r.usn2, r.member3, r.usn3, r.member4, r.usn4,
       r.payment_status, r.utr]
        .some(v => v && v.toLowerCase().includes(q))
    );
  },

  getTeam(id) {
    if (!id) return null;
    const cleanId = String(id).trim().toLowerCase();
    return inMemoryTeams.find(r => r.id && r.id.toLowerCase() === cleanId) || null;
  },

  async addTeam(data) {
    const hackId = nextTeamId(inMemoryTeams);
    const team = {
      id:             hackId,
      registered_at:  data.registered_at || new Date().toLocaleString('en-IN'),
      team_name:      data.team_name     || '',
      team_size:      data.team_size     || '',
      lead_name:      data.lead_name     || '',
      usn:            data.usn           || '',
      email:          data.email         || '',
      phone:          data.phone         || '',
      year:           data.year          || '',
      member2:        data.member2       || '',
      usn2:           data.usn2          || '',
      member3:        data.member3       || '',
      usn3:           data.usn3          || '',
      member4:        data.member4       || '',
      usn4:           data.usn4          || '',
      payment_status: data.payment_status|| 'PENDING',
      amount:         data.amount        || '',
      utr:            data.utr           || '',
    };

    inMemoryTeams.unshift(team);
    const newMembers = membersFromTeam(team);
    inMemoryMembers.push(...newMembers);

    persistToFile();
    return { team, members: newMembers };
  },

  async updateTeam(id, data) {
    const targetId = String(id).trim().toLowerCase();
    const idx = inMemoryTeams.findIndex(r => r.id && r.id.toLowerCase() === targetId);
    if (idx === -1) return null;
    const old = inMemoryTeams[idx];
    const teams_updated = { ...old, ...data, id: old.id };
    inMemoryTeams[idx] = teams_updated;

    // Re-sync member rows for this team
    const otherMembers = inMemoryMembers.filter(m => m.team_id.toLowerCase() !== old.id.toLowerCase());
    const newMembers   = membersFromTeam(inMemoryTeams[idx]);
    inMemoryMembers = [...otherMembers, ...newMembers];

    persistToFile();
    return inMemoryTeams[idx];
  },

  async deleteTeam(id) {
    const targetId = String(id).trim().toLowerCase();
    const after = inMemoryTeams.filter(r => r.id && r.id.toLowerCase() !== targetId);
    if (after.length === inMemoryTeams.length) return { deleted: 0 };
    inMemoryTeams = after;
    inMemoryMembers = inMemoryMembers.filter(m => m.team_id.toLowerCase() !== targetId);

    persistToFile();
    return { deleted: 1 };
  },

  // ── Members ──────────────────────────────────────────────────────
  getMembersForTeam(teamId) {
    if (!teamId) return [];
    const tId = String(teamId).trim().toLowerCase();
    return inMemoryMembers.filter(m => m.team_id && m.team_id.toLowerCase() === tId);
  },

  getAllMembers(search) {
    const rows = inMemoryMembers;
    if (!search?.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter(m =>
      [m.id, m.name, m.usn, m.email, m.role, m.team_id]
        .some(v => v && v.toLowerCase().includes(q))
    );
  },

  getMember(id) {
    if (!id) return null;
    const cleanId = String(id).trim().toLowerCase();
    const member = inMemoryMembers.find(m => m.id && m.id.toLowerCase() === cleanId) || null;
    if (!member) return null;
    const team  = inMemoryTeams.find(t => t.id && t.id.toLowerCase() === member.team_id.toLowerCase()) || null;
    const event = inMemoryEvent || {};
    const teammates = inMemoryMembers.filter(m => m.team_id && m.team_id.toLowerCase() === member.team_id.toLowerCase());
    return { member, team, teammates, event };
  },

  async updateMember(id, data) {
    const cleanId = String(id).trim().toLowerCase();
    const idx = inMemoryMembers.findIndex(m => m.id && m.id.toLowerCase() === cleanId);
    if (idx === -1) return null;
    inMemoryMembers[idx] = { ...inMemoryMembers[idx], ...data, id: inMemoryMembers[idx].id };

    persistToFile();
    return inMemoryMembers[idx];
  },

  async addMember(data) {
    const tId = String(data.team_id || '').trim().toLowerCase();
    const teamMembers = inMemoryMembers.filter(m => m.team_id && m.team_id.toLowerCase() === tId);
    const nextNum = teamMembers.length + 1;
    const m = {
      id:            `${data.team_id}-M${nextNum}`,
      team_id:       data.team_id       || '',
      role:          data.role          || `Member ${nextNum}`,
      name:          data.name          || '',
      usn:           data.usn           || '',
      email:         data.email         || '',
      phone:         data.phone         || '',
      registered_at: data.registered_at || new Date().toLocaleString('en-IN'),
    };
    inMemoryMembers.push(m);
    persistToFile();
    return m;
  },

  // ── Import / Export all data ───────────────────────────────────────
  exportAll() {
    return {
      event:        inMemoryEvent,
      teams:        inMemoryTeams,
      participants: inMemoryTeams,
      members:      inMemoryMembers,
      admins:       this.getAdmins(),
      exported_at:  new Date().toISOString(),
    };
  },

  importAll(data) {
    if (!data) return { error: 'No data provided' };
    if (data.teams && Array.isArray(data.teams)) {
      inMemoryTeams = data.teams;
    } else if (data.participants && Array.isArray(data.participants)) {
      inMemoryTeams = data.participants;
    }
    if (data.members && Array.isArray(data.members)) {
      inMemoryMembers = data.members;
    } else {
      inMemoryMembers = inMemoryTeams.flatMap(membersFromTeam);
    }
    if (data.event) inMemoryEvent = data.event;
    if (data.admins && Array.isArray(data.admins)) {
      const hasPrimary = data.admins.some(a => a.userid === PRIMARY_ADMIN.userid);
      inMemoryAdmins = hasPrimary ? data.admins : [PRIMARY_ADMIN, ...data.admins];
    }
    persistToFile();
    return { success: true, count: inMemoryTeams.length };
  }
};
