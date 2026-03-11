// commands/compositeall.js
// Ch11 — /compositeall — GM overview: all staff ranked by composite score
//
// Usage:
//   /compositeall           — page 1 (first 15 staff)
//   /compositeall 2         — page 2
//
// Display: ranked table with tier emoji, name, composite, individual/team/company
// GM/Creator only.

'use strict';

const { calcCompositeAll, calcCompany } = require('../modules/novaPerformance');

const PAGE_SIZE = 15;

// ─── Tier emoji ──────────────────────────────────────────────────────────────

const TIER_EMOJI = { S: '⚡', A: '🔥', B: '✅', C: '📈', D: '⚠️' };

// ─── Bar renderer (compact — 8 blocks for table view) ────────────────────────

function miniBar(score) {
  const filled = Math.round(Math.min(100, Math.max(0, score)) / 100 * 8);
  return '█'.repeat(filled) + '░'.repeat(8 - filled);
}

// ─── Format one row ──────────────────────────────────────────────────────────

function formatRow(entry, rank) {
  const emoji = TIER_EMOJI[entry.rank_tier] || '·';
  const name  = entry.name.length > 10 ? entry.name.slice(0, 9) + '…' : entry.name;
  return `${String(rank).padStart(2)}. ${emoji} ${name.padEnd(10)} ${miniBar(entry.composite)} ${String(entry.composite.toFixed(1)).padStart(5)}  (${String(entry.individual.toFixed(0)).padStart(2)}/${String(entry.team.toFixed(0)).padStart(2)}/${String(entry.company.toFixed(0)).padStart(2)})`;
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
    return bot.sendMessage(chatId, '❌ Chỉ GM và Creator mới xem được bảng tổng hợp.');
  }

  await bot.sendChatAction(chatId, 'typing');

  // ── Compute ─────────────────────────────────────────────────────────────
  const all = calcCompositeAll(db);

  if (!all.length) {
    return bot.sendMessage(chatId, '📊 Chưa có nhân viên nào trong hệ thống.');
  }

  // ── Pagination ──────────────────────────────────────────────────────────
  const totalPages = Math.ceil(all.length / PAGE_SIZE);
  const page       = Math.max(1, Math.min(totalPages, parseInt(args[0], 10) || 1));
  const start      = (page - 1) * PAGE_SIZE;
  const slice      = all.slice(start, start + PAGE_SIZE);

  // ── Company KPI summary ─────────────────────────────────────────────────
  const company = calcCompany(db);
  let companyLine = '';
  if (company.targets.length === 0) {
    companyLine = '🏢 Công ty: chưa đặt KPI tháng';
  } else {
    const hitCount = company.targets.filter(t => t.hit).length;
    companyLine = company.allHit
      ? '🏢 Công ty: ✅ tất cả KPI đạt — bonus chờ xác nhận'
      : `🏢 Công ty: ${hitCount}/${company.targets.length} KPI đạt`;
  }

  // ── Tier distribution ───────────────────────────────────────────────────
  const tierCount = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  for (const e of all) tierCount[e.rank_tier] = (tierCount[e.rank_tier] || 0) + 1;
  const tierSummary = Object.entries(tierCount)
    .filter(([, c]) => c > 0)
    .map(([t, c]) => `${TIER_EMOJI[t]}${t}:${c}`)
    .join('  ');

  // ── Average composite ───────────────────────────────────────────────────
  const avgComposite = (all.reduce((s, e) => s + e.composite, 0) / all.length).toFixed(1);

  // ── Build message ───────────────────────────────────────────────────────
  const header = [
    `📊 *Bảng xếp hạng hiệu suất*`,
    `${companyLine}`,
    `👥 ${all.length} nhân viên · Trung bình: ${avgComposite}`,
    `${tierSummary}`,
    ``,
    `\`#   Tier  Tên          Score     CN/Nhóm/CT\``,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ];

  const rows = slice.map((entry, i) => {
    const rank = start + i + 1;
    return `\`${formatRow(entry, rank)}\``;
  });

  const footer = [];
  if (totalPages > 1) {
    footer.push(``, `📄 Trang ${page}/${totalPages}${page < totalPages ? ` · /compositeall ${page + 1} →` : ''}`);
  }
  footer.push(``, `💡 /compositeview [tên] — xem chi tiết`);

  const text = [...header, ...rows, ...footer].join('\n');

  await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });

  console.log(`[compositeall] ${actor.name} viewed page ${page}/${totalPages} — ${all.length} staff, avg ${avgComposite}`);
}

module.exports = { handle };
