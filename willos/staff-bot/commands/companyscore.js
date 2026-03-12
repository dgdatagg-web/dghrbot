/**
 * companyscore.js — /companyscore [kpi_key] [giá trị mới]
 * View company KPI progress, or update a KPI's current score.
 *
 * Usage:
 *   /companyscore                    → view all company KPIs + progress
 *   /companyscore [key] [value]      → update current_value for a KPI
 *
 * Access:
 *   View: all staff
 *   Update: creator / gm only
 */

'use strict';

const { calcCompany } = require('../modules/novaPerformance');
const { broadcastEvent } = require('../utils/groups');

function fmtVND(n) {
  return Number(n).toLocaleString('vi-VN') + '₫';
}

const SUGGESTED_KPIS = [
  { key: 'revenue_monthly',     unit: '₫' },
  { key: 'customer_rating',     unit: '/5' },
  { key: 'staff_retention',     unit: '%' },
  { key: 'attendance_rate',     unit: '%' },
  { key: 'bc_compliance',       unit: '%' },
  { key: 'error_rate_target',   unit: 'lần/tháng' },
  { key: 'prep_quality',        unit: '%' },
];

function formatVal(key, value) {
  const kpi = SUGGESTED_KPIS.find(k => k.key === key);
  if (kpi && kpi.unit === '₫') return fmtVND(value);
  if (kpi && kpi.unit === '%') return value + '%';
  return String(value) + (kpi ? ' ' + kpi.unit : '');
}

function progressBar(current, target) {
  const pct = target > 0 ? Math.min(1, current / target) : 0;
  const filled = Math.round(pct * 12);
  const empty = 12 - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty) + ` ${Math.round(pct * 100)}%`;
}

async function handle(bot, msg, args, db) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);

  const staff = db.getStaffByTelegramId(telegramId);
  if (!staff) return bot.sendMessage(chatId, '❌ Bạn chưa đăng ký.');

  // ── Update mode: /companyscore [key] [value] ──
  if (args && args.length >= 2) {
    if (!['gm', 'creator'].includes(staff.role)) {
      return bot.sendMessage(chatId, '❌ Chỉ GM và Creator mới cập nhật được KPI.');
    }

    const key = args[0].toLowerCase();
    const rawValue = args.slice(1).join('').replace(/[,.\s₫%]/g, '');
    const value = parseFloat(rawValue);

    if (isNaN(value)) {
      return bot.sendMessage(chatId, `❌ Giá trị không hợp lệ: "${args.slice(1).join(' ')}"`);
    }

    const result = db.updateCompanyKpiScore(key, value);
    if (!result) {
      return bot.sendMessage(chatId,
        `❌ Không tìm thấy KPI: "${key}"\n` +
        `Dùng /setcompanykpi để tạo KPI trước.`
      );
    }

    const hitMsg = result.hit ? '🎉 ĐẠT MỤC TIÊU!' : `⏳ ${formatVal(key, value)} / ${formatVal(key, result.targetValue)}`;

    const updateMsg =
      `📊 CẬP NHẬT KPI\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📌 ${key}\n` +
      `${progressBar(value, result.targetValue)}\n` +
      `${hitMsg}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Cập nhật bởi: ${staff.name}`;

    await bot.sendMessage(chatId, updateMsg);

    // If KPI just got hit, broadcast celebration
    if (result.hit) {
      // Check if ALL KPIs are now hit
      const companyScore = calcCompany(db);
      if (companyScore.allHit) {
        const celebMsg =
          `🎉🎉🎉 TẤT CẢ KPI CÔNG TY — ĐẠT!\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Điểm công ty: ${companyScore.score}/100\n` +
          `Tổng KPI đạt: ${companyScore.targets.length}/${companyScore.targets.length}\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🏆 Company bonus multiplier ACTIVATED!\n` +
          `Toàn bộ nhân viên sẽ nhận thưởng theo composite ranking.`;

        await broadcastEvent(bot, 'important', celebMsg).catch(() => {});
      } else {
        await broadcastEvent(bot, 'important', updateMsg).catch(() => {});
      }
    }
    return;
  }

  // ── View mode: /companyscore ──
  const targets = db.getCompanyKpiTargets();

  if (targets.length === 0) {
    return bot.sendMessage(chatId,
      `📊 KPI CÔNG TY\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Chưa có KPI nào được đặt.\n\n` +
      (['gm', 'creator'].includes(staff.role)
        ? `Dùng /setcompanykpi để đặt mục tiêu.`
        : `Liên hệ GM để đặt mục tiêu.`)
    );
  }

  const hitCount = targets.filter(t => t.hit === 1).length;
  const allHit = hitCount === targets.length;
  const companyPct = Math.round((hitCount / targets.length) * 100);

  let text =
    `📊 KPI CÔNG TY\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Điểm tổng: ${companyPct}% (${hitCount}/${targets.length} đạt)\n`;

  if (allHit) {
    text += `🎉 TẤT CẢ ĐẠT — Bonus multiplier ACTIVE!\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  targets.forEach((t, i) => {
    const current = t.current_value || 0;
    const status = t.hit ? '✅' : '⏳';
    text += `${status} ${t.kpi_key}\n`;
    text += `   ${progressBar(current, t.target_value)}\n`;
    text += `   ${formatVal(t.kpi_key, current)} / ${formatVal(t.kpi_key, t.target_value)}`;
    if (t.period) text += ` — ${t.period}`;
    text += '\n\n';
  });

  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  if (['gm', 'creator'].includes(staff.role)) {
    text += `Cập nhật: /companyscore [key] [giá trị]\n`;
    text += `Thêm KPI: /setcompanykpi`;
  }

  return bot.sendMessage(chatId, text);
}

module.exports = { handle };
