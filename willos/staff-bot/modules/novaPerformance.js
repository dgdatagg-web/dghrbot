/**
 * novaPerformance.js — Composite Performance Calculator
 * Mission 009 — Ch13
 *
 * Formula: composite = (individual × 0.70) + (team × 0.20) + (company × 0.10)
 *
 * Individual score (0–100):
 *   - Attendance rate       (last 30 days checkins vs scheduled/expected)
 *   - BC submission rate    (shift reports vs checkin days)
 *   - Error rate            (don_saisot_log — lower is better)
 *   - EXP trajectory        (net EXP last 30 days — positive = good)
 *   - Streak                (consecutive clean days)
 *
 * Team score (0–100): department average of the 3 core individual sub-scores
 *   - Dept avg attendance rate
 *   - Dept avg BC compliance
 *   - Dept avg error rate
 *
 * Company score (0–100): % of company_kpi_targets with hit = 1
 *   - GM sets targets via /setcompanykpi
 *   - All staff share the same company score
 *   - Company 10% bonus multiplier: when ALL targets hit, bonus distributes
 *     to all active staff weighted by their composite ranking tier
 *
 * Exported functions:
 *   calcIndividual(staffId, db)        → { score, breakdown }
 *   calcTeam(deptId, db)               → { score, breakdown }
 *   calcCompany(db)                    → { score, allHit, targets }
 *   calcComposite(staffId, db)         → { composite, individual, team, company, breakdown }
 *   calcCompositeAll(db)               → Array<{ staffId, name, dept, composite, ... }>
 */

'use strict';

const WEIGHTS = { individual: 0.70, team: 0.20, company: 0.10 };

// ─── Time helpers ──────────────────────────────────────────────────────────────

function ictNow() {
  return new Date(Date.now() + 7 * 3600000);
}

function daysAgo(n) {
  const d = ictNow();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

// ─── Individual score ─────────────────────────────────────────────────────────

/**
 * Returns a 0–100 individual score + per-metric breakdown for one staff member.
 * Uses last 30 days of data.
 */
function calcIndividual(staffId, db) {
  const raw = db.getDb();
  const since = daysAgo(30);

  // 1. Attendance rate — checkin days / 30 (capped at 1)
  const checkinDays = raw.prepare(`
    SELECT COUNT(DISTINCT date) AS cnt
    FROM checkin_log
    WHERE staff_id = ? AND date >= ?
  `).get(staffId, since)?.cnt || 0;

  const attendanceRate = Math.min(1, checkinDays / 30);

  // 2. BC submission rate — shift_report 'bc' days / checkin days
  const bcDays = raw.prepare(`
    SELECT COUNT(DISTINCT date) AS cnt
    FROM shift_report
    WHERE staff_id = ? AND report_type = 'bc' AND date >= ?
  `).get(staffId, since)?.cnt || 0;

  const bcRate = checkinDays > 0 ? Math.min(1, bcDays / checkinDays) : 1;

  // 3. Error rate — don_saisot_log entries. 0 errors = 100 score.
  //    Each error reduces score by 10 points, floored at 0.
  const errors = raw.prepare(`
    SELECT COUNT(*) AS cnt
    FROM don_saisot_log
    WHERE staff_id = ? AND date >= ?
  `).get(staffId, since)?.cnt || 0;

  const errorScore = Math.max(0, 1 - (errors * 0.10));

  // 4. EXP trajectory — net EXP last 30 days. Normalise to 0–1.
  //    +200 net = full score. Negative = proportional reduction. Clamp [0,1].
  const expNet = raw.prepare(`
    SELECT COALESCE(SUM(delta), 0) AS net
    FROM exp_log
    WHERE staff_id = ? AND created_at >= datetime(?, 'start of day')
  `).get(staffId, since)?.net || 0;

  const expScore = Math.min(1, Math.max(0, (expNet + 200) / 400));

  // 5. Streak — staff.streak column (consecutive clean days, maintained by db)
  const staff = raw.prepare(`SELECT streak FROM staff WHERE id = ?`).get(staffId);
  const streak = staff?.streak || 0;
  // 30+ days = full score. Linear below that.
  const streakScore = Math.min(1, streak / 30);

  // Weighted sub-scores (within individual component)
  const individual = (
    (attendanceRate * 0.30) +
    (bcRate         * 0.25) +
    (errorScore     * 0.20) +
    (expScore       * 0.15) +
    (streakScore    * 0.10)
  ) * 100;

  return {
    score: Math.round(individual * 10) / 10,
    breakdown: {
      attendance:   { rate: Math.round(attendanceRate * 100), days: checkinDays, weight: '30%' },
      bc_rate:      { rate: Math.round(bcRate * 100), days_submitted: bcDays, weight: '25%' },
      error_rate:   { errors, score: Math.round(errorScore * 100), weight: '20%' },
      exp_trajectory: { net: expNet, score: Math.round(expScore * 100), weight: '15%' },
      streak:       { days: streak, score: Math.round(streakScore * 100), weight: '10%' },
    },
  };
}

// ─── Team score ───────────────────────────────────────────────────────────────

/**
 * Returns 0–100 team score for a department, averaging 3 core metrics across
 * all active staff in that dept. Returns null if dept has no active staff.
 */
function calcTeam(deptId, db) {
  const raw   = db.getDb();
  const since = daysAgo(30);

  // Get all active staff in the department
  const members = raw.prepare(`
    SELECT id FROM staff
    WHERE status = 'active' AND department = ?
  `).all(deptId);

  if (!members.length) return { score: 0, breakdown: { members: 0, dept: deptId } };

  const ids       = members.map(m => m.id);
  const placeholders = ids.map(() => '?').join(',');

  // Dept avg attendance
  const deptCheckinRows = raw.prepare(`
    SELECT staff_id, COUNT(DISTINCT date) AS cnt
    FROM checkin_log
    WHERE staff_id IN (${placeholders}) AND date >= ?
    GROUP BY staff_id
  `).all(...ids, since);

  const checkinMap = Object.fromEntries(deptCheckinRows.map(r => [r.staff_id, r.cnt]));
  const avgAttendance = ids.reduce((s, id) => s + Math.min(1, (checkinMap[id] || 0) / 30), 0) / ids.length;

  // Dept avg BC compliance
  const deptBcRows = raw.prepare(`
    SELECT staff_id, COUNT(DISTINCT date) AS cnt
    FROM shift_report
    WHERE staff_id IN (${placeholders}) AND report_type = 'bc' AND date >= ?
    GROUP BY staff_id
  `).all(...ids, since);

  const bcMap = Object.fromEntries(deptBcRows.map(r => [r.staff_id, r.cnt]));
  const avgBc = ids.reduce((s, id) => {
    const c = checkinMap[id] || 0;
    const b = bcMap[id] || 0;
    return s + (c > 0 ? Math.min(1, b / c) : 1);
  }, 0) / ids.length;

  // Dept avg error rate
  const deptErrorRows = raw.prepare(`
    SELECT staff_id, COUNT(*) AS cnt
    FROM don_saisot_log
    WHERE staff_id IN (${placeholders}) AND date >= ?
    GROUP BY staff_id
  `).all(...ids, since);

  const errMap = Object.fromEntries(deptErrorRows.map(r => [r.staff_id, r.cnt]));
  const avgErrorScore = ids.reduce((s, id) => s + Math.max(0, 1 - ((errMap[id] || 0) * 0.10)), 0) / ids.length;

  // Team score: equal thirds across the 3 metrics
  const team = (
    (avgAttendance * 0.34) +
    (avgBc         * 0.33) +
    (avgErrorScore * 0.33)
  ) * 100;

  return {
    score: Math.round(team * 10) / 10,
    breakdown: {
      members:         ids.length,
      dept:            deptId,
      avg_attendance:  Math.round(avgAttendance * 100),
      avg_bc_rate:     Math.round(avgBc * 100),
      avg_error_score: Math.round(avgErrorScore * 100),
    },
  };
}

// ─── Company score ────────────────────────────────────────────────────────────

/**
 * Returns 0–100 company score based on company_kpi_targets.
 * Score = (targets hit / total targets) × 100.
 * allHit = true only when every target has hit = 1.
 */
function calcCompany(db) {
  const raw = db.getDb();

  const targets = raw.prepare(`
    SELECT kpi_key, target_value, current_value, hit
    FROM company_kpi_targets
    ORDER BY id
  `).all();

  if (!targets.length) {
    return { score: 0, allHit: false, targets: [], note: 'no_targets_set' };
  }

  const hitCount = targets.filter(t => t.hit === 1).length;
  const score    = Math.round((hitCount / targets.length) * 100);
  const allHit   = hitCount === targets.length;

  return {
    score,
    allHit,
    targets: targets.map(t => ({
      kpi_key:       t.kpi_key,
      target_value:  t.target_value,
      current_value: t.current_value,
      hit:           t.hit === 1,
    })),
  };
}

// ─── Composite ────────────────────────────────────────────────────────────────

/**
 * Full composite score for one staff member.
 * composite = (individual × 0.70) + (team × 0.20) + (company × 0.10)
 *
 * Returns:
 *   composite   — final weighted score (0–100, 1 decimal)
 *   individual  — { score, breakdown }
 *   team        — { score, breakdown }
 *   company     — { score, allHit, targets }
 *   rank_tier   — 'S' | 'A' | 'B' | 'C' | 'D'
 */
function calcComposite(staffId, db) {
  const staff = db.getDb().prepare(`SELECT id, name, department FROM staff WHERE id = ?`).get(staffId);
  if (!staff) return null;

  const indiv   = calcIndividual(staffId, db);
  const team    = calcTeam(staff.department, db);
  const company = calcCompany(db);

  const composite = (
    (indiv.score   * WEIGHTS.individual) +
    (team.score    * WEIGHTS.team)       +
    (company.score * WEIGHTS.company)
  );

  const rounded = Math.round(composite * 10) / 10;

  return {
    composite:  rounded,
    rank_tier:  rankTier(rounded),
    individual: indiv,
    team,
    company,
  };
}

// ─── Composite — all staff ────────────────────────────────────────────────────

/**
 * Runs calcComposite for every active staff member.
 * Returns array sorted by composite DESC.
 * Used by /compositeall and the company bonus multiplier.
 */
function calcCompositeAll(db) {
  const allStaff = db.getAllActiveStaff();
  const company  = calcCompany(db);     // compute once, shared by all

  // Pre-compute team scores per dept to avoid N×dept queries
  const deptCache = {};

  const results = allStaff.map(s => {
    const dept = s.department || 'unknown';

    if (!deptCache[dept]) {
      deptCache[dept] = calcTeam(dept, db);
    }

    const indiv = calcIndividual(s.id, db);
    const team  = deptCache[dept];

    const composite = Math.round((
      (indiv.score   * WEIGHTS.individual) +
      (team.score    * WEIGHTS.team)       +
      (company.score * WEIGHTS.company)
    ) * 10) / 10;

    return {
      staffId:   s.id,
      name:      s.name,
      dept:      dept,
      composite,
      rank_tier: rankTier(composite),
      individual: indiv.score,
      team:       team.score,
      company:    company.score,
      breakdown: {
        individual: indiv.breakdown,
        team:       team.breakdown,
      },
    };
  });

  return results.sort((a, b) => b.composite - a.composite);
}

// ─── Rank tier ────────────────────────────────────────────────────────────────

/**
 * S: 90–100   — Elite
 * A: 75–89    — Strong
 * B: 60–74    — Solid
 * C: 45–59    — Developing
 * D: 0–44     — Needs attention
 */
function rankTier(score) {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

// ─── Company bonus distribution ───────────────────────────────────────────────

/**
 * Called when ALL company KPI targets are hit (allHit = true).
 * Distributes a bonus pool weighted by composite rank tier.
 *
 * Tier weights: S=5, A=4, B=3, C=2, D=1
 *
 * Returns array of { staffId, name, tier, bonusPct } — percentages of the pool.
 * Caller decides the actual VND pool size.
 */
function calcCompanyBonusDistribution(db) {
  const company = calcCompany(db);
  if (!company.allHit) return { allHit: false, distribution: [] };

  const ranked = calcCompositeAll(db);

  const TIER_WEIGHT = { S: 5, A: 4, B: 3, C: 2, D: 1 };

  const totalWeight = ranked.reduce((s, r) => s + (TIER_WEIGHT[r.rank_tier] || 1), 0);

  const distribution = ranked.map(r => {
    const w      = TIER_WEIGHT[r.rank_tier] || 1;
    const bonusPct = totalWeight > 0 ? (w / totalWeight) * 100 : 0;
    return {
      staffId:  r.staffId,
      name:     r.name,
      tier:     r.rank_tier,
      composite: r.composite,
      bonusPct: Math.round(bonusPct * 100) / 100,
    };
  });

  return { allHit: true, distribution };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  calcIndividual,
  calcTeam,
  calcCompany,
  calcComposite,
  calcCompositeAll,
  calcCompanyBonusDistribution,
  rankTier,
  WEIGHTS,
};
