/**
 * scripts/seed-staff.js — Seed 11 staff members + EXP data into WillOS DB
 *
 * Usage: node scripts/seed-staff.js
 */

'use strict';

const path = require('path');
const Database = require('better-sqlite3');
const { initSchema } = require('../core/schema');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/willos.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
initSchema(db);

const STAFF = [
  { id: 'hieu', name: 'Hiếu', role: 'Bếp trưởng',  dept: 'Bếp',     emoji: '👨‍🍳', color: '#ff7d3b', total_xp: 340, weekly_xp: 45 },
  { id: 'tan',  name: 'Tân',  role: 'Bếp phó',     dept: 'Bếp',     emoji: '🧑‍🍳', color: '#ff9a5c', total_xp: 95,  weekly_xp: 20 },
  { id: 'qa',   name: 'QA',   role: 'Phó GĐ',      dept: 'Kế Toán', emoji: '👩‍💼', color: '#f0455a', total_xp: 520, weekly_xp: 80 },
  { id: 'chi',  name: 'Chi',  role: 'Thu mua/KT',  dept: 'Kế Toán', emoji: '📦',  color: '#f5a623', total_xp: 180, weekly_xp: 15 },
  { id: 'bety', name: 'Bety', role: 'QL Bar/Prep', dept: 'Bar',     emoji: '🍹',  color: '#00c8e0', total_xp: 210, weekly_xp: 35 },
  { id: 'thao', name: 'Thảo', role: 'Bartender',   dept: 'Bar',     emoji: '🧋',  color: '#38bdf8', total_xp: 130, weekly_xp: 22 },
  { id: 'thu',  name: 'Thư',  role: 'QL Bida',     dept: 'Bida',    emoji: '🎱',  color: '#0ecb81', total_xp: 195, weekly_xp: 28 },
  { id: 'nhan', name: 'Nhân', role: 'Xếp bi',      dept: 'Bida',    emoji: '🟢',  color: '#34d399', total_xp: 220, weekly_xp: 30 },
  { id: 'li',   name: 'Lì',   role: 'Xếp bi',      dept: 'Bida',    emoji: '🟢',  color: '#34d399', total_xp: 155, weekly_xp: 25 },
  { id: 'khoi', name: 'Khôi', role: 'Xếp bi',      dept: 'Bida',    emoji: '🟢',  color: '#34d399', total_xp: 88,  weekly_xp: 18 },
  { id: 'nhim', name: 'Nhím', role: 'Xếp bi',      dept: 'Bida',    emoji: '🟢',  color: '#34d399', total_xp: 45,  weekly_xp: 12 },
];

// Deterministic pseudo-random in 0.75–0.95 range per staff id
function perfRatio(id) {
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return +(0.75 + ((Math.abs(hash) % 200) / 1000)).toFixed(3);
}

// Estimate positive/negative events from total_xp & ratio
// avg positive event ~+9 XP, avg negative ~-15 XP
function calcEvents(total_xp, ratio) {
  // ratio = pos / (pos + neg), total ≈ pos*9 - neg*15
  // solve: pos = ratio * (pos + neg), neg = pos*(1-ratio)/ratio
  const avgPos = 9, avgNeg = 15;
  // Use total_xp to estimate total events via avg net gain
  // net_per_event_pair = avgPos - avgNeg*(1-ratio)/ratio
  const estTotalEvents = Math.max(10, Math.round(total_xp / (avgPos * ratio)));
  const pos = Math.round(estTotalEvents * ratio);
  const neg = estTotalEvents - pos;
  return { positive_events: pos, negative_events: neg };
}

// Use INSERT OR REPLACE compatible with actual staff table schema
// (may have extra columns: telegram_id, status from older migration)
const insertStaff = db.prepare(`
  INSERT INTO staff (id, name, role, dept, emoji, color, active)
  VALUES (@id, @name, @role, @dept, @emoji, @color, 1)
  ON CONFLICT(id) DO UPDATE SET
    name   = excluded.name,
    role   = excluded.role,
    dept   = excluded.dept,
    emoji  = excluded.emoji,
    color  = excluded.color,
    active = 1
`);

const insertExp = db.prepare(`
  INSERT OR REPLACE INTO staff_exp
    (staff_id, total_xp, weekly_xp, level, performance_ratio,
     positive_events, negative_events, weekly_reset_at, updated_at)
  VALUES
    (@staff_id, @total_xp, @weekly_xp, @level, @performance_ratio,
     @positive_events, @negative_events, @weekly_reset_at, datetime('now'))
`);

const seedAll = db.transaction(() => {
  for (const s of STAFF) {
    insertStaff.run(s);

    const ratio = perfRatio(s.id);
    const level = Math.floor(s.total_xp / 100);
    const { positive_events, negative_events } = calcEvents(s.total_xp, ratio);

    insertExp.run({
      staff_id: s.id,
      total_xp: s.total_xp,
      weekly_xp: s.weekly_xp,
      level,
      performance_ratio: ratio,
      positive_events,
      negative_events,
      weekly_reset_at: new Date().toISOString(),
    });

    console.log(`  ✅ ${s.emoji} ${s.name} — Lv.${level} | ${s.total_xp} XP | perf ${(ratio*100).toFixed(1)}% | +${positive_events}/-${negative_events} events`);
  }
});

console.log('\n🌱 Seeding WillOS staff + EXP data...\n');
seedAll();
console.log('\n✅ Seed complete — 11 staff seeded.\n');

// Verify
const staffCount = db.prepare('SELECT COUNT(*) as n FROM staff').get();
const expCount   = db.prepare('SELECT COUNT(*) as n FROM staff_exp').get();
console.log(`📊 staff table: ${staffCount.n} rows`);
console.log(`📊 staff_exp table: ${expCount.n} rows`);

// Print leaderboard
console.log('\n🏆 Weekly Leaderboard:');
const lb = db.prepare(`
  SELECT s.name, s.emoji, e.weekly_xp, e.level, e.total_xp
  FROM staff s JOIN staff_exp e ON s.id = e.staff_id
  ORDER BY e.weekly_xp DESC LIMIT 5
`).all();
lb.forEach((r, i) => console.log(`  ${i+1}. ${r.emoji} ${r.name} — +${r.weekly_xp} XP/week | Lv.${r.level} | ${r.total_xp} XP total`));

db.close();
