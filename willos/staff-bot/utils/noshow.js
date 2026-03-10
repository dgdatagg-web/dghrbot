/**
 * noshow.js — No-show detection logic
 * Run at end of day: compare shift_schedule vs checkin_log
 * WillOS Staff RPG Bot
 */

const { applyExp } = require('./exp');

/**
 * Get ISO week string "YYYY-WNN" for a given Date
 * @param {Date} date
 * @returns {string} e.g. "2026-W09"
 */
function getCurrentWeek(date) {
  const d = date ? new Date(date) : new Date();
  // ISO week: week containing Thursday
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));

  // Week number
  const daysDiff = Math.floor((d - startOfWeek1) / (1000 * 60 * 60 * 24));
  const weekNum = Math.floor(daysDiff / 7) + 1;
  const year = d.getFullYear();
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Get day code "T2"-"CN" from a Date object
 * @param {Date} date
 * @returns {string} T2|T3|T4|T5|T6|T7|CN
 */
function getDayCode(date) {
  const d = date ? new Date(date) : new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const map = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  return map[day];
}

/**
 * Detect no-shows for a given date and apply penalties.
 * @param {object} dbModule - db.js module
 * @param {string} date - YYYY-MM-DD
 * @param {string} weekStr - "YYYY-WNN"
 * @param {string} dayCode - "T2"-"CN"
 * @returns {Array<{staff, expDelta, newExp}>} list of penalized staff
 */
function detectNoShows(dbModule, date, weekStr, dayCode) {
  // Get all staff with a shift today
  const staffWithShift = dbModule.getStaffWithShiftToday(weekStr, dayCode);
  if (!staffWithShift || staffWithShift.length === 0) return [];

  // Get all checkins for today
  const checkins = dbModule.getAllCheckinsByDate(date);
  const checkedInStaffIds = new Set(checkins.map(c => c.staff_id));

  const penalized = [];

  for (const shiftRow of staffWithShift) {
    const staffId = shiftRow.staff_id || shiftRow.id;
    if (checkedInStaffIds.has(staffId)) continue; // checked in, no penalty

    // Get full staff record
    const staff = dbModule.getStaffById(staffId);
    if (!staff || staff.status !== 'active') continue;

    const delta = -25;
    const { newExp, newRole, leveledUp } = applyExp(staff.exp, staff.role, delta);

    // Apply to DB
    dbModule.updateStaff(staffId, {
      exp: newExp,
      ...(newRole !== staff.role ? { role: newRole } : {}),
    });
    dbModule.logExp({
      staffId,
      delta,
      reason: 'no-show ca đã đăng ký',
      byTelegramId: null,
    });

    penalized.push({ staff, expDelta: delta, newExp });
  }

  return penalized;
}

module.exports = {
  getCurrentWeek,
  getDayCode,
  detectNoShows,
};
