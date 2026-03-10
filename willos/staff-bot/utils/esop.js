'use strict';

/**
 * utils/esop.js — ESOP EXP Pool calculator
 *
 * The 10% ESOP pool = 1,000,000,000 EXP points.
 * Each active staff member's share = their_exp / total_active_exp × 10%
 *
 * Rules:
 *   - Only active staff count in the pool denominator
 *   - Fired staff are excluded — their % redistributes to remaining active staff
 *   - Historical EXP counts 1:1
 *   - Rehire = start fresh (exp reset to 0), unless GM/Creator grants 50% retain
 */

const POOL_TOTAL_EXP  = 1_000_000_000; // 1 billion EXP = 10% equity
const EQUITY_PCT      = 10;            // % of company equity the pool represents

/**
 * Get total EXP across all active non-GM/Creator staff.
 */
function getTotalActiveExp(db) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(exp), 0) AS total
    FROM staff
    WHERE status = 'active'
      AND role NOT IN ('gm', 'creator')
      AND exp > 0
  `).get();
  return row?.total || 0;
}

/**
 * Calculate one staff member's pool stats.
 * Returns { exp, totalExp, sharePct, equityPct, estimatedValue }
 */
function calcPoolShare(staffExp, totalActiveExp, companyValuation = null) {
  if (!totalActiveExp || totalActiveExp <= 0) {
    return { sharePct: 0, equityPct: 0, estimatedValue: null };
  }

  // Share of the 1B EXP pool
  const sharePct   = (staffExp / POOL_TOTAL_EXP) * 100;
  // Share of 10% equity
  const equityPct  = (staffExp / totalActiveExp) * EQUITY_PCT;

  let estimatedValue = null;
  if (companyValuation && companyValuation > 0) {
    estimatedValue = Math.floor((equityPct / 100) * companyValuation);
  }

  return { sharePct, equityPct, estimatedValue };
}

/**
 * Get company valuation from bot_settings.
 * Returns number or null.
 */
function getCompanyValuation(db) {
  const row = db.prepare(`SELECT value FROM bot_settings WHERE key = 'company_valuation'`).get();
  if (!row) return null;
  const n = parseInt(row.value, 10);
  return isNaN(n) ? null : n;
}

/**
 * Set company valuation in bot_settings.
 */
function setCompanyValuation(db, value) {
  const ict = new Date(Date.now() + 7 * 3600000).toISOString();
  db.prepare(`
    INSERT INTO bot_settings (key, value, updated_at)
    VALUES ('company_valuation', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(String(value), ict);
}

/**
 * Full pool snapshot — all active staff with their share.
 * Used by /viewpool (GM/Creator).
 */
function getFullPoolSnapshot(db) {
  const totalExp    = getTotalActiveExp(db);
  const valuation   = getCompanyValuation(db);
  const activeStaff = db.prepare(`
    SELECT id, name, username, role, exp, department
    FROM staff
    WHERE status = 'active'
      AND role NOT IN ('gm', 'creator')
      AND exp > 0
    ORDER BY exp DESC
  `).all();

  return activeStaff.map(s => ({
    ...s,
    ...calcPoolShare(s.exp, totalExp, valuation),
    totalExp,
  }));
}

/**
 * Format VND
 */
function fmtVND(n) {
  return Number(n).toLocaleString('vi-VN') + '₫';
}

/**
 * Format pool % — 4 decimal places
 */
function fmtPct(n) {
  return n.toFixed(4) + '%';
}

module.exports = {
  POOL_TOTAL_EXP,
  EQUITY_PCT,
  getTotalActiveExp,
  calcPoolShare,
  getCompanyValuation,
  setCompanyValuation,
  getFullPoolSnapshot,
  fmtVND,
  fmtPct,
};
