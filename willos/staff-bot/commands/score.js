// commands/score.js
// Ch10 — /score — Staff composite performance view
//
// Usage:
//   /score               — own score (any staff)
//   /score [tên]         — another staff's score (GM/Creator only)
//
// Display: 3 layers
//   L1 — headline: name, rank tier, composite score
//   L2 — 70/20/10 bar breakdown: individual / team / company
//   L3 — individual sub-score detail: attendance, BC, errors, EXP, streak
//
// Bar scale: 12 blocks, filled = Math.round(score / 100 * 12)

'use strict';

const { calcComposite } = require('../modules/novaPerformance');

// ─── Bar renderer ─────────────────────────────────────────────────────────────

function bar(score) {
  const filled = Math.round(Math.min(100, Math.max(0, score)) / 100 * 12);
  return '█'.repeat(filled) + '░'.repeat(12 - filled);
}

// ─── Tier label ───────────────────────────────────────────────────────────────

const TIER_LABEL = {
  S: '⚡ Tier S — Xuất sắc',
  A: '🔥 Tier A — Mạnh',
  B: '✅ Tier B — Ổn định',
  C: '📈 Tier C — Đang phát triển',
  D: '⚠️ Tier D — Cần cải thiện',
};

// ─── Format composite message ─────────────────────────────────────────────────

function formatScore(name, result, isSelf) {
  const { composite, rank_tier, individual, team, company } = result;
  const bd = individual.breakdown;

  // ── Layer 1 — Headline ───────────────────────────────────────────────────
  const intro = isSelf
    ? `📊 *Điểm hiệu suất của bạn*`
    : `📊 *Điểm hiệu suất — ${name}*`;

  const headline = `${intro}\n${TIER_LABEL[rank_tier]}  |  *${composite} / 100*\n`;

  // ── Layer 2 — 70/20/10 breakdown ─────────────────────────────────────────
  const l2 = [
    `*Chỉ số tổng hợp (30 ngày gần nhất)*`,
    `👤 Cá nhân   ${String(individual.score.toFixed(1)).padStart(5)}  ${bar(individual.score)}  (70%)`,
    `👥 Nhóm      ${String(team.score.toFixed(1)).padStart(5)}  ${bar(team.score)}  (20%)`,
    `🏢 Công ty   ${String(company.score.toFixed(1)).padStart(5)}  ${bar(company.score)}  (10%)`,
  ].join('\n');

  // ── Layer 3 — Individual sub-score detail ────────────────────────────────
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

  // ── Company note ──────────────────────────────────────────────────────────
  let companyNote = '';
  if (company.targets.length === 0) {
    companyNote = `\n_Công ty chưa đặt KPI tháng — điểm công ty tính là 0._`;
  } else if (company.allHit) {
    companyNote = `\n🎉 _Tất cả KPI công ty đã đạt — bonus đang chờ xác nhận._`;
  } else {
    const hitCount = company.targets.filter(t => t.hit).length;
    companyNote = `\n_KPI công ty: ${hitCount}/${company.targets.length} mục đạt._`;
  }

  return `${headline}\n${l2}\n\n${l3}${companyNote}`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

async function handle(bot, msg, args, db) {
  const chatId     = msg.chat.id;
  const telegramId = String(msg.from.id);
  const actor      = db.getStaffByTelegramId(telegramId);

  if (!actor) {
    return bot.sendMessage(chatId, '❌ Bạn chưa đăng ký trong hệ thống. Dùng /dangky để bắt đầu.');
  }

  // ── Resolve target staff ──────────────────────────────────────────────────
  let target  = actor;
  let isSelf  = true;

  if (args && args.length > 0) {
    // Only GM/Creator can query others
    if (!['gm', 'creator'].includes(actor.role)) {
      return bot.sendMessage(chatId, '❌ Chỉ GM và Creator mới xem được điểm của người khác.');
    }

    const name = args.join(' ').trim();
    const found = db.getStaffByName(name);

    if (!found) {
      return bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên "${name}".`);
    }

    target = found;
    isSelf = target.id === actor.id;
  }

  // ── Compute ───────────────────────────────────────────────────────────────
  await bot.sendChatAction(chatId, 'typing');

  const result = calcComposite(target.id, db);

  if (!result) {
    return bot.sendMessage(chatId, `❌ Không thể tính điểm cho "${target.name}". Kiểm tra lại dữ liệu.`);
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  const text = formatScore(target.name, result, isSelf);

  await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });

  console.log(`[score] ${actor.name} queried ${isSelf ? 'own' : target.name + '\'s'} score — composite: ${result.composite} tier: ${result.rank_tier}`);
}

module.exports = { handle };
