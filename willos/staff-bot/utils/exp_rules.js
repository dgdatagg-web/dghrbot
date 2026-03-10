/**
 * exp_rules.js — EXP Automation rules
 *
 * DESIGN TARGETS (v2 — 2026-03-02):
 * - Làm tốt đều đặn ~8 tháng (~240 ngày) → 1000 EXP
 * - Làm bình thường ~12 tháng (~330 ngày) → 1000 EXP
 * - 1000 EXP = điều kiện cần để REQUEST thăng chức lên Quản lý
 * - Quản lý KHÔNG tự động — cần GM/Creator approve
 *
 * DAILY BASELINE (good day):
 *   checkin_ontime(3) + bc_submit(2) = 5 EXP
 * DAILY BASELINE (normal day): ~4 EXP
 * MONTHLY WITH STREAKS: ~4.5×22 + streak bonuses ≈ 120-150 EXP
 * 8 MONTHS FULL: ~1,000 EXP ✅
 * 12 MONTHS SLOW (trễ, miss BC): ~900-1000 EXP ✅
 */

'use strict';

const EXP_RULES = {
  // ── Checkin ────────────────────────────────────────────────────────────────
  checkin_ontime:  { exp: 3,   reason: '✅ Checkin đúng giờ' },       // <5p
  checkin_late_minor: { exp: 1, reason: '✅ Checkin (trễ nhẹ)' },     // 5-15p
  checkin_late_major: { exp: 0, reason: '⏰ Checkin (trễ >15p)' },    // >15p — không EXP

  // ── Daily tasks ────────────────────────────────────────────────────────────
  bc_submit:       { exp: 2,   reason: '📋 Bàn giao ca' },
  moca:            { exp: 2,   reason: '📋 Mở ca' },
  dongca:          { exp: 2,   reason: '📋 Đóng ca' },
  nhaphang_submit: { exp: 2,   reason: '📦 Nhập hàng đầy đủ' },

  // ── Streak milestones ──────────────────────────────────────────────────────
  streak_7:        { exp: 20,  reason: '🔥 Streak 7 ngày' },
  streak_14:       { exp: 40,  reason: '🔥 Streak 14 ngày' },
  streak_30:       { exp: 80,  reason: '🔥 Streak 30 ngày!' },
  streak_60:       { exp: 150, reason: '🔥 Streak 60 ngày!!' },

  // ── Manual rewards (GM/Creator) ────────────────────────────────────────────
  extra_shift:          { exp: 15,  reason: '➕ Làm thêm ca' },
  good_handling:        { exp: 10,  reason: '⭐ Xử lý tốt' },
  excellent_handling:   { exp: 25,  reason: '🏆 Xử lý xuất sắc' },
  customer_compliment:  { exp: 20,  reason: '💬 Khách khen' },

  // ── Penalties ──────────────────────────────────────────────────────────────
  late_no_notice:        { exp: -20,  reason: '⚠️ Trễ >15p không báo' },
  miss_bc:               { exp: -15,  reason: '❌ Quên nộp BC' },
  huy_hang_no_reason:    { exp: -20,  reason: '⚠️ Hủy hàng không lý do' },
  grab_order_mistake:    { exp: -25,  reason: '🚫 Sai sót đơn Grab' },
  absent_no_notice:      { exp: -50,  reason: '❌ Tự ý nghỉ không báo' },
  food_safety_violation: { exp: -100, reason: '🚨 Vi phạm ATTP' },
  gps_fraud:             { exp: -200, reason: '🚨 Gian lận GPS', flag: true },
};

// ── Role thresholds & promotion rules ─────────────────────────────────────────
const PROMOTION_RULES = {
  newbie:    { threshold: 100,  mode: 'auto',     next: 'nhanvien' },
  nhanvien:  { threshold: 400,  mode: 'auto',     next: 'kycuu' },
  kycuu:     { threshold: 1000, mode: 'approval', next: 'quanly',
               notify: '🎯 Bạn đã đủ điều kiện thăng chức! Liên hệ quản lý để xét duyệt.' },
  quanly:    { threshold: null, mode: 'approval', next: 'gm' },
};

// Level thresholds (for EXP bar display)
const LEVEL_EXP = [0, 100, 300, 500, 1000];

function getLevel(exp) {
  let level = 0;
  for (let i = 0; i < LEVEL_EXP.length; i++) {
    if (exp >= LEVEL_EXP[i]) level = i + 1;
  }
  return level;
}

function getLevelMax(level) {
  return LEVEL_EXP[level] || 9999;
}

function expBar(exp, maxExp, width = 10) {
  const ratio = Math.min(1, exp / maxExp);
  const filled = Math.round(ratio * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function getIctNow() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000);
}

/**
 * Check if staff has 7 consecutive days with at least 1 report.
 */
function checkStreak7(db, staffId) {
  const dates = db.getRecentReportDates(staffId, 14);
  if (dates.length < 7) return false;

  const ictNow = getIctNow();
  let streak = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(ictNow);
    d.setUTCDate(d.getUTCDate() - i);
    const dayStr = d.toISOString().split('T')[0];
    if (dates.includes(dayStr)) {
      streak++;
    } else {
      break;
    }
  }
  return streak >= 7;
}

/**
 * Check if staff has 30 consecutive days with at least 1 report.
 */
function checkStreak30(db, staffId) {
  const dates = db.getRecentReportDates(staffId, 35);
  if (dates.length < 30) return false;

  const ictNow = getIctNow();
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(ictNow);
    d.setUTCDate(d.getUTCDate() - i);
    const dayStr = d.toISOString().split('T')[0];
    if (dates.includes(dayStr)) {
      streak++;
    } else {
      break;
    }
  }
  return streak >= 30;
}

/**
 * Handle promotion after EXP change.
 * AUTO roles: promote immediately.
 * APPROVAL roles: notify only, do NOT promote.
 */
async function handlePromotion(bot, db, staff, newExp) {
  const currentRole = staff.role;
  const rule = PROMOTION_RULES[currentRole];
  if (!rule || rule.threshold === null) return;
  if (newExp < rule.threshold) return;

  const { getRoleInfo } = require('./roles');
  const privateChatId = db.getStaffByTelegramId(staff.telegram_id)?.private_chat_id;

  if (rule.mode === 'auto') {
    // Auto promote
    db.updateStaff(staff.id, { role: rule.next });
    const roleInfo = getRoleInfo(rule.next);
    if (privateChatId) {
      await bot.sendMessage(privateChatId,
        `🎉 THĂNG CẤP!\n` +
        `${roleInfo.icon} Bạn đã trở thành *${roleInfo.label}*!\n` +
        `⭐ EXP: ${newExp}\n\n` +
        `Tiếp tục phát huy nhé! 💪`,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
  } else if (rule.mode === 'approval') {
    // Check if already notified (don't spam)
    const recentLogs = db.getExpHistory(staff.id, 10) || [];
    const alreadyNotified = recentLogs.some(l => l.reason && l.reason.includes('đủ điều kiện thăng chức'));
    if (alreadyNotified) return;

    // Notify user to request promotion
    if (privateChatId) {
      await bot.sendMessage(privateChatId, rule.notify).catch(() => {});
    }
  }
}

/**
 * Main autoExp function — awards EXP after a report is submitted.
 *
 * @param {object} bot   - Telegram bot instance
 * @param {object} db    - Database module
 * @param {object} staff - Staff record
 * @param {string} type  - 'bc' | 'nhaphang' | key from EXP_RULES
 * @param {*} extra      - optional extra data
 */
async function autoExp(bot, db, staff, type, extra) {
  try {
    let rule;

    if (type === 'bc') {
      rule = EXP_RULES.bc_submit;
    } else if (type === 'nhaphang') {
      rule = EXP_RULES.nhaphang_submit;
    } else if (EXP_RULES[type]) {
      rule = EXP_RULES[type];
    } else {
      return;
    }

    // Award EXP
    const oldExp = staff.exp || 0;
    const result = db.addExp(staff.id, rule.exp, rule.reason, staff.telegram_id);
    if (!result) return;

    const { newExp } = result;
    const freshStaff = db.getStaffByTelegramId(staff.telegram_id);
    const privateChatId = freshStaff?.private_chat_id;

    // Send EXP notification DM
    if (privateChatId) {
      const { next } = PROMOTION_RULES[freshStaff.role] || {};
      const nextThreshold = next ? (PROMOTION_RULES[freshStaff.role]?.threshold || 0) : 0;
      const remaining = nextThreshold > newExp ? `→ còn ${nextThreshold - newExp} EXP` : '';

      await bot.sendMessage(privateChatId,
        `⭐ +${rule.exp} EXP — ${rule.reason}\n` +
        `Tổng: ${newExp} EXP ${remaining}`
      ).catch(() => {});
    }

    // Handle promotion (auto or notify)
    await handlePromotion(bot, db, freshStaff || staff, newExp);

    // ── Streak bonuses ──────────────────────────────────────────────────────
    const ictToday = getIctNow().toISOString().split('T')[0];
    const recentLogs = db.getExpHistory(staff.id, 10) || [];

    // Streak 30 check first (takes priority)
    const alreadyStreak30Today = recentLogs.some(l =>
      l.reason === EXP_RULES.streak_30.reason && l.created_at?.startsWith(ictToday)
    );
    if (!alreadyStreak30Today && checkStreak30(db, staff.id)) {
      const r = EXP_RULES.streak_30;
      const r2 = db.addExp(staff.id, r.exp, r.reason, staff.telegram_id);
      if (privateChatId) {
        await bot.sendMessage(privateChatId,
          `🔥 STREAK 30 NGÀY!\n+${r.exp} EXP — Một tháng liên tục! 🏆`
        ).catch(() => {});
      }
      if (r2) await handlePromotion(bot, db, freshStaff || staff, r2.newExp);
      return;
    }

    // Streak 7 check
    const alreadyStreak7Today = recentLogs.some(l =>
      l.reason === EXP_RULES.streak_7.reason && l.created_at?.startsWith(ictToday)
    );
    if (!alreadyStreak7Today && checkStreak7(db, staff.id)) {
      const r = EXP_RULES.streak_7;
      const r2 = db.addExp(staff.id, r.exp, r.reason, staff.telegram_id);
      if (privateChatId) {
        await bot.sendMessage(privateChatId,
          `🔥 STREAK 7 NGÀY! +${r.exp} EXP 🔥`
        ).catch(() => {});
      }
      if (r2) await handlePromotion(bot, db, freshStaff || staff, r2.newExp);
    }

  } catch (err) {
    console.error('[autoExp] Error:', err.message);
  }
}

module.exports = { autoExp, EXP_RULES, PROMOTION_RULES, getLevel, getLevelMax, expBar };
