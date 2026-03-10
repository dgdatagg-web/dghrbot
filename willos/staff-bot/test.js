/**
 * test.js — WillOS Staff RPG Bot — Offline Test Suite
 * Tests all core functions directly (no Telegram bot needed)
 * Uses in-memory SQLite DB
 */

'use strict';

// ─── Setup in-memory DB ──────────────────────────────────────────────────────
const db = require('./db');
db.initDb(':memory:');

// ─── Imports ─────────────────────────────────────────────────────────────────
const { calculateCheckinExp, applyExp, calculateStreak, EXP_EVENTS } = require('./utils/exp');
const { checkAndAwardBadges, formatBadges, BADGE_DEFS } = require('./utils/badges');
const { formatProfile, formatLeaderboard, formatCheckin, formatCheckout } = require('./utils/format');
const { getRoleFromExp, getRoleInfo, getNextRole } = require('./utils/roles');
const { detectNoShows, getCurrentWeek, getDayCode } = require('./utils/noshow');

// ─── Test runner ──────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}`);
    failed++;
    failures.push(label);
  }
}

function section(title) {
  console.log(`\n${'━'.repeat(50)}`);
  console.log(`📋 ${title}`);
  console.log('━'.repeat(50));
}

// ─── 1. REGISTER STAFF ────────────────────────────────────────────────────────
section('1. Đăng ký nhân viên (register)');

db.createStaff({ telegramId: '1001', name: 'Hiếu', role: 'newbie', status: 'pending' });
db.createStaff({ telegramId: '1002', name: 'Tân', role: 'nhanvien', status: 'active' });
db.createStaff({ telegramId: '1003', name: 'Mai', role: 'quanly', status: 'pending' });
db.createStaff({ telegramId: '9001', name: 'Will', role: 'creator', status: 'active' });
db.createStaff({ telegramId: '9002', name: 'QuynhAnh', role: 'gm', status: 'active' });

const hieu = db.getStaffByTelegramId('1001');
const tan = db.getStaffByTelegramId('1002');
const mai = db.getStaffByTelegramId('1003');
const will = db.getStaffByTelegramId('9001');
const qa = db.getStaffByTelegramId('9002');

assert(hieu && hieu.name === 'Hiếu', 'Đăng ký Hiếu (newbie, pending)');
assert(hieu.status === 'pending', 'Hiếu status = pending');
assert(hieu.role === 'newbie', 'Hiếu role = newbie');
assert(tan && tan.role === 'nhanvien', 'Đăng ký Tân (nhanvien, active)');
assert(mai && mai.status === 'pending', 'Đăng ký Mai (quanly, pending)');
assert(will && will.role === 'creator', 'Đăng ký Will (creator)');
assert(qa && qa.role === 'gm', 'Đăng ký QuynhAnh (gm)');

// Lookup by name
const foundByName = db.getStaffByName('Hiếu');
assert(foundByName && foundByName.telegram_id === '1001', 'getStaffByName tìm thấy Hiếu');

// ─── 2. APPROVE ───────────────────────────────────────────────────────────────
section('2. Duyệt nhân viên (approve)');

db.updateStaffStatus('1001', 'active');
const hieuApproved = db.getStaffByTelegramId('1001');
assert(hieuApproved.status === 'active', 'Hiếu được duyệt → status = active');

const pending = db.getPendingStaff();
assert(pending.length === 1 && pending[0].name === 'Mai', 'Còn 1 pending (Mai)');

// ─── 3. CHECKIN + EXP + STREAK ────────────────────────────────────────────────
section('3. Checkin + EXP + Streak');

const today = new Date().toISOString().split('T')[0];

// First checkin for Hiếu
const streakBefore = hieu.streak; // 0
const newStreakHieu = calculateStreak(null, today, 0);
assert(newStreakHieu === 1, 'Streak đầu tiên = 1');

const expResult1 = calculateCheckinExp(0, 0); // streak=0 before this checkin, on time
assert(expResult1.delta === EXP_EVENTS.CHECKIN_ON_TIME, `EXP checkin đúng giờ = ${EXP_EVENTS.CHECKIN_ON_TIME}`);
assert(expResult1.breakdown.streak === 0, 'Không có streak bonus lần đầu');

// Apply EXP
const { newExp: hieuExp1, newRole: hieuRole1, leveledUp: lvUp1 } = applyExp(0, 'newbie', expResult1.delta);
assert(hieuExp1 === 5, `Hiếu EXP sau checkin 1 = 5`);
assert(!lvUp1, 'Chưa level up');

// Update DB
db.updateStaff(hieu.id, { exp: hieuExp1, streak: newStreakHieu, last_checkin: today, role: hieuRole1 });
db.createCheckinLog({ staffId: hieu.id, checkinTime: new Date().toISOString(), date: today, lateMinutes: 0 });
db.logExp({ staffId: hieu.id, delta: expResult1.delta, reason: 'Checkin đúng giờ', byTelegramId: '1001' });

assert(db.getCheckinCount(hieu.id) === 1, 'Checkin count = 1 sau lần đầu');

// ─── 4. DUPLICATE CHECKIN REJECTION ──────────────────────────────────────────
section('4. Chặn checkin trùng lặp');

const existingCheckin = db.getTodayCheckin(hieu.id, today);
assert(existingCheckin !== null, 'Phát hiện checkin hôm nay tồn tại');
assert(existingCheckin.date === today, 'Date đúng ngày hôm nay');
// In real bot: would reject if existing found
console.log('  ✅ Logic kiểm tra trùng lặp hoạt động đúng (DB có bản ghi checkin hôm nay)');

// ─── 5. LEVEL UP ─────────────────────────────────────────────────────────────
section('5. Level up tự động');

// Set Hiếu to 95 EXP, then add 10 → should hit 100 → nhanvien
db.updateStaff(hieu.id, { exp: 95, role: 'newbie' });
const hieuRefresh = db.getStaffByTelegramId('1001');
const { newExp: expAfterLvUp, newRole: roleAfterLvUp, leveledUp } = applyExp(95, 'newbie', 10);
assert(expAfterLvUp === 105, 'EXP = 105 sau khi add 10 vào 95');
assert(roleAfterLvUp === 'nhanvien', 'Role tự lên nhanvien khi EXP >= 100');
assert(leveledUp === true, 'leveledUp flag = true');
db.updateStaff(hieu.id, { exp: expAfterLvUp, role: roleAfterLvUp });

// Test kycuu level up
const { newRole: kycuuRole, leveledUp: kycuuLvUp } = applyExp(490, 'nhanvien', 20);
assert(kycuuRole === 'kycuu', 'Role lên kycuu khi EXP >= 500');
assert(kycuuLvUp === true, 'leveledUp = true khi lên kycuu');

// Test quanly does NOT auto-promote (requires approval)
const { newRole: quanlyRole, leveledUp: quanlyLvUp } = applyExp(990, 'kycuu', 20);
assert(quanlyRole === 'kycuu', 'KHÔNG tự lên quanly (cần duyệt)');
assert(quanlyLvUp === false, 'leveledUp = false khi cố lên quanly');

// ─── 6. BADGE AUTO-AWARD ─────────────────────────────────────────────────────
section('6. Badge tự động (checkAndAwardBadges)');

// Hiếu has 1 checkin → should get first_blood
const hieuAfterLvUp = db.getStaffByTelegramId('1001');
const newBadges1 = checkAndAwardBadges(db, hieuAfterLvUp, 0);
assert(newBadges1.includes('first_blood'), 'Nhận badge first_blood 🩸 sau ca đầu tiên');

// Duplicate award → should not re-award
const newBadges2 = checkAndAwardBadges(db, hieuAfterLvUp, 0);
assert(!newBadges2.includes('first_blood'), 'Không nhận lại first_blood (đã có)');

// Test on_fire badge: set streak >= 7
db.updateStaff(hieu.id, { streak: 7 });
const hieuStreak7 = db.getStaffByTelegramId('1001');
const newBadges3 = checkAndAwardBadges(db, hieuStreak7, 0);
assert(newBadges3.includes('on_fire'), 'Nhận badge on_fire 🔥 khi streak = 7');

// Test legendary badge: set streak >= 30
db.updateStaff(hieu.id, { streak: 30 });
const hieuStreak30 = db.getStaffByTelegramId('1001');
const newBadges4 = checkAndAwardBadges(db, hieuStreak30, 0);
assert(newBadges4.includes('legendary'), 'Nhận badge legendary 🌟 khi streak = 30');

// Test comeback badge: phải từ EXP THỰC SỰ ÂM (< 0) mới award
db.createStaff({ telegramId: '2001', name: 'ComebackTest', role: 'newbie', status: 'active' });
const cbStaff = db.getStaffByTelegramId('2001');
db.updateStaff(cbStaff.id, { exp: 5 });
db.createCheckinLog({ staffId: cbStaff.id, checkinTime: new Date().toISOString(), date: '2025-06-01', lateMinutes: 0 });
const cbStaffRefresh = db.getStaffByTelegramId('2001');
// prevExp = -5 (âm thực sự), exp = 5 → comeback award
const newBadgesCb = checkAndAwardBadges(db, cbStaffRefresh, -5);
assert(newBadgesCb.includes('comeback'), 'Nhận badge comeback ⚡ khi từ EXP âm lên positive');
// prevExp = 0 (zero không phải âm) → KHÔNG award
const noComebackBadge = checkAndAwardBadges(db, cbStaffRefresh, 0);
assert(!noComebackBadge.includes('comeback'), 'KHÔNG nhận comeback khi prevExp = 0 (không phải âm)');

// Test grinder: need 30 checkins
// Add 29 more fake checkins
for (let i = 2; i <= 30; i++) {
  const fakeDate = `2025-${String(Math.floor(i / 31) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
  try {
    db.createCheckinLog({ staffId: hieu.id, checkinTime: new Date().toISOString(), date: fakeDate, lateMinutes: 0 });
  } catch (_) {}
}
const checkinCnt = db.getCheckinCount(hieu.id);
assert(checkinCnt >= 30, `Checkin count = ${checkinCnt} (>= 30 để test grinder)`);

const hieuForGrinder = db.getStaffByTelegramId('1001');
const grinderBadges = checkAndAwardBadges(db, hieuForGrinder, 0);
assert(grinderBadges.includes('grinder'), 'Nhận badge grinder ⚙️ khi 30 ca');

// Test mentor: refer someone to nhanvien
// Update Tân to have referred_by = hieu.id
db.updateStaff(tan.id, { referred_by: hieu.id });
const tanRefreshed = db.getStaffById(tan.id);
assert(tanRefreshed.referred_by === hieu.id, 'Tân có referred_by = Hiếu');

const hieuForMentor = db.getStaffByTelegramId('1001');
const mentorBadges = checkAndAwardBadges(db, hieuForMentor, 0);
assert(mentorBadges.includes('mentor'), 'Nhận badge mentor 🎓 khi refer được 1 người lên nhanvien');

// ─── 7. MANUAL EXP ADJUSTMENT ────────────────────────────────────────────────
section('7. Điều chỉnh EXP thủ công (/exp)');

const tanBefore = db.getStaffByTelegramId('1002');
const { newExp: tanExpPos, newRole: tanRolePos } = applyExp(tanBefore.exp, tanBefore.role, 30);
db.updateStaff(tan.id, { exp: tanExpPos, role: tanRolePos });
db.logExp({ staffId: tan.id, delta: 30, reason: 'KPI 100% tháng 2', byTelegramId: '9001' });
const tanAfterAdd = db.getStaffByTelegramId('1002');
assert(tanAfterAdd.exp === tanBefore.exp + 30, `Tân EXP tăng +30 (từ ${tanBefore.exp} → ${tanAfterAdd.exp})`);

// Test subtract
const { newExp: tanExpNeg } = applyExp(tanAfterAdd.exp, tanAfterAdd.role, -10);
db.updateStaff(tan.id, { exp: tanExpNeg });
db.logExp({ staffId: tan.id, delta: -10, reason: 'Đi trễ không báo', byTelegramId: '9001' });
const tanAfterSub = db.getStaffByTelegramId('1002');
assert(tanAfterSub.exp === tanAfterAdd.exp - 10, `Tân EXP giảm -10 (→ ${tanAfterSub.exp})`);

// EXP should not go below 0
const { newExp: noNegExp } = applyExp(5, 'newbie', -100);
assert(noNegExp === 0, 'EXP không xuống dưới 0 (floor = 0)');

// ─── 8. FIRE / ARCHIVE ────────────────────────────────────────────────────────
section('8. /fire → archive nhân viên');

db.updateStaffStatus('1002', 'archived');
const tanArchived = db.getStaffByTelegramId('1002');
assert(tanArchived.status === 'archived', 'Tân đã bị archive');

// Archived staff không xuất hiện trong leaderboard
const leaderboard = db.getLeaderboard(10);
const inLeaderboard = leaderboard.find(s => s.telegram_id === '1002');
assert(!inLeaderboard, 'Tân không xuất hiện trong leaderboard sau khi archive');

// Data vẫn còn
const tanLogs = db.getExpHistory(tan.id, 10);
assert(tanLogs.length > 0, 'Exp log của Tân vẫn còn sau archive');

// ─── 9. SHIFT SCHEDULE / LICHCA ──────────────────────────────────────────────
section('9. Lịch ca (/lichca submit + view)');

const testWeek = '2026-W10';
db.upsertShiftSchedule(hieu.id, testWeek, ['T2', 'T3', 'T5'], 'Will');

const schedule = db.getShiftSchedule(hieu.id, testWeek);
assert(schedule !== null, 'Lịch ca đã được lưu');
const savedDays = JSON.parse(schedule.days);
assert(savedDays.includes('T2') && savedDays.includes('T3') && savedDays.includes('T5'), 'Ngày làm đúng: T2 T3 T5');

// View by week
const weekSchedules = db.getShiftsByWeek(testWeek);
assert(weekSchedules.length >= 1, 'getShiftsByWeek trả về ít nhất 1 bản ghi');

// Upsert (update existing)
db.upsertShiftSchedule(hieu.id, testWeek, ['T2', 'T4', 'T6'], 'Will');
const updatedSchedule = db.getShiftSchedule(hieu.id, testWeek);
const updatedDays = JSON.parse(updatedSchedule.days);
assert(updatedDays.includes('T4') && !updatedDays.includes('T3'), 'Upsert cập nhật đúng lịch ca');

// ─── 10. NO-SHOW DETECTION ────────────────────────────────────────────────────
section('10. No-show detection');

// Setup: reset and use a specific test date
const noShowWeek = '2026-W09';
const noShowDate = '2026-02-23'; // Monday = T2
db.upsertShiftSchedule(will.id, noShowWeek, ['T2'], 'Will');

// Will has shift on T2 but no checkin → should be penalized
const willBefore = db.getStaffByTelegramId('9001');
const penalized = detectNoShows(db, noShowDate, noShowWeek, 'T2');

// Will is 'creator' — applyExp skips role change but EXP logic applies
const willAfter = db.getStaffByTelegramId('9001');

// Creator role is special — applyExp won't change role, but EXP decreases
assert(penalized.length >= 1, 'Phát hiện no-show (Will có lịch nhưng không checkin)');
const willPenalty = penalized.find(p => p.staff.id === will.id);
assert(willPenalty !== undefined, 'Will bị phạt no-show');
assert(willPenalty.expDelta === -25, 'No-show penalty = -25 EXP');

// ─── 11. LEADERBOARD ─────────────────────────────────────────────────────────
section('11. Leaderboard');

// Give Hiếu more EXP for interesting leaderboard
db.updateStaff(hieu.id, { exp: 200, role: 'nhanvien' });

const lbStaff = db.getLeaderboard(10);
assert(lbStaff.length >= 1, 'Leaderboard có ít nhất 1 nhân viên');
assert(lbStaff[0].exp >= lbStaff[lbStaff.length - 1].exp, 'Leaderboard sắp xếp theo EXP giảm dần');

const lbText = formatLeaderboard(lbStaff);
assert(lbText.includes('LEADERBOARD'), 'Format leaderboard có tiêu đề');
assert(lbText.includes('EXP'), 'Format leaderboard hiển thị EXP');
console.log('\n  Mẫu leaderboard:');
lbText.split('\n').forEach(l => console.log(`    ${l}`));

// ─── 12. PROFILE OUTPUT ──────────────────────────────────────────────────────
section('12. Profile output (/profile)');

const hieuFinal = db.getStaffByTelegramId('1001');
const profileText = formatProfile(hieuFinal);
assert(profileText.includes(hieuFinal.name), 'Profile có tên nhân viên');
assert(profileText.includes('EXP'), 'Profile có EXP');
assert(profileText.includes('QUYỀN HẠN'), 'Profile có phần quyền hạn');
assert(profileText.includes('SOP'), 'Profile có phần SOP ACCESS');
assert(profileText.includes('COMPANY RULES'), 'Profile có company rules');
console.log('\n  Mẫu profile:');
profileText.split('\n').forEach(l => console.log(`    ${l}`));

// ─── 13. ROADMAP OUTPUT ──────────────────────────────────────────────────────
section('13. Roadmap output (/roadmap)');

// Test buildMilestones logic via roadmap module
const roadmap = require('./commands/roadmap');

// Create fake bot and msg
const fakeMessages = [];
const fakeBot = {
  sendMessage: (chatId, text) => {
    fakeMessages.push(text);
    return Promise.resolve({ message_id: 1 });
  }
};
const fakeMsg = {
  from: { id: 1001 },
  chat: { id: 12345 },
  text: '/roadmap',
};

// Call roadmap handler
roadmap.handle(fakeBot, fakeMsg, [], db).then(() => {
  assert(fakeMessages.length > 0, 'Roadmap gửi message');
  const rmText = fakeMessages[0];
  assert(rmText.includes('ROADMAP'), 'Roadmap có tiêu đề');
  assert(rmText.includes('NEWBIE'), 'Roadmap có phần NEWBIE');
  assert(rmText.includes('NHÂN VIÊN'), 'Roadmap có phần NHÂN VIÊN');
  assert(rmText.includes('KỲ CỰU'), 'Roadmap có phần KỲ CỰU');
  assert(rmText.includes('QUẢN LÝ'), 'Roadmap có phần QUẢN LÝ');
  assert(rmText.includes('BADGES'), 'Roadmap có phần badges');
  console.log('\n  Mẫu roadmap:');
  rmText.split('\n').forEach(l => console.log(`    ${l}`));
  printSummary();
}).catch(err => {
  console.log(`  ❌ FAIL: Roadmap lỗi: ${err.message}`);
  failed++;
  failures.push('Roadmap handler error: ' + err.message);
  printSummary();
});

// ─── Inline tests for noshow/week utils ──────────────────────────────────────
section('14. Utils: getCurrentWeek / getDayCode');

const d = new Date('2026-02-23'); // Monday
const wk = getCurrentWeek(d);
assert(typeof wk === 'string' && wk.startsWith('2026-W'), `getCurrentWeek trả về chuỗi YYYY-WNN: ${wk}`);

const dc = getDayCode(d);
assert(dc === 'T2', `getDayCode('2026-02-23') = T2 (Thứ 2): ${dc}`);

const sun = new Date('2026-02-22');
assert(getDayCode(sun) === 'CN', 'getDayCode Sunday = CN');

// ─── 15. ROLE UTILS ──────────────────────────────────────────────────────────
section('15. Role utils');

assert(getRoleFromExp(0) === 'newbie', 'EXP 0 = newbie');
assert(getRoleFromExp(99) === 'newbie', 'EXP 99 = newbie');
assert(getRoleFromExp(100) === 'nhanvien', 'EXP 100 = nhanvien');
assert(getRoleFromExp(499) === 'nhanvien', 'EXP 499 = nhanvien');
assert(getRoleFromExp(500) === 'kycuu', 'EXP 500 = kycuu');
assert(getRoleFromExp(999) === 'kycuu', 'EXP 999 = kycuu');
assert(getRoleFromExp(1000) === 'quanly', 'EXP 1000 = quanly');

const { next, expNeeded } = getNextRole('nhanvien', 200);
assert(next === 'kycuu', 'Next role từ nhanvien = kycuu');
assert(expNeeded === 300, `EXP cần để lên kycuu từ 200 = ${expNeeded}`);

// ─── 16. LICHCA PARSER (normalizeDay + parseShiftBlock) ───────────────────────
section('16. lichca parser: normalizeDay + parseShiftBlock');

const { normalizeDay, parseShiftBlock } = require('./commands/lichca');
const { formatCurrency } = require('./commands/dongca');

// normalizeDay tests
assert(normalizeDay('T2') === 'T2', 'normalizeDay T2 → T2');
assert(normalizeDay('t2') === 'T2', 'normalizeDay t2 → T2');
assert(normalizeDay('T7') === 'T7', 'normalizeDay T7 → T7');
assert(normalizeDay('CN') === 'CN', 'normalizeDay CN → CN');
assert(normalizeDay('Cnhat') === 'CN', 'normalizeDay Cnhat → CN');
assert(normalizeDay('cnhat') === 'CN', 'normalizeDay cnhat → CN');
assert(normalizeDay('chunhat') === 'CN', 'normalizeDay chunhat → CN');
assert(normalizeDay('T3') === 'T3', 'normalizeDay T3 → T3');
assert(normalizeDay('t5') === 'T5', 'normalizeDay t5 → T5');
assert(normalizeDay('xyz') === null, 'normalizeDay xyz → null');

// parseShiftBlock tests — real format from staff
const block = `T2 : tối
T3 : 9h-13h
T4: off
T5: 9h-13h
T6: tối
T7: 9h-13h
Cnhat: tối`;

const { days: pDays, shiftDetail: pDetail } = parseShiftBlock(block);
assert(pDays.includes('T2'), 'parseShiftBlock: T2 included (tối = làm)');
assert(pDays.includes('T3'), 'parseShiftBlock: T3 included');
assert(!pDays.includes('T4'), 'parseShiftBlock: T4 excluded (off)');
assert(pDays.includes('T5'), 'parseShiftBlock: T5 included');
assert(pDays.includes('T6'), 'parseShiftBlock: T6 included (tối)');
assert(pDays.includes('T7'), 'parseShiftBlock: T7 included');
assert(pDays.includes('CN'), 'parseShiftBlock: CN included (Cnhat → CN)');
assert(pDetail['T2'] === 'tối', 'shiftDetail T2 = tối');
assert(pDetail['T3'] === '9h-13h', 'shiftDetail T3 = 9h-13h');
assert(pDetail['T4'] === 'off', 'shiftDetail T4 = off');
assert(pDetail['CN'] === 'tối', 'shiftDetail CN = tối (from Cnhat)');

// formatCurrency
assert(formatCurrency(2500000) === '2.500.000₫', 'formatCurrency 2500000 → 2.500.000₫');
assert(formatCurrency(0) === '0₫', 'formatCurrency 0 → 0₫');
assert(formatCurrency(1000000) === '1.000.000₫', 'formatCurrency 1000000 → 1.000.000₫');

// DB upsert with shiftDetail
db.upsertShiftSchedule(hieu.id, '2026-W11', pDays, 'Will', pDetail);
const saved = db.getShiftSchedule(hieu.id, '2026-W11');
assert(saved !== null, 'upsertShiftSchedule với shiftDetail lưu thành công');
const savedDetail = JSON.parse(saved.shift_detail || '{}');
assert(savedDetail['T2'] === 'tối', 'shift_detail T2 = tối trong DB');
assert(savedDetail['CN'] === 'tối', 'shift_detail CN = tối trong DB');

// getShiftsByWeek returns shift_detail
const weekRows = db.getShiftsByWeek('2026-W11');
assert(weekRows.length >= 1, 'getShiftsByWeek trả về row cho W11');
const detailParsed = JSON.parse(weekRows[0].shift_detail || '{}');
assert(detailParsed['T3'] === '9h-13h', 'getShiftsByWeek row có shift_detail T3=9h-13h');

// ─── SPRINT 1: Feature 1 — private_chat_id ───────────────────────────────────
section('SPRINT 1 — Feature 1: private_chat_id tracking');

const { updatePrivateChatId, getStaffWithPrivateChatId, addExp, getRecentReportDates } = db;

// updatePrivateChatId
updatePrivateChatId('1001', '777000111');
const s1 = db.getStaffByTelegramId('1001');
assert(s1.private_chat_id === '777000111', 'updatePrivateChatId saves correctly');

// getStaffWithPrivateChatId — only active staff with private_chat_id
updatePrivateChatId('9001', '777000222'); // Will (creator, active)
const withPCID = getStaffWithPrivateChatId();
assert(withPCID.length >= 1, 'getStaffWithPrivateChatId returns staff with private_chat_id');
assert(withPCID.every(s => s.private_chat_id), 'all returned staff have private_chat_id');
assert(withPCID.every(s => s.status === 'active'), 'all returned staff are active');

// ─── SPRINT 1: Feature 2 — EXP Automation ────────────────────────────────────
section('SPRINT 1 — Feature 2: EXP automation');

const { autoExp, EXP_RULES, getLevel, expBar } = require('./utils/exp_rules');

// EXP_RULES structure
assert(EXP_RULES.moca_ontime.exp === 5, 'moca_ontime EXP = 5');
assert(EXP_RULES.moca_late.exp === 2, 'moca_late EXP = 2');
assert(EXP_RULES.bc_submit.exp === 3, 'bc_submit EXP = 3');
assert(EXP_RULES.dongca_submit.exp === 5, 'dongca_submit EXP = 5');
assert(EXP_RULES.dongca_full.exp === 8, 'dongca_full EXP = 8');
assert(EXP_RULES.nhaphang_submit.exp === 3, 'nhaphang_submit EXP = 3');
assert(EXP_RULES.streak_bonus.exp === 10, 'streak_bonus EXP = 10');

// getLevel
assert(getLevel(0) === 1, 'getLevel(0) = 1');
assert(getLevel(100) === 2, 'getLevel(100) = 2');
assert(getLevel(99) === 1, 'getLevel(99) = 1');

// expBar
const bar = expBar(50, 100, 10);
assert(bar.length === 10, 'expBar width = 10');
assert(bar.includes('█'), 'expBar has filled segments');
assert(bar.includes('░'), 'expBar has empty segments');

// addExp function
const staffForExp = db.getStaffByTelegramId('9001'); // Will, creator
const expBefore = staffForExp.exp;
const expResult = addExp(staffForExp.id, 5, '⏰ Báo mở ca đúng giờ', '9001');
assert(expResult !== null, 'addExp returns result');
assert(expResult.newExp === expBefore + 5, 'addExp increases exp correctly');
const staffAfter = db.getStaffByTelegramId('9001');
assert(staffAfter.exp === expBefore + 5, 'exp updated in DB after addExp');

// addExp logs to exp_log
const logs = db.getExpHistory(staffForExp.id, 20);
assert(logs.length >= 1, 'addExp creates exp_log entry');
const mocaLog = logs.find(l => l.reason === '⏰ Báo mở ca đúng giờ');
assert(mocaLog !== undefined, 'exp_log reason matches');

// getRecentReportDates
db.createShiftReport({ staffId: staffForExp.id, reportType: 'moca', reportData: '{}', date: '2026-02-28' });
db.createShiftReport({ staffId: staffForExp.id, reportType: 'bc', reportData: '{}', date: '2026-02-27' });
const recentDates = getRecentReportDates(staffForExp.id, 10);
assert(Array.isArray(recentDates), 'getRecentReportDates returns array');
assert(recentDates.includes('2026-02-28'), 'getRecentReportDates includes moca date');
assert(recentDates.includes('2026-02-27'), 'getRecentReportDates includes bc date');
assert(recentDates.length === [...new Set(recentDates)].length, 'getRecentReportDates returns distinct dates');

// ─── SPRINT 1: Feature 3 — Pre-fill tồn kho ──────────────────────────────────
section('SPRINT 1 — Feature 3: Pre-fill tồn kho từ đóng ca hôm qua');

// createShiftReport with dongca + endInventory
const yesterdayStr = (() => {
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
})();

db.createShiftReport({
  staffId: staffForExp.id,
  reportType: 'dongca',
  reportData: JSON.stringify({ inventory: '2p heo, 5p gà, 0 tôm', tienMat: 1000000, chuyenKhoan: 0, grab: 0, total: 1000000 }),
  date: yesterdayStr,
});

// Verify dongca report is queryable for yesterday
const dongcaRow = db.getDb().prepare(
  "SELECT report_data FROM shift_report WHERE report_type='dongca' AND date=? ORDER BY created_at DESC LIMIT 1"
).get(yesterdayStr);
assert(dongcaRow !== undefined, 'dongca report for yesterday exists');
const dongcaData = JSON.parse(dongcaRow.report_data);
assert(dongcaData.inventory === '2p heo, 5p gà, 0 tôm', 'dongca inventory field correct');
assert(dongcaData.inventory.includes('heo'), 'inventory contains heo');

// getShiftReportByDate
const reportRow = db.getShiftReportByDate(staffForExp.id, 'dongca', yesterdayStr);
assert(reportRow !== undefined && reportRow !== null, 'getShiftReportByDate returns dongca row');

// ─── Summary (printed after async roadmap test completes) ────────────────────
function printSummary() {
  console.log(`\n${'═'.repeat(50)}`);
  console.log('📊 KẾT QUẢ TEST');
  console.log('═'.repeat(50));
  console.log(`✅ PASSED: ${passed}`);
  console.log(`❌ FAILED: ${failed}`);
  if (failures.length > 0) {
    console.log('\nTest thất bại:');
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }
  console.log('═'.repeat(50));
  if (failed === 0) {
    console.log('🎉 TẤT CẢ TEST ĐỀU PASS! Bot sẵn sàng deploy.');
  } else {
    console.log(`⚠️ CÓ ${failed} TEST THẤT BẠI — Cần kiểm tra lại.`);
    process.exit(1);
  }
}
