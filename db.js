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

try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (e) {}

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
}

function writeCSVFile(filePath, cols, rows) {
  const header = cols.join(',');
  const body   = rows.map(r => cols.map(c => quoteField(r[c] ?? '')).join(','));
  fs.writeFileSync(filePath, [header, ...body].join('\n'), 'utf8');
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
    name:          team.lead_name,
    usn:           team.usn,
    email:         team.email,
    phone:         team.phone,
    registered_at: team.registered_at,
  });
  if (team.member2?.trim()) members.push({
    id: `${team.id}-M${mIdx++}`, team_id: team.id, role: 'Member 2',
    name: team.member2, usn: team.usn2 || '',
    email: '', phone: '', registered_at: team.registered_at,
  });
  if (team.member3?.trim()) members.push({
    id: `${team.id}-M${mIdx++}`, team_id: team.id, role: 'Member 3',
    name: team.member3, usn: team.usn3 || '',
    email: '', phone: '', registered_at: team.registered_at,
  });
  if (team.member4?.trim()) members.push({
    id: `${team.id}-M${mIdx++}`, team_id: team.id, role: 'Member 4',
    name: team.member4, usn: team.usn4 || '',
    email: '', phone: '', registered_at: team.registered_at,
  });
  return members;
}

// ── Bootstrap & Migration ──────────────────────────────────────────
function bootstrap() {
  const needTeams = !fs.existsSync(TEAMS_CSV);
  let teams = needTeams ? [] : readCSVFile(TEAMS_CSV, TEAM_COLS);

  if (needTeams && fs.existsSync(SOURCE_CSV)) {
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
    writeCSVFile(TEAMS_CSV, TEAM_COLS, teams);
    const allMembers = teams.flatMap(membersFromTeam);
    writeCSVFile(MEMBERS_CSV, MEMBER_COLS, allMembers);
    return;
  }

  // Migrate existing UUIDs to HACK-xxx if needed
  const hasUUIDs = teams.some(t => t.id && !t.id.startsWith('HACK-'));
  if (hasUUIDs) {
    teams = teams.map((t, index) => {
      const hackId = formatTeamId(index + 1);
      return { ...t, id: hackId };
    });
    writeCSVFile(TEAMS_CSV, TEAM_COLS, teams);
    const allMembers = teams.flatMap(membersFromTeam);
    writeCSVFile(MEMBERS_CSV, MEMBER_COLS, allMembers);
  }
}

// ── Readers ────────────────────────────────────────────────────────
let defaultData = { teams: [], members: [], event: null };
try { defaultData = require('./dataset'); } catch (e) {}

const readTeams   = () => {
  const rows = readCSVFile(TEAMS_CSV, TEAM_COLS);
  if (rows && rows.length > 0) return rows;
  return defaultData.teams || [];
};
const readMembers = () => {
  const rows = readCSVFile(MEMBERS_CSV, MEMBER_COLS);
  if (rows && rows.length > 0) return rows;
  return defaultData.members || [];
};
const readEvent   = () => {
  if (fs.existsSync(EVENT_JSON)) {
    try { return JSON.parse(fs.readFileSync(EVENT_JSON, 'utf8')); } catch {}
  }
  return defaultData.event || null;
};

try { bootstrap(); } catch (e) {}

// ── Exported API ───────────────────────────────────────────────────
module.exports = {

  // ── Event ──────────────────────────────────────────────────────
  getEvent() { return readEvent(); },
  saveEvent(data) {
    const ev = { ...data, updated_at: new Date().toISOString() };
    fs.writeFileSync(EVENT_JSON, JSON.stringify(ev, null, 2), 'utf8');
    return ev;
  },

  // ── Teams ───────────────────────────────────────────────────────
  getTeams(search) {
    const rows = readTeams();
    if (!search?.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter(r =>
      [r.id, r.team_name, r.lead_name, r.email, r.usn,
       r.year, r.member2, r.member3, r.member4, r.payment_status]
        .some(v => v && v.toLowerCase().includes(q))
    );
  },

  getTeam(id) { return readTeams().find(r => r.id.toLowerCase() === id.toLowerCase()) || null; },

  addTeam(data) {
    const teams   = readTeams();
    const members = readMembers();
    const teamId  = nextTeamId(teams);

    const team = {
      id:             teamId,
      registered_at:  new Date().toLocaleString('en-IN'),
      team_name:      data.team_name      || '',
      team_size:      data.team_size      || '',
      lead_name:      data.lead_name      || '',
      usn:            data.usn            || '',
      email:          data.email          || '',
      phone:          data.phone          || '',
      year:           data.year           || '',
      member2:        data.member2        || '',
      usn2:           data.usn2           || '',
      member3:        data.member3        || '',
      usn3:           data.usn3           || '',
      member4:        data.member4        || '',
      usn4:           data.usn4           || '',
      payment_status: data.payment_status || '',
      amount:         data.amount         || '',
      utr:            data.utr            || '',
    };
    teams.push(team);
    writeCSVFile(TEAMS_CSV, TEAM_COLS, teams);

    // also create individual member rows
    const newMembers = membersFromTeam(team);
    members.push(...newMembers);
    writeCSVFile(MEMBERS_CSV, MEMBER_COLS, members);

    return { team, members: newMembers };
  },

  updateTeam(id, data) {
    const teams = readTeams();
    const idx   = teams.findIndex(r => r.id.toLowerCase() === id.toLowerCase());
    if (idx === -1) return null;
    const old = teams[idx];
    teams[idx] = { ...old, ...data, id: old.id };
    writeCSVFile(TEAMS_CSV, TEAM_COLS, teams);

    // Re-sync member rows for this team
    const allMembers   = readMembers();
    const otherMembers = allMembers.filter(m => m.team_id.toLowerCase() !== old.id.toLowerCase());
    const newMembers   = membersFromTeam(teams[idx]);
    writeCSVFile(MEMBERS_CSV, MEMBER_COLS, [...otherMembers, ...newMembers]);

    return teams[idx];
  },

  deleteTeam(id) {
    const teams = readTeams();
    const after = teams.filter(r => r.id.toLowerCase() !== id.toLowerCase());
    if (after.length === teams.length) return { deleted: 0 };
    writeCSVFile(TEAMS_CSV, TEAM_COLS, after);

    // Also delete member rows for this team
    const members = readMembers().filter(m => m.team_id.toLowerCase() !== id.toLowerCase());
    writeCSVFile(MEMBERS_CSV, MEMBER_COLS, members);

    return { deleted: 1 };
  },

  // ── Members ─────────────────────────────────────────────────────
  getMembersForTeam(teamId) {
    return readMembers().filter(m => m.team_id.toLowerCase() === teamId.toLowerCase());
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
    const member = readMembers().find(m => m.id.toLowerCase() === id.toLowerCase()) || null;
    if (!member) return null;
    const team  = readTeams().find(t => t.id.toLowerCase() === member.team_id.toLowerCase()) || null;
    const event = readEvent() || {};
    // All members of same team
    const teammates = readMembers().filter(m => m.team_id.toLowerCase() === member.team_id.toLowerCase());
    return { member, team, teammates, event };
  },

  updateMember(id, data) {
    const members = readMembers();
    const idx     = members.findIndex(m => m.id.toLowerCase() === id.toLowerCase());
    if (idx === -1) return null;
    members[idx]  = { ...members[idx], ...data, id: members[idx].id };
    writeCSVFile(MEMBERS_CSV, MEMBER_COLS, members);
    return members[idx];
  },

  addMember(data) {
    const members = readMembers();
    const teamMembers = members.filter(m => m.team_id.toLowerCase() === data.team_id.toLowerCase());
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
    writeCSVFile(MEMBERS_CSV, MEMBER_COLS, members);
    return m;
  },

  // ── Export ──────────────────────────────────────────────────────
  exportAll() {
    const teams   = readTeams();
    const members = readMembers();
    return {
      event:   readEvent() || {},
      teams,   total_teams:   teams.length,
      members, total_members: members.length,
      exported_at: new Date().toISOString(),
    };
  },
};
