// commands/compositeview.js
// Ch11 — /compositeview [tên] — Deep composite performance view for one staff
//
// Usage:
//   /compositeview Hiếu     — view Hiếu's full composite breakdown
//
// Display: same 3-layer structure as /score, oriented as GM tool.
// Shows rank position among all staff.
// GM/Creator only.

'use strict';

const { calcComposite, calcCompositeAll } = require('../modules/novaPerformance');

// ─── Bar renderer ─────────────────────────────────────────────────────────────

function bar(score) {
  const filled = Math.round(Math.min(100, Math.max(0, score)) / 100 * 12);
  return '█'.repeat(filled) + '░'.repeat(12 - filled);
}

// ─── Tier labels ──────────────────────────────────────────────────────────────

const TIER_LABEL = {
  S: '⚡ Tier S — Xuất sắc',
  A: '🔥 Tier A — Mạnh',
  B: '✅ Tier B — Ổn định',
  C: '📈 Tier C — Đang phát triển',
  D: '⚠️ Tier D — Cần cải thiện',
};

// ─── Format deep view ─────────────────────────────────────────────────────────

function formatView(name, dept, rankPos, totalStaff, result) {
  const { composite, rank_tier, individual, team, company } = result;
  const bd = individual.breakdown;

  // ── Layer 1 — Headline ──────────────────────────────────────────────────
  const headline = [
    `📊 *Hiệu suất — ${name}*`,
    `${TIER_LABEL[rank_tier]}  |  *${composite} / 100*`,
    `🏅 Rank: #${rankPos} / ${totalStaff}${dept ? `  ·  ${dept}` : ''}`,
  ].join('\n');

  // ── Layer 2 — 70/20/10 breakdown ───────────────────────────────────────
  const l2 = [
    `*Chỉ số tổng hợp (30 ngày gần nhất)*`,
    `👤 Cá nhân   ${String(individual.score.toFixed(1)).padStart(5)}  ${bar(individual.score)}  (70%)`,
    `👥 Nhóm      ${String(team.score.toFixed(1)).padStart(5)}  ${bar(team.score)}  (20%)`,
    `🏢 Công ty   ${String(company.score.toFixed(1)).padStart(5)}  ${bar(company.score)}  (10%)`,
  ].join('\n');

  // ── Layer 3 — Individual sub-score detail ──────────────────────────────
  const attRate  = bd.attendance.rate;
  const bcRate   = bd.bc_rate.rate;
  const errScore = bd.error_rate.score;
  const expScore = bd.exp_trajectory.score;
  const strScore = bd.streak.score;

  const attDetail  = `${bd.attendance.days} ca / 30 ngày`;
  const bcDetail   = bd.bc_rate.days_submitted < bd.attendance.days
    ? `${bd.bc_rate.days_submitted}/${bd.attendance.days} ngày nộp`
    : `đủ báo cáo`;
  const errDetail  = bd.error_rate.errors === 0
    ? `0 lỗi ✓`
    : `${bd.error_rate.errors} lỗi`;
  const expDetail  = bd.exp_trajectory.net >= 0
    ? `+${bd.exp_trajectory.net} EXP`
    : `${bd.exp_trajectory.net} EXP`;
  const strDetail  = `${bd.streak.days} ngày liên tiếp`;

  const l3 = [
    `*Chi tiết cá nhân*`,
    `Chuyên cần   ${String(attRate).padStart(3)}%  ${bar(attRate)}  (${attDetail})`,
    `Báo cáo ca   ${String(bcRate).padStart(3)}%  ${bar(bcRate)}  (${bcDetail})`,
    `Lỗi đơn     ${String(errScore).padStart(3)}%  ${bar(errScore)}  (${errDetail})`,
    `EXP          ${String(expScore).padStart(3)}%  ${bar(expScore)}  (${expDetail})`,
    `Streak       ${String(strScore).padStart(3)}%  ${bar(strScore)}  (${strDetail})`,
  ].join('\n');

  // ── Layer 4 — Team context ─────────────────────────────────────────────
  const tb = team.breakdown;
  const l4 = [
    `*Nhóm (${tb.dept || 'N/A'} — ${tb.members} thành viên)*`,
    `Chuyên cần TB   ${String(tb.avg_attendance).padStart(3)}%  ${bar(tb.avg_attendance)}`,
    `BC compliance    ${String(tb.avg_bc_rate).padStart(3)}%  ${bar(tb.avg_bc_rate)}`,
    `Error rate TB    ${String(tb.avg_error_score).padStart(3)}%  ${bar(tb.avg_error_score)}`,
  ].join('\n');

  // ── Company note ────────────────────────────────────────────────────────
  let companyNote = '';
  if (company.targets.length === 0) {
    companyNote = `_Công ty chưa đặt KPI tháng — điểm công ty tính là 0._`;
  } else if (company.allHit) {
    companyNote = `🎉 _Tất cả KPI công ty đã đạt — bonus đang chờ xác nhận._`;
  } else {
    const hitCount = company.targets.filter(t => t.hit).length;
    companyNote = `_KPI công ty: ${hitCount}/${company.targets.length} mục đạt._`;
  }

  return `${headline}\n\n${l2}\n\n${l3}\n\n${l4}\n\n${companyNote}`;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

async function handle(bot, msg, args, db) {
  const chatId     = msg.chat.id;
  const telegramId = String(msg.from.id);
  const actor      = db.getStaffByTelegramId(telegramId);

  if (!actor) {
    return bot.sendMessage(chatId, '❌ Bạn chưa đăng ký trong hệ thống.');
  }

  if (!['gm', 'creator'].includes(actor.role)) {
    return bot.sendMessage(chatId, '❌ Chỉ GM và Creator mới xem được chi tiết hiệu suất.');
  }

  // ── Require name argument ───────────────────────────────────────────────
  if (!args || args.length === 0) {
    return bot.sendMessage(chatId, '📋 Cách dùng: /compositeview [tên nhân viên]\n\nVí dụ: /compositeview Hiếu');
  }

  const name = args.join(' ').trim();
  const target = db.getStaffByName(name);

  if (!target) {
    return bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên "${name}".`);
  }

  await bot.sendChatAction(chatId, 'typing');

  // ── Compute ─────────────────────────────────────────────────────────────
  const result = calcComposite(target.id, db);

  if (!result) {
    return bot.sendMessage(chatId, `❌ Không thể tính điểm cho "${target.name}". Kiểm tra lại dữ liệu.`);
  }

  // ── Find rank position ──────────────────────────────────────────────────
  const all = calcCompositeAll(db);
  const rankPos    = all.findIndex(e => e.staffId === target.id) + 1;
  const totalStaff = all.length;

  // ── Dept display name ───────────────────────────────────────────────────
  const deptDisplay = (target.department || '').replace('dept_', '').replace(/_/g, ' ');

  // ── Send ────────────────────────────────────────────────────────────────
  const text = formatView(target.name, deptDisplay, rankPos, totalStaff, result);

  await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });

  console.log(`[compositeview] ${actor.name} viewed ${target.name} — composite: ${result.composite} rank: #${rankPos}/${totalStaff}`);
}

module.exports = { handle };
