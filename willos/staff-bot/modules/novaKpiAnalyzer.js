/**
 * novaKpiAnalyzer.js — Data-driven KPI profile and milestone generator
 *
 * Reads all report tables to build a behavioral profile per staff member.
 * Identifies top weak patterns, generates 2–3 targeted milestone specs.
 * Results written to esop_kpi_config / esop_kpi_scores as pending_review.
 *
 * Minimum data gate: 20 checkin records required before analysis runs.
 *
 * Pattern types detected:
 *   1. tardiness       — chronic late arrivals
 *   2. no_bc           — BC report submission failures
 *   3. absence         — unexplained absences / no-shows
 *   4. waste           — huy_hang entries (avoidable waste)
 *   5. order_errors    — don_saisot_log entries
 *   6. low_consistency — irregular checkin frequency vs scheduled
 *   7. high_performer  — already solid across all — gets stretch goals
 */

'use strict';

const MIN_CHECKINS = 20; // data gate

// ─── Scoring weights ──────────────────────────────────────────────────────────
// Each pattern contributes a 0–100 "problem score". Higher = more severe.

function buildProfile(staffId, db) {
  const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];

  // ── 1. Checkin data ───────────────────────────────────────────────────────
  const allCheckins = db.getDb().prepare(`
    SELECT checkin_time, checkout_time, late_minutes, date
    FROM checkin_log
    WHERE staff_id = ?
    ORDER BY date DESC
    LIMIT 90
  `).all(staffId) || [];

  if (allCheckins.length < MIN_CHECKINS) {
    return { insufficient: true, checkins: allCheckins.length };
  }

  const lateCheckins  = allCheckins.filter(c => (c.late_minutes || 0) > 5);
  const tardiness_pct = allCheckins.length > 0
    ? (lateCheckins.length / allCheckins.length) * 100
    : 0;

  const avgLateMinutes = lateCheckins.length > 0
    ? lateCheckins.reduce((s, c) => s + (c.late_minutes || 0), 0) / lateCheckins.length
    : 0;

  // ── 2. BC reports ──────────────────────────────────────────────────────────
  // Days with checkins vs days with BC submitted
  const checkinDates = [...new Set(allCheckins.map(c => c.date))];
  const bcDates = db.getDb().prepare(`
    SELECT DISTINCT date FROM shift_report
    WHERE staff_id = ? AND report_type = 'bc'
    AND date >= date('now', '-90 days')
  `).all(staffId).map(r => r.date) || [];

  const bcSetDates = new Set(bcDates);
  const missedBc   = checkinDates.filter(d => !bcSetDates.has(d)).length;
  const bc_miss_pct = checkinDates.length > 0
    ? (missedBc / checkinDates.length) * 100
    : 0;

  // ── 3. No-shows / absences ─────────────────────────────────────────────────
  const noShows = db.getDb().prepare(`
    SELECT COUNT(*) as cnt FROM exp_log
    WHERE staff_id = ? AND reason LIKE '%no-show%'
    AND created_at >= datetime('now', '-90 days')
  `).get(staffId)?.cnt || 0;

  // ── 4. Waste log ───────────────────────────────────────────────────────────
  const wasteCount = db.getDb().prepare(`
    SELECT COUNT(*) as cnt FROM huy_hang_log
    WHERE staff_id = ?
    AND date >= date('now', '-90 days')
  `).get(staffId)?.cnt || 0;

  // ── 5. Order errors ────────────────────────────────────────────────────────
  const orderErrors = db.getDb().prepare(`
    SELECT COUNT(*) as cnt FROM don_saisot_log
    WHERE staff_id = ?
    AND date >= date('now', '-90 days')
  `).get(staffId)?.cnt || 0;

  // ── 6. EXP trend ──────────────────────────────────────────────────────────
  const recentExp = db.getDb().prepare(`
    SELECT delta, reason FROM exp_log
    WHERE staff_id = ?
    AND created_at >= datetime('now', '-30 days')
    ORDER BY created_at ASC
  `).all(staffId) || [];

  const expGains     = recentExp.filter(e => e.delta > 0).reduce((s, e) => s + e.delta, 0);
  const expLosses    = recentExp.filter(e => e.delta < 0).reduce((s, e) => s + e.delta, 0);
  const expNetRecent = expGains + expLosses;

  return {
    insufficient: false,
    checkins: allCheckins.length,
    tardiness_pct,
    avg_late_minutes: Math.round(avgLateMinutes),
    bc_miss_pct,
    missed_bc: missedBc,
    total_bc_days: checkinDates.length,
    no_shows: noShows,
    waste_count: wasteCount,
    order_errors: orderErrors,
    exp_net_recent: expNetRecent,
    exp_gains: expGains,
    exp_losses: expLosses,
  };
}

// ─── Pattern detection ─────────────────────────────────────────────────────────

function detectPatterns(profile) {
  const patterns = [];

  if (profile.tardiness_pct >= 30) {
    patterns.push({
      key: 'tardiness',
      severity: Math.min(100, Math.round(profile.tardiness_pct)),
      label: 'Đi trễ thường xuyên',
      detail: `${Math.round(profile.tardiness_pct)}% ca bị trễ, trung bình ${profile.avg_late_minutes} phút`,
    });
  }

  if (profile.bc_miss_pct >= 25) {
    patterns.push({
      key: 'no_bc',
      severity: Math.min(100, Math.round(profile.bc_miss_pct)),
      label: 'Thiếu báo cáo bàn giao ca',
      detail: `Bỏ ${profile.missed_bc}/${profile.total_bc_days} ca báo cáo (${Math.round(profile.bc_miss_pct)}%)`,
    });
  }

  if (profile.no_shows >= 3) {
    patterns.push({
      key: 'absence',
      severity: Math.min(100, profile.no_shows * 20),
      label: 'Vắng mặt không báo',
      detail: `${profile.no_shows} lần no-show trong 90 ngày gần nhất`,
    });
  }

  if (profile.waste_count >= 3) {
    patterns.push({
      key: 'waste',
      severity: Math.min(100, profile.waste_count * 15),
      label: 'Hủy hàng nhiều',
      detail: `${profile.waste_count} lần hủy hàng trong 90 ngày`,
    });
  }

  if (profile.order_errors >= 3) {
    patterns.push({
      key: 'order_errors',
      severity: Math.min(100, profile.order_errors * 20),
      label: 'Lỗi đơn hàng',
      detail: `${profile.order_errors} lỗi đơn trong 90 ngày`,
    });
  }

  if (profile.exp_net_recent < -50) {
    patterns.push({
      key: 'exp_decline',
      severity: Math.min(100, Math.abs(profile.exp_net_recent)),
      label: 'EXP đang giảm',
      detail: `${profile.exp_net_recent} EXP net trong 30 ngày gần nhất`,
    });
  }

  // Sort by severity descending — worst first
  patterns.sort((a, b) => b.severity - a.severity);
  return patterns;
}

// ─── KPI milestone generation ──────────────────────────────────────────────────

function generateKpiTargets(staffId, profile, patterns, deptId) {
  if (patterns.length === 0) {
    // High performer — stretch goals
    return [
      {
        kpi_key:  `stretch_mentor_${staffId}`,
        label:    'Mentor mục tiêu — đưa 1 Newbie lên Nhân viên',
        weight:   1.0,
        basis:    'high_performer',
        target:   '1 Newbie được mentor lên Nhân viên trong 60 ngày',
      },
      {
        kpi_key:  `stretch_consistency_${staffId}`,
        label:    'Duy trì streak 30 ngày liên tiếp',
        weight:   0.8,
        basis:    'high_performer',
        target:   'Streak ≥ 30 ngày không gián đoạn',
      },
    ];
  }

  // Take top 2–3 patterns
  const selected = patterns.slice(0, 3);

  return selected.map(p => {
    switch (p.key) {

      case 'tardiness':
        return {
          kpi_key: `punctuality_${staffId}`,
          label:   'Đúng giờ liên tiếp',
          weight:  1.0,
          basis:   p.detail,
          target:  'Check-in đúng giờ (< 5 phút trễ) trong 20 ca liên tiếp',
        };

      case 'no_bc':
        return {
          kpi_key: `bc_rate_${staffId}`,
          label:   'Tỷ lệ nộp báo cáo ca',
          weight:  1.0,
          basis:   p.detail,
          target:  'BC submission rate ≥ 95% trong 60 ngày liên tiếp',
        };

      case 'absence':
        return {
          kpi_key: `attendance_${staffId}`,
          label:   'Không vắng không báo',
          weight:  1.0,
          basis:   p.detail,
          target:  '0 no-show trong 60 ngày — nếu cần nghỉ thì báo trước',
        };

      case 'waste':
        return {
          kpi_key: `waste_reduction_${staffId}`,
          label:   'Giảm hủy hàng',
          weight:  0.8,
          basis:   p.detail,
          target:  `Giảm 50% so với 90 ngày trước — từ ${profile.waste_count} xuống ≤ ${Math.ceil(profile.waste_count / 2)} lần trong 90 ngày`,
        };

      case 'order_errors':
        return {
          kpi_key: `order_quality_${staffId}`,
          label:   'Giảm lỗi đơn hàng',
          weight:  0.8,
          basis:   p.detail,
          target:  `0 lỗi đơn trong 45 ngày liên tiếp`,
        };

      case 'exp_decline':
        return {
          kpi_key: `exp_recovery_${staffId}`,
          label:   'Phục hồi EXP',
          weight:  0.6,
          basis:   p.detail,
          target:  `EXP net dương trong 30 ngày tới — cộng nhiều hơn trừ`,
        };

      default:
        return null;
    }
  }).filter(Boolean);
}

// ─── Main analysis run ─────────────────────────────────────────────────────────

function runAnalysis(db) {
  const staff = db.getAllActiveStaff();
  const results = [];

  for (const member of staff) {
    const profile  = buildProfile(member.id, db);
    if (profile.insufficient) {
      results.push({ staffId: member.id, name: member.name, status: 'insufficient_data', checkins: profile.checkins });
      continue;
    }

    const patterns = detectPatterns(profile);
    const deptId   = member.department || 'dept_ops';
    const targets  = generateKpiTargets(member.id, profile, patterns, deptId);

    // Write pending KPI suggestions to DB
    for (const t of targets) {
      try {
        db.upsertKpiConfig(deptId, t.kpi_key, `[PENDING] ${t.label}`, t.weight, 0);
      } catch (err) {
        console.warn(`[KPI] upsert skipped for ${member.name}:`, err.message);
      }
    }

    results.push({
      staffId:  member.id,
      name:     member.name,
      status:   patterns.length === 0 ? 'high_performer' : 'patterns_found',
      checkins: profile.checkins,
      patterns: patterns.map(p => p.key),
      targets:  targets.map(t => t.label),
    });
  }

  return results;
}

// ─── /reviewkpis command ───────────────────────────────────────────────────────

async function handleReview(bot, msg, args, db) {
  const chatId     = msg.chat.id;
  const telegramId = String(msg.from.id);
  const actor      = db.getStaffByTelegramId(telegramId);

  if (!actor || !['gm', 'creator'].includes(actor.role)) {
    return bot.sendMessage(chatId, '❌ Chỉ GM và Creator.');
  }

  await bot.sendMessage(chatId, '⏳ Đang phân tích dữ liệu...');

  const results = runAnalysis(db);

  if (!results.length) {
    return bot.sendMessage(chatId, '📭 Chưa có đủ dữ liệu để phân tích.');
  }

  const insufficient = results.filter(r => r.status === 'insufficient_data');
  const analyzed     = results.filter(r => r.status !== 'insufficient_data');
  const highPerf     = analyzed.filter(r => r.status === 'high_performer');
  const hasPatterns  = analyzed.filter(r => r.status === 'patterns_found');

  let out = `📊 *Phân tích KPI — ${new Date().toLocaleDateString('vi-VN')}*\n\n`;

  if (insufficient.length) {
    out += `⏳ *Chưa đủ dữ liệu (< 20 ca):*\n`;
    out += insufficient.map(r => `• ${r.name} (${r.checkins} ca)`).join('\n');
    out += '\n\n';
  }

  if (highPerf.length) {
    out += `🌟 *Hiệu suất tốt — mục tiêu mở rộng:*\n`;
    out += highPerf.map(r => `• ${r.name}`).join('\n');
    out += '\n\n';
  }

  if (hasPatterns.length) {
    out += `🎯 *Cần cải thiện:*\n`;
    for (const r of hasPatterns) {
      out += `\n*${r.name}* (${r.checkins} ca)\n`;
      out += `Vấn đề: ${r.patterns.join(', ')}\n`;
      out += r.targets.map(t => `  → ${t}`).join('\n');
    }
  }

  out += `\n\nKPI suggestions đã ghi vào DB với tag [PENDING]. Dùng /approvekpi [tên] để duyệt.`;

  // Split if too long
  if (out.length > 3900) {
    const chunks = out.match(/[\s\S]{1,3900}/g) || [out];
    for (const chunk of chunks) {
      await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' });
    }
  } else {
    await bot.sendMessage(chatId, out, { parse_mode: 'Markdown' });
  }
}

module.exports = { buildProfile, detectPatterns, generateKpiTargets, runAnalysis, handleReview };
