/**
 * groups.js — DG Group Routing Config
 * Single source of truth for all group IDs and event routing.
 *
 * Architecture:
 *   BOD        ← Weekly/monthly reports, GM→Creator chain
 *   MANAGERS   ← Alerts: birthdays, on/off, bc follow-up, important notices
 *   HR         ← Real-time ops: checkin, moca, dongca, checkout, bc log
 *   KANSAI     ← Bep system: shift ops, SOP, nhaphang
 *   MARKETING  ← Client feedback: ratings, comments, brand data
 *   FINANCE    ← Revenue: baocaodoanhthu, chiphi, nhaphang cost
 */

'use strict';

const GROUPS = {
  BOD:       -1003827938422,   // [DG] BOD GROUP — Creator leads, GM reports
  MANAGERS:  -1003763800722,   // [DG] BAN QUẢN LÝ — GM leads, Creator watches
  HR:        -1003764628939,   // [DG] Nhóm Báo Cáo Công Việc / HR — real-time ops
  KANSAI:    -1003796440045,   // [DG] Kansai Osaka — bep system
  MARKETING: -1003334004161,   // [DG] Marketing / Social
  FINANCE:   -1003778798020,   // [DG] TÀI CHÍNH - KẾ TOÁN - THU MUA
};

/**
 * Event routing map.
 * Each event key maps to one or more group IDs that should receive the notice.
 *
 * Usage:
 *   const { getGroups } = require('../utils/groups');
 *   const targets = getGroups('bc');
 *   for (const gid of targets) await bot.sendMessage(gid, msg, opts);
 */
// ── Finance topic thread IDs (confirmed) ─────────────────────────────────────
const FINANCE_TOPICS = {
  chiphi:   10,  // LƯU TRỮ HOÁ ĐƠN
  doanhthu: 12,  // BÁO CÁO DOANH THU
  nhaphang: 13,  // BÁO CÁO THU/MUA/TỒN KHO
};

// ── HR topic thread IDs (confirmed) ──────────────────────────────────────────
const HR_TOPICS = {
  bc:       172,  // BÁO CÁO CA
  checkin:  172,
  checkout: 172,
  moca:     172,
  dongca:   172,
};

const BOD_TOPICS = {
  weekly_report:  1,    // TỔNG HỢP — general demands, GM reports
  monthly_report: 1,    // TỔNG HỢP — monthly summary
  bod_update:     1,    // TỔNG HỢP — any general BOD notice
  bod_finance:    173,  // TÀI CHÍNH/ĐẦU TƯ — revenue, expenses, investment, debt
  dev_update:     175,  // DEV/IT — bug fixes, updates, releases
  dev_release:    175,  // DEV/IT — new releases
};

const ROUTING = {
  // ── Real-time ops → HR only ──────────────────────────────────────────────────
  checkin:   [GROUPS.HR],
  checkout:  [GROUPS.HR],
  moca:      [GROUPS.HR],
  dongca:    [GROUPS.HR],
  // bc → HR (log) + MANAGERS (follow-up action required)
  bc:        [GROUPS.HR, GROUPS.MANAGERS],

  // ── Staff management → MANAGERS ──────────────────────────────────────────────
  dangky:      [GROUPS.MANAGERS],
  bosung:      [GROUPS.MANAGERS],
  birthday:    [GROUPS.MANAGERS],
  staff_onoff: [GROUPS.MANAGERS],
  important:   [GROUPS.MANAGERS],

  // ── Client feedback → MARKETING ──────────────────────────────────────────────
  // Bad ratings also alert MANAGERS so they can act
  rating_bad:      [GROUPS.MARKETING, GROUPS.MANAGERS],
  rating_good:     [GROUPS.MARKETING],
  client_feedback: [GROUPS.MARKETING],

  // ── Finance → correct topic threads ──────────────────────────────────────────
  nhaphang: [GROUPS.FINANCE],  // thread 13 — BÁO CÁO THU/MUA/TỒN KHO
  doanhthu: [GROUPS.FINANCE],  // thread 12 — BÁO CÁO DOANH THU
  chiphi:   [GROUPS.FINANCE],  // thread 10 — LƯU TRỮ HOÁ ĐƠN

  // ── Task board → HR ──────────────────────────────────────────────────────────
  posttask: [GROUPS.HR],

  // ── Analytics cron → MANAGERS ────────────────────────────────────────────────
  daily_scorecard:    [GROUPS.MANAGERS],  // 22:30 daily
  weekly_leaderboard: [GROUPS.MANAGERS],  // Mon 08:00
  forgot_checkout:    [GROUPS.MANAGERS],  // 22:30

  // ── Management reports → BOD topics ─────────────────────────────────────────
  weekly_report:  [GROUPS.BOD],   // thread 1 TỔNG HỢP
  monthly_report: [GROUPS.BOD],   // thread 1 TỔNG HỢP
  bod_update:     [GROUPS.BOD],   // thread 1 TỔNG HỢP
  bod_finance:    [GROUPS.BOD],   // thread 173 TÀI CHÍNH/ĐẦU TƯ
  dev_update:     [GROUPS.BOD],   // thread 175 DEV/IT
  dev_release:    [GROUPS.BOD],   // thread 175 DEV/IT
};

/**
 * Get target group IDs for an event type.
 * Falls back to HR group if event not mapped (safe default).
 *
 * @param {string} event - Event key (e.g. 'checkin', 'bc', 'nhaphang')
 * @returns {number[]} Array of group chat IDs
 */
function getGroups(event) {
  return ROUTING[event] || [GROUPS.HR];
}

/**
 * Get a single primary group ID for an event.
 * Use when you only need one target (e.g. for a link back).
 *
 * @param {string} event
 * @returns {number}
 */
function getPrimaryGroup(event) {
  return getGroups(event)[0];
}

/**
 * Send a message to all groups mapped to an event.
 * Handles multiple targets silently — one failure doesn't block others.
 *
 * @param {object} bot - TelegramBot instance
 * @param {string} event - Event key
 * @param {string} text - Message text
 * @param {object} opts - sendMessage options (parse_mode, message_thread_id, etc.)
 * @returns {Promise<object[]>} Array of sent message results (nulls on failure)
 */
async function broadcastEvent(bot, event, text, opts = {}) {
  const targets = getGroups(event);
  const results = [];
  for (const gid of targets) {
    // Determine correct topic thread ID per group
    // Each group has its own topic structure — never leak one group's topics to another
    let threadId;
    if (gid === GROUPS.FINANCE)      threadId = FINANCE_TOPICS[event] || null;
    else if (gid === GROUPS.BOD)     threadId = BOD_TOPICS[event]     || null;
    else if (gid === GROUPS.HR)      threadId = HR_TOPICS[event]      || null;
    else                             threadId = null;  // MANAGERS, MARKETING, KANSAI — no topics

    // Strip caller's message_thread_id — we manage topics centrally
    const { message_thread_id: _strip, ...cleanOpts } = opts;
    const finalOpts = threadId
      ? { ...cleanOpts, message_thread_id: threadId }
      : cleanOpts;
    const result = await bot.sendMessage(gid, text, finalOpts).catch(err => {
      console.error(`[GROUPS] Failed to send '${event}' to ${gid}:`, err.message);
      return null;
    });
    results.push(result);
  }
  return results;
}

/**
 * Send a photo to all groups mapped to an event.
 *
 * @param {object} bot
 * @param {string} event
 * @param {string|Buffer} photo
 * @param {object} opts
 * @returns {Promise<object[]>}
 */
async function broadcastPhoto(bot, event, photo, opts = {}) {
  const targets = getGroups(event);
  const results = [];
  for (const gid of targets) {
    const threadId = gid === GROUPS.FINANCE ? FINANCE_TOPICS[event] : null;
    const finalOpts = threadId
      ? { ...opts, message_thread_id: threadId }
      : opts;
    const result = await bot.sendPhoto(gid, photo, finalOpts).catch(err => {
      console.error(`[GROUPS] Failed to send photo '${event}' to ${gid}:`, err.message);
      return null;
    });
    results.push(result);
  }
  return results;
}

module.exports = { GROUPS, ROUTING, getGroups, getPrimaryGroup, broadcastEvent, broadcastPhoto };
