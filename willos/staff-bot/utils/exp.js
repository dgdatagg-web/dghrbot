/**
 * exp.js — EXP calculation helpers
 * WillOS Staff RPG Bot
 */

const { getRoleFromExp, getRoleInfo } = require('./roles');

// EXP reward/penalty constants — loaded from exp_rules.json
// Thresholds: newbie=0, nhanvien=100, kycuu=400, quanly=1000
// Calibration: ~4.2 EXP/day = 8 months to quanly (good), ~3 EXP/day = 12 months (normal)
const EXP_EVENTS = {
  // Auto — checkin
  CHECKIN_ON_TIME: 3,        // đúng giờ (<5p)
  CHECKIN_LATE_MINOR: 1,     // trễ 5-15p
  CHECKIN_LATE_MAJOR: 0,     // trễ >15p — không EXP
  // Auto — daily tasks
  BC_SUBMITTED: 2,           // nộp BC đúng hạn
  NHAPHANG_COMPLETE: 2,      // nhập hàng đầy đủ (kho)
  // Auto — streak milestones
  STREAK_7: 20,
  STREAK_14: 40,
  STREAK_30: 80,
  STREAK_60: 150,
  // Manual reward
  EXTRA_SHIFT: 15,
  GOOD_HANDLING: 10,
  EXCELLENT_HANDLING: 25,
  CUSTOMER_COMPLIMENT: 20,
  // Penalty
  LATE_NO_NOTICE: -20,
  MISS_BC: -15,
  HUY_HANG_NO_REASON: -20,
  GRAB_ORDER_MISTAKE: -25,
  ABSENT_NO_NOTICE: -50,
  FOOD_SAFETY_VIOLATION: -100,
  GPS_FRAUD: -200,
};

/**
 * Calculate checkin EXP gain
 * @param {number} streak - current streak (before this checkin)
 * @param {number} lateMinutes - minutes late (0 = on time)
 * @returns {{ delta: number, reason: string, breakdown: object }}
 */
function calculateCheckinExp(streak, lateMinutes = 0) {
  // >15p — không EXP, không phạt (phạt qua /exp manual nếu cần)
  if (lateMinutes > 15) {
    return {
      delta: 0,
      reason: `Checkin (trễ ${lateMinutes}p)`,
      breakdown: { base: 0, streak: 0 },
    };
  }

  // 5-15p late — EXP nhẹ
  if (lateMinutes >= 5) {
    return {
      delta: EXP_EVENTS.CHECKIN_LATE_MINOR,
      reason: `Checkin (trễ ${lateMinutes}p)`,
      breakdown: { base: EXP_EVENTS.CHECKIN_LATE_MINOR, streak: 0 },
    };
  }

  // Đúng giờ (<5p) — full EXP
  // Streak milestone bonus
  let streakBonus = 0;
  let streakNote = '';
  if (streak > 0 && streak % 60 === 0) { streakBonus = EXP_EVENTS.STREAK_60; streakNote = ` + 🔥 Streak ${streak} ngày!`; }
  else if (streak > 0 && streak % 30 === 0) { streakBonus = EXP_EVENTS.STREAK_30; streakNote = ` + 🔥 Streak ${streak} ngày!`; }
  else if (streak > 0 && streak % 14 === 0) { streakBonus = EXP_EVENTS.STREAK_14; streakNote = ` + Streak ${streak} ngày`; }
  else if (streak > 0 && streak % 7 === 0)  { streakBonus = EXP_EVENTS.STREAK_7;  streakNote = ` + Streak ${streak} ngày`; }

  const total = EXP_EVENTS.CHECKIN_ON_TIME + streakBonus;

  return {
    delta: total,
    reason: `Checkin đúng giờ${streakNote}`,
    breakdown: { base: EXP_EVENTS.CHECKIN_ON_TIME, streak: streakBonus },
  };
}

/**
 * Apply EXP delta to staff record and check for level-up
 * Returns { newExp, newRole, leveledUp }
 */
function applyExp(currentExp, currentRole, delta) {
  const newExp = Math.max(0, currentExp + delta);

  // Don't auto-promote special roles
  if (['gm', 'creator'].includes(currentRole)) {
    return { newExp, newRole: currentRole, leveledUp: false };
  }

  // Don't auto-promote quanly (requires approval path)
  const calculatedRole = getRoleFromExp(newExp);

  // Only auto-promote up to kycuu; quanly requires manual approval
  let newRole = currentRole;
  let leveledUp = false;

  const progressionMap = { newbie: 0, nhanvien: 1, kycuu: 2, quanly: 3 };
  const calcIdx = progressionMap[calculatedRole] ?? 0;
  const currIdx = progressionMap[currentRole] ?? 0;

  // Auto promote: newbie→nhanvien→kycuu only (not to quanly)
  if (calcIdx > currIdx && calculatedRole !== 'quanly') {
    newRole = calculatedRole;
    leveledUp = true;
  }

  return { newExp, newRole, leveledUp };
}

/**
 * Calculate streak: returns new streak count
 * @param {string|null} lastCheckinDate - YYYY-MM-DD
 * @param {string} todayDate - YYYY-MM-DD
 * @param {number} currentStreak
 */
function calculateStreak(lastCheckinDate, todayDate, currentStreak) {
  if (!lastCheckinDate) return 1;

  const last = new Date(lastCheckinDate);
  const today = new Date(todayDate);
  const diffDays = Math.round((today - last) / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    // Consecutive day — increment streak
    return currentStreak + 1;
  } else if (diffDays === 0) {
    // Same day — shouldn't happen (blocked by idempotency), return same
    return currentStreak;
  } else {
    // Gap — reset streak
    return 1;
  }
}

/**
 * Format EXP bar for display
 */
function formatExpBar(exp, role) {
  const roleThresholds = {
    newbie: { min: 0, max: 100 },
    nhanvien: { min: 100, max: 500 },
    kycuu: { min: 500, max: 1000 },
    quanly: { min: 1000, max: 1000 },
    gm: { min: 0, max: 0 },
    creator: { min: 0, max: 0 },
  };

  const t = roleThresholds[role] || roleThresholds.newbie;
  if (['gm', 'creator'].includes(role) || t.max === t.min) {
    return `${exp} EXP (MAX)`;
  }

  return `${exp} / ${t.max}`;
}

module.exports = {
  EXP_EVENTS,
  calculateCheckinExp,
  applyExp,
  calculateStreak,
  formatExpBar,
};
