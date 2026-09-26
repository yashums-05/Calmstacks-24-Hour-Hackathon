/**
 * db.js — CSV-backed data store with Hackathon Numbered Unique IDs
 *
 * ID Formats:
 *   Team ID   : HACK-001, HACK-002, ...
 *   Member ID : HACK-001-M1, HACK-001-M2, ...
 *
 * Files:
 *   data/participants.csv  — one row per TEAM
 *   data/members.csv       — one row per INDIVIDUAL MEMBER
 *   data/event.json        — event config
 */

const fs   = require('node:fs');
const path = require('node:path');
const os   = require('node:os');

let defaultData = { teams: [], members: [], event: null };
try { defaultData = require('./dataset'); } catch (e) {}

const BASE_DIR   = fs.existsSync(path.join(__dirname, 'data'))
  ? __dirname
  : (fs.existsSync(path.join(__dirname, '..', 'data'))
    ? path.join(__dirname, '..')
    : process.cwd());

const DATA_DIR   = path.join(BASE_DIR, 'data');
const SOURCE_CSV = path.join(BASE_DIR, 'Untitled spreadsheet - Sheet1 (1).csv');
const TEAMS_CSV  = path.join(DATA_DIR, 'participants.csv');
const MEMBERS_CSV= path.join(DATA_DIR, 'members.csv');
const EVENT_JSON = path.join(DATA_DIR, 'event.json');

const TMP_DATA_DIR = path.join(os.tmpdir(), 'calmstacks_data');
try { if (!fs.existsSync(TMP_DATA_DIR)) fs.mkdirSync(TMP_DATA_DIR, { recursive: true }); } catch (e) {}

const TMP_TEAMS_CSV  = path.join(TMP_DATA_DIR, 'participants.csv');
const TMP_MEMBERS_CSV= path.join(TMP_DATA_DIR, 'members.csv');
const TMP_EVENT_JSON = path.join(TMP_DATA_DIR, 'event.json');

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

// ── Column definitions ─────────────────────────────────────────────
const TEAM_COLS = [
  'id', 'registered_at', 'team_name', 'team_size',
  'lead_name', 'usn', 'email', 'phone', 'year',
  'member2', 'usn2', 'member3', 'usn3', 'member4', 'usn4',
  'payment_status', 'amount', 'utr',
];

const MEMBER_COLS = [
  'id',         // HACK-001-M1
  'team_id',    // HACK-001
  'role',       // Team Lead | Member 2 | Member 3 | Member 4
  'name',
  'usn',
  'email',
  'phone',
  'registered_at',
];

// ── Generic CSV read/write ─────────────────────────────────────────
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
  
  // Try main path (works locally and on standard servers)
  try {
    fs.writeFileSync(filePath, payload, 'utf8');
  } catch (e) {
    // Read-only file system on Vercel / serverless - ignore error
  }

  // Try /tmp path (writable on serverless)
  if (tmpFilePath) {
    try {
      fs.writeFileSync(tmpFilePath, payload, 'utf8');
    } catch (e) {}
  }
}

// ── Hackathon ID Generators ────────────────────────────────────────
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

// ── Build member rows from a team row ──────────────────────────────
function membersFromTeam(team) {
  const members = [];
  let mIdx = 1;
  // Lead always present
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

// ── Memory Store ───────────────────────────────────────────────────
let inMemoryTeams = [];
let inMemoryMembers = [];
let inMemoryEvent = defaultData.event || null;

function initStore() {
  // 1. Try /tmp
  let teams = readCSVFile(TMP_TEAMS_CSV, TEAM_COLS);
  let members = readCSVFile(TMP_MEMBERS_CSV, MEMBER_COLS);

  // 2. Try DATA_DIR
  if (!teams.length) teams = readCSVFile(TEAMS_CSV, TEAM_COLS);
  if (!members.length) members = readCSVFile(MEMBERS_CSV, MEMBER_COLS);

  // 3. Try bundled defaultData
  if (!teams.length && defaultData.teams?.length) teams = [...defaultData.teams];
  if (!members.length && defaultData.members?.length) members = [...defaultData.members];

  // 4. Try bootstrap from SOURCE_CSV if brand new
  if (!teams.length && fs.existsSync(SOURCE_CSV)) {
    try {
      const raw = fs.readFileSync(SOURCE_CSV, 'utf8')
        .replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lines = raw.split('\n').filter(l => l.trim());
      for (let i = 1; i < lines.length; i++) {
        const f = parseLine(lines[i]);
        teams.push({
          id:             formatTeamId(i),
          registered_at:  f[0]  || '',
          team_name:      f[1]  || '',
          team_size:      f[2]  || '',
          lead_name:      f[3]  || '',
          usn:            f[4]  || '',
          email:          f[5]  || '',
          phone:          f[6]  || '',
          year:           f[7]  || '',
          member2:        f[8]  || '',
          usn2:           f[9]  || '',
          member3:        f[10] || '',
          usn3:           f[11] || '',
          member4:        f[12] || '',
          usn4:           f[13] || '',
          payment_status: f[14] || '',
          amount:         f[15] || '',
          utr:            f[16] || '',
        });
      }
      members = teams.flatMap(membersFromTeam);
      writeCSVFile(TEAMS_CSV, TEAM_COLS, teams, TMP_TEAMS_CSV);
      writeCSVFile(MEMBERS_CSV, MEMBER_COLS, members, TMP_MEMBERS_CSV);
    } catch (e) {}
  }

  inMemoryTeams = teams;
  inMemoryMembers = members.length ? members : teams.flatMap(membersFromTeam);

  if (fs.existsSync(TMP_EVENT_JSON)) {
    try { inMemoryEvent = JSON.parse(fs.readFileSync(TMP_EVENT_JSON, 'utf8')); } catch (e) {}
  } else if (fs.existsSync(EVENT_JSON)) {
    try { inMemoryEvent = JSON.parse(fs.readFileSync(EVENT_JSON, 'utf8')); } catch (e) {}
  }
}

initStore();

const readTeams = () => inMemoryTeams;
const readMembers = () => inMemoryMembers;
const readEvent = () => inMemoryEvent;

// ── Exported API ───────────────────────────────────────────────────
module.exports = {

  // ── Event ──────────────────────────────────────────────────────
  getEvent() { return readEvent(); },
  saveEvent(data) {
    const ev = { ...data, updated_at: new Date().toISOString() };
    inMemoryEvent = ev;
    try { fs.writeFileSync(EVENT_JSON, JSON.stringify(ev, null, 2), 'utf8'); } catch (e) {}
    try { fs.writeFileSync(TMP_EVENT_JSON, JSON.stringify(ev, null, 2), 'utf8'); } catch (e) {}
    return ev;
  },

  // ── Teams ───────────────────────────────────────────────────────
  getTeams(search) {
    const rows = readTeams();
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
    return readTeams().find(r => r.id && r.id.toLowerCase() === cleanId) || null;
  },

  addTeam(data) {
    const teams   = inMemoryTeams;
    const members = inMemoryMembers;
    const hackId  = nextTeamId(teams);

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

    teams.unshift(team);
    const newMembers = membersFromTeam(team);
    members.push(...newMembers);

    writeCSVFile(TEAMS_CSV, TEAM_COLS, teams, TMP_TEAMS_CSV);
    writeCSVFile(MEMBERS_CSV, MEMBER_COLS, members, TMP_MEMBERS_CSV);

    return { team, members: newMembers };
  },

  updateTeam(id, data) {
    const teams = inMemoryTeams;
    const idx   = teams.findIndex(r => r.id && r.id.toLowerCase() === String(id).trim().toLowerCase());
    if (idx === -1) return null;
    const old = teams[idx];
    teams[idx] = { ...old, ...data, id: old.id };

    // Re-sync member rows for this team
    const otherMembers = inMemoryMembers.filter(m => m.team_id.toLowerCase() !== old.id.toLowerCase());
    const newMembers   = membersFromTeam(teams[idx]);
    inMemoryMembers = [...otherMembers, ...newMembers];

    writeCSVFile(TEAMS_CSV, TEAM_COLS, teams, TMP_TEAMS_CSV);
    writeCSVFile(MEMBERS_CSV, MEMBER_COLS, inMemoryMembers, TMP_MEMBERS_CSV);

    return teams[idx];
  },

  deleteTeam(id) {
    const teams = inMemoryTeams;
    const targetId = String(id).trim().toLowerCase();
    const after = teams.filter(r => r.id && r.id.toLowerCase() !== targetId);
    if (after.length === teams.length) return { deleted: 0 };
    inMemoryTeams = after;

    inMemoryMembers = inMemoryMembers.filter(m => m.team_id.toLowerCase() !== targetId);

    writeCSVFile(TEAMS_CSV, TEAM_COLS, inMemoryTeams, TMP_TEAMS_CSV);
    writeCSVFile(MEMBERS_CSV, MEMBER_COLS, inMemoryMembers, TMP_MEMBERS_CSV);

    return { deleted: 1 };
  },

  // ── Members ─────────────────────────────────────────────────────
  getMembersForTeam(teamId) {
    if (!teamId) return [];
    const tId = String(teamId).trim().toLowerCase();
    return readMembers().filter(m => m.team_id && m.team_id.toLowerCase() === tId);
  },

  getAllMembers(search) {
    const rows = readMembers();
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
    const member = readMembers().find(m => m.id && m.id.toLowerCase() === cleanId) || null;
    if (!member) return null;
    const team  = readTeams().find(t => t.id && t.id.toLowerCase() === member.team_id.toLowerCase()) || null;
    const event = readEvent() || {};
    const teammates = readMembers().filter(m => m.team_id && m.team_id.toLowerCase() === member.team_id.toLowerCase());
    return { member, team, teammates, event };
  },

  updateMember(id, data) {
    const members = inMemoryMembers;
    const cleanId = String(id).trim().toLowerCase();
    const idx     = members.findIndex(m => m.id && m.id.toLowerCase() === cleanId);
    if (idx === -1) return null;
    members[idx]  = { ...members[idx], ...data, id: members[idx].id };

    writeCSVFile(MEMBERS_CSV, MEMBER_COLS, members, TMP_MEMBERS_CSV);
    return members[idx];
  },

  addMember(data) {
    const members = inMemoryMembers;
    const tId = String(data.team_id || '').trim().toLowerCase();
    const teamMembers = members.filter(m => m.team_id && m.team_id.toLowerCase() === tId);
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
    members.push(m);
    writeCSVFile(MEMBERS_CSV, MEMBER_COLS, members, TMP_MEMBERS_CSV);
    return m;
  },

  // ── Export all data ──────────────────────────────────────────────
  exportAll() {
    return {
      event:        readEvent(),
      participants: readTeams(),
      members:      readMembers(),
      exported_at:  new Date().toISOString(),
    };
  },
};
