/**
 * daily_scorecard.js — Daily Analytics Scorecard Job
 * Kai Sprint 1 — DG Group Analytics Pipeline
 *
 * Chạy lúc 22:30 ICT hằng ngày.
 * Post vào topic 172 của GROUP_CHAT_ID.
 */

'use strict';

const { broadcastEvent } = require('../utils/groups');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get current date in ICT (UTC+7) as YYYY-MM-DD string
 */
function getIctDate() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
}

/**
 * Get current ICT time as { hours, minutes }
 */
function getIctTime() {
  const ict = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return { hours: ict.getUTCHours(), minutes: ict.getUTCMinutes() };
}

/**
 * Format number as Vietnamese currency string
 * e.g. 1200000 → "1.200.000₫"
 */
function formatCurrency(num) {
  if (!num || isNaN(num)) return '0₫';
  return num.toLocaleString('vi-VN') + '₫';
}

/**
 * Format date YYYY-MM-DD → DD/MM/YYYY
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Compliance Report (exported for shared use) ──────────────────────────────

/**
 * getComplianceReport(db, date)
 * Returns compliance data for all active staff on a given date.
 *
 * @param {object} db - initialized better-sqlite3 db instance (from db.js)
 * @param {string} date - YYYY-MM-DD
 * @returns {object} compliance report
 * {
 *   moca:   { submitted: ['Hiếu'], missing: ['Tân'] },
 *   bc:     { submitted: ['Hiếu', 'Bety'], missing: ['Thảo'] },
 *   dongca: { submitted: ['Hiếu'], missing: [] },
 *   rate: 0.83  // 5/6 reports submitted
 * }
 */
function getComplianceReport(db, date) {
  // Get all active staff
  let activeStaff = [];
  try {
    activeStaff = db.prepare("SELECT * FROM staff WHERE status = 'active' ORDER BY name ASC").all() || [];
  } catch (e) {
    console.error('[Compliance] Failed to query active staff:', e.message);
    return { moca: { submitted: [], missing: [] }, bc: { submitted: [], missing: [] }, dongca: { submitted: [], missing: [] }, rate: 0 };
  }

  if (activeStaff.length === 0) {
    return { moca: { submitted: [], missing: [] }, bc: { submitted: [], missing: [] }, dongca: { submitted: [], missing: [] }, rate: 0 };
  }

  // Get all shift_reports for today
  let reports = [];
  try {
    reports = db.prepare("SELECT sr.*, s.name FROM shift_report sr JOIN staff s ON sr.staff_id = s.id WHERE sr.date = ?").all(date) || [];
  } catch (e) {
    console.error('[Compliance] Failed to query shift_report:', e.message);
  }

  // Group by report_type → set of staff names who submitted
  const submittedByType = { moca: new Set(), bc: new Set(), dongca: new Set() };
  for (const r of reports) {
    if (submittedByType[r.report_type] !== undefined) {
      submittedByType[r.report_type].add(r.name);
    }
  }

  const allNames = activeStaff.map(s => s.name);

  // Truong ca: expected to submit moca + dongca, NOT bc
  // Regular staff: expected to submit bc, NOT moca/dongca
  const truongCaNames = activeStaff.filter(s => s.class_role === 'truong_ca').map(s => s.name);
  const regularNames  = activeStaff.filter(s => s.class_role !== 'truong_ca').map(s => s.name);

  const moca   = { submitted: allNames.filter(n => submittedByType.moca.has(n)),   missing: truongCaNames.filter(n => !submittedByType.moca.has(n))   };
  const bc     = { submitted: allNames.filter(n => submittedByType.bc.has(n)),     missing: regularNames.filter(n => !submittedByType.bc.has(n))     };
  const dongca = { submitted: allNames.filter(n => submittedByType.dongca.has(n)), missing: truongCaNames.filter(n => !submittedByType.dongca.has(n)) };

  // Rate = expected reports submitted / total expected (truong_ca: 2, regular: 1)
  const expectedTotal = (truongCaNames.length * 2) + regularNames.length;
  const submitted = moca.submitted.length + bc.submitted.length + dongca.submitted.length;
  const rate = expectedTotal > 0 ? Math.round((submitted / expectedTotal) * 100) / 100 : 0;

  return { moca, bc, dongca, rate };
}

// ─── Revenue Query ────────────────────────────────────────────────────────────

/**
 * Get total revenue for a specific date from dongca shift_reports.
 * Revenue stored as JSON: { tienMat, chuyenKhoan, grab, total, inventory, note }
 */
function getRevenueForDate(db, date) {
  let rows = [];
  try {
    rows = db.prepare("SELECT report_data FROM shift_report WHERE report_type = 'dongca' AND date = ?").all(date) || [];
  } catch (e) {
    console.error('[Revenue] Failed to query:', e.message);
  }

  let tienMat = 0, chuyenKhoan = 0, grab = 0;
  for (const row of rows) {
    try {
      const data = JSON.parse(row.report_data || '{}');
      tienMat      += (data.tienMat      || data.cash     || 0);
      chuyenKhoan  += (data.chuyenKhoan  || data.transfer || 0);
      grab         += (data.grab         || 0);
    } catch (e) {
      // skip malformed JSON
    }
  }

  return { tienMat, chuyenKhoan, grab, total: tienMat + chuyenKhoan + grab };
}

/**
 * Get average total revenue over the past N days (not including today).
 */
function getAvgRevenue(db, beforeDate, days = 7) {
  const d = new Date(beforeDate);
  let sum = 0;
  let counted = 0;
  for (let i = 1; i <= days; i++) {
    const pastDate = new Date(d.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const rev = getRevenueForDate(db, pastDate);
    if (rev.total > 0) {
      sum += rev.total;
      counted++;
    }
  }
  return counted > 0 ? Math.round(sum / counted) : 0;
}

// ─── MVP Logic ────────────────────────────────────────────────────────────────

/**
 * Determine MVP staff for the day.
 * MVP = staff with most reports submitted today + submitted on time (earliest created_at).
 */
function getMvp(db, date, compliance) {
  // Count reports per staff name
  const countMap = {};
  for (const name of compliance.moca.submitted)   countMap[name] = (countMap[name] || 0) + 1;
  for (const name of compliance.bc.submitted)     countMap[name] = (countMap[name] || 0) + 1;
  for (const name of compliance.dongca.submitted) countMap[name] = (countMap[name] || 0) + 1;

  if (Object.keys(countMap).length === 0) return null;

  const maxCount = Math.max(...Object.values(countMap));
  const topCandidates = Object.keys(countMap).filter(n => countMap[n] === maxCount);

  // Break ties by earliest created_at (most punctual)
  if (topCandidates.length === 1) {
    return { name: topCandidates[0], count: maxCount, total: 3 };
  }

  // Query earliest report time among tied candidates
  try {
    const placeholders = topCandidates.map(() => '?').join(',');
    const row = db.prepare(`
      SELECT s.name, MIN(sr.created_at) as earliest
      FROM shift_report sr
      JOIN staff s ON sr.staff_id = s.id
      WHERE sr.date = ? AND s.name IN (${placeholders})
      GROUP BY s.name
      ORDER BY earliest ASC
      LIMIT 1
    `).get(date, ...topCandidates);
    if (row) return { name: row.name, count: maxCount, total: 3 };
  } catch (e) {
    // fallback
  }

  return { name: topCandidates[0], count: maxCount, total: 3 };
}

// ─── Scorecard Builder ────────────────────────────────────────────────────────

/**
 * Build the full daily scorecard message.
 */
async function buildDailyScorecardMessage(db, date) {
  const compliance = getComplianceReport(db, date);
  const revenue    = getRevenueForDate(db, date);
  const avgRevenue = getAvgRevenue(db, date, 7);
  const mvp        = getMvp(db, date, compliance);

  // ── Procurement ──
  let procItems = 0, procTotal = 0;
  try {
    const rows = db.prepare("SELECT price FROM procurement_log WHERE date = ?").all(date) || [];
    procItems = rows.length;
    procTotal = rows.reduce((sum, r) => sum + (r.price || 0), 0);
  } catch (e) { /* ignore */ }

  // ── Hủy hàng ──
  let huyHangRows = [];
  try {
    huyHangRows = db.prepare(`
      SELECT h.item, h.caused_by, s.name as staff_name
      FROM huy_hang_log h
      LEFT JOIN staff s ON h.staff_id = s.id
      WHERE h.date = ?
    `).all(date) || [];
  } catch (e) { /* ignore */ }

  // ── Đơn sai sót ──
  let donSaisotCount = 0;
  try {
    const row = db.prepare("SELECT COUNT(*) as cnt FROM don_saisot_log WHERE date = ?").get(date);
    donSaisotCount = row ? row.cnt : 0;
  } catch (e) { /* ignore */ }

  // ── Format sections ──
  const lines = [];

  // Header
  lines.push(`📊 BÁO CÁO NGÀY — ${formatDate(date)}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━`);

  // Báo cáo ca compliance
  const allMissing = [
    ...compliance.moca.missing.map(n => ({ type: 'Mở ca', name: n })),
    ...compliance.bc.missing.map(n => ({ type: 'Bàn giao', name: n })),
    ...compliance.dongca.missing.map(n => ({ type: 'Đóng ca', name: n })),
  ];

  // ✅ BÁO CÁO CA section
  lines.push('');
  lines.push('✅ BÁO CÁO CA:');

  // Mở ca
  if (compliance.moca.submitted.length > 0) {
    lines.push(`• Mở ca: ${compliance.moca.submitted.map(n => `${n} ✅`).join(' ')}`);
  } else {
    lines.push(`• Mở ca: (chưa có)`);
  }

  // Bàn giao
  if (compliance.bc.submitted.length > 0) {
    lines.push(`• Bàn giao: ${compliance.bc.submitted.map(n => `${n} ✅`).join(' ')}`);
  } else {
    lines.push(`• Bàn giao: (chưa có)`);
  }

  // Đóng ca
  if (compliance.dongca.submitted.length > 0) {
    lines.push(`• Đóng ca: ${compliance.dongca.submitted.map(n => `${n} ✅`).join(' ')}`);
  } else {
    lines.push(`• Đóng ca: (chưa có)`);
  }

  // ⚠️ CHƯA BÁO section (only if there are missing reports)
  const missingByType = {};
  for (const name of compliance.moca.missing)   { missingByType['Mở ca']    = (missingByType['Mở ca']    || []); missingByType['Mở ca'].push(name); }
  for (const name of compliance.bc.missing)     { missingByType['Bàn giao'] = (missingByType['Bàn giao'] || []); missingByType['Bàn giao'].push(name); }
  for (const name of compliance.dongca.missing) { missingByType['Đóng ca']  = (missingByType['Đóng ca']  || []); missingByType['Đóng ca'].push(name); }

  const hasMissing = Object.values(missingByType).some(arr => arr.length > 0);
  if (hasMissing) {
    lines.push('');
    lines.push('⚠️ CHƯA BÁO:');
    for (const [type, names] of Object.entries(missingByType)) {
      if (names.length > 0) {
        lines.push(`• ${type}: ${names.map(n => `${n} ❌`).join(' ')}`);
      }
    }
  }

  // 💰 DOANH THU
  lines.push('');
  lines.push('💰 DOANH THU:');
  lines.push(`• Tiền mặt: ${formatCurrency(revenue.tienMat)}`);
  lines.push(`• CK tại quán: ${formatCurrency(revenue.chuyenKhoan)}`);
  lines.push(`• Grab: ${formatCurrency(revenue.grab)}`);
  lines.push(`• TỔNG: ${formatCurrency(revenue.total)}`);

  // Compare vs average
  if (avgRevenue > 0) {
    const diff = revenue.total - avgRevenue;
    const pct  = Math.round((diff / avgRevenue) * 100);
    const sign = diff >= 0 ? '+' : '';
    const arrow = diff >= 0 ? '▲' : '▼';
    lines.push(`• vs 7 ngày qua: ${sign}${pct}% ${arrow}`);
  } else {
    lines.push(`• vs 7 ngày qua: N/A`);
  }

  // 📦 NHẬP HÀNG
  lines.push('');
  if (procItems > 0) {
    lines.push(`📦 NHẬP HÀNG: ${procItems} items — ${formatCurrency(procTotal)}`);
  } else {
    lines.push(`📦 NHẬP HÀNG: 0`);
  }

  // ⚠️ HỦY HÀNG
  if (huyHangRows.length > 0) {
    // Group by caused_by/staff_name
    const byStaff = {};
    for (const row of huyHangRows) {
      const who = row.caused_by || row.staff_name || 'Unknown';
      byStaff[who] = (byStaff[who] || 0) + 1;
    }
    const detail = Object.entries(byStaff).map(([n, c]) => `${n} x${c}`).join(', ');
    lines.push(`⚠️ HỦY HÀNG: ${huyHangRows.length} items (${detail})`);
  } else {
    lines.push(`⚠️ HỦY HÀNG: 0`);
  }

  // 🚫 ĐƠN SAI SÓT
  lines.push(`🚫 ĐƠN SAI SÓT: ${donSaisotCount}`);

  // 🔥 MVP
  lines.push('');
  if (mvp) {
    lines.push(`🔥 MVP HÔM NAY: ${mvp.name} (${mvp.count}/${mvp.total} báo cáo đúng giờ)`);
  } else {
    lines.push(`🔥 MVP HÔM NAY: —`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━`);

  return lines.join('\n');
}

// ─── Job Starter ──────────────────────────────────────────────────────────────

/**
 * Start the daily scorecard job.
 * Uses setInterval (every minute) to check if it's 22:30 ICT.
 * Uses firedJobs map to prevent double-firing on the same day.
 *
 * @param {TelegramBot} bot
 * @param {object} dbModule - the db module (from require('./db'))
 */
function startDailyScorecardJob(bot, dbModule, firedJobs) {
  if (!firedJobs) {
    firedJobs = new Map();
  }

  const TOPIC_ID = 172;

  const TARGET_HOUR   = 23;
  const TARGET_MINUTE = 33;

  setInterval(async () => {
    const { hours, minutes } = getIctTime();
    if (hours !== TARGET_HOUR || minutes !== TARGET_MINUTE) return;

    const date = getIctDate();
    const jobKey = `daily_scorecard_${date}`;
    if (firedJobs.get(jobKey)) return;
    firedJobs.set(jobKey, true);

    console.log(`[JOB] daily_scorecard firing for ${date}`);

    try {
      const rawDb = dbModule.getDb();
      const message = await buildDailyScorecardMessage(rawDb, date);
      await broadcastEvent(bot, 'daily_scorecard', message);
      console.log(`[JOB] daily_scorecard sent to MANAGERS group`);
    } catch (err) {
      console.error('[JOB] daily_scorecard error:', err.message);
      firedJobs.delete(jobKey); // allow retry next minute if error
    }
  }, 60 * 1000);

  console.log('[JOB] daily_scorecard scheduled — fires at 23:33 ICT');
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  startDailyScorecardJob,
  getComplianceReport,
  getRevenueForDate,
  buildDailyScorecardMessage,
};
