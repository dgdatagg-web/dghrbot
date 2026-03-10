/**
 * tongquan.js — /tongquan command
 * GM / Creator executive overview
 * Permission: gm / creator only
 */

'use strict';

/**
 * Get ICT (UTC+7) date string YYYY-MM-DD
 */
function getIctDate() {
  const now = new Date();
  const ict = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return ict.toISOString().split('T')[0];
}

/**
 * Format DD/MM/YYYY HH:MM (ICT)
 */
function fmtNow() {
  const now = new Date();
  const ict = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const dd = String(ict.getUTCDate()).padStart(2, '0');
  const mm = String(ict.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = ict.getUTCFullYear();
  const hh = String(ict.getUTCHours()).padStart(2, '0');
  const min = String(ict.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

/**
 * Format number with thousands separator (Vietnamese)
 */
function fmtMoney(n) {
  return (n || 0).toLocaleString('vi-VN') + 'đ';
}

// ─── Permission helpers ───────────────────────────────────────────────────────

function isGmOrCreator(role) {
  return role === 'gm' || role === 'creator';
}

function isPrivilegedByEnv(telegramId) {
  const creatorIds = (process.env.CREATOR_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const gmIds      = (process.env.GM_IDS      || '').split(',').map(s => s.trim()).filter(Boolean);
  return creatorIds.includes(telegramId) || gmIds.includes(telegramId);
}

// ─── Handle /tongquan ─────────────────────────────────────────────────────────

async function handle(bot, msg, args, db) {
  const chatId    = msg.chat.id;
  const telegramId = String(msg.from.id);

  // Permission check:
  // - If staff exists in DB → use their actual role (respects /setrole test mode)
  // - If not in DB → fall back to env CREATOR_IDS / GM_IDS
  const sender = db.getStaffByTelegramId(telegramId);
  const byEnv  = !sender && isPrivilegedByEnv(telegramId);
  const byRole = sender && isGmOrCreator(sender.role);

  if (!byEnv && !byRole) {
    return bot.sendMessage(chatId, '❌ Lệnh này chỉ dành cho GM / Creator.');
  }

  const today = getIctDate();

  // ── Pull data ───────────────────────────────────────────────────────────
  const activeStaff  = db.getActiveStaff();    // excludes gm/creator
  const checkins     = db.getTodayCheckins(today);
  const reports      = db.getTodayShiftReports(today);
  const huyHang      = db.getTodayHuyHang(today);
  const donSaisot    = db.getTodayDonSaisot(today);
  const revenue      = db.getTodayDongcaRevenue(today); // null if no dongca
  const topStreaks   = db.getTopStreaks(5);

  // ── Derived stats ────────────────────────────────────────────────────────
  const totalStaff     = activeStaff.length;
  const checkinIds     = new Set(checkins.map(c => c.staff_id));
  const checkinCount   = activeStaff.filter(s => checkinIds.has(s.id)).length;

  // "Đang ca" = checked-in and NOT yet checked-out
  const onShiftCount   = checkins.filter(c => !c.checkout_time).length;

  // Report counts by type
  // auto_moca and auto_dongca are dept-level, so count unique depts
  const deptAutoMoca   = new Set();
  const deptAutoDongca = new Set();
  const reportByType = { bc: new Set() };

  for (const r of reports) {
    if (r.report_type === 'auto_moca') {
      try {
        const data = JSON.parse(r.report_data || '{}');
        if (data.dept) deptAutoMoca.add(data.dept);
      } catch { }
    } else if (r.report_type === 'auto_dongca') {
      try {
        const data = JSON.parse(r.report_data || '{}');
        if (data.dept) deptAutoDongca.add(data.dept);
      } catch { }
    } else if (r.report_type === 'bc') {
      reportByType.bc.add(r.staff_id);
    }
  }

  // Count unique depts that have checked in today
  const deptCheckinSet = new Set(
    checkins.map(c => c.department).filter(Boolean)
  );
  const deptCount = deptCheckinSet.size || 1;

  // Fallback: if no auto_moca records, count depts that have checkins as "opened"
  // (for staff who checked in before GPS/auto-shift feature was live)
  const deptCheckedInNotBar = new Set(
    checkins.map(c => c.department).filter(d => d && d !== 'bar')
  );
  for (const dept of deptCheckedInNotBar) {
    if (!deptAutoMoca.has(dept)) deptAutoMoca.add(dept);
  }
  // Fallback dongca: dept where all checked-in staff have checked out
  for (const dept of deptCheckedInNotBar) {
    if (!deptAutoDongca.has(dept)) {
      const deptCheckins = checkins.filter(c => c.department === dept);
      const allOut = deptCheckins.length > 0 && deptCheckins.every(c => c.checkout_time);
      if (allOut) deptAutoDongca.add(dept);
    }
  }

  const mocaCount   = deptAutoMoca.size;
  const bcCount     = reportByType.bc.size; // unique staff who submitted BC
  const shiftBase   = checkins.length || 0; // all staff who actually checked in today
  const dongcaCount = deptAutoDongca.size;

  // ── Needs attention ───────────────────────────────────────────────────────
  const notCheckedIn   = activeStaff.filter(s => !checkinIds.has(s.id));
  const huyHangCount   = huyHang.length;
  const donSaisotCount = donSaisot.length;

  // ── Build message ─────────────────────────────────────────────────────────
  const lines = [];

  lines.push(`📊 TỔNG QUAN — ${fmtNow()}`);
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  // 👥 Nhân sự
  lines.push('👥 NHÂN SỰ');
  lines.push(`• Tổng: ${totalStaff} nhân viên active`);
  lines.push(`• Hôm nay: ${checkinCount}/${totalStaff} đã checkin`);
  lines.push(`• Đang ca: ${onShiftCount} người`);
  lines.push('');

  // 📋 Báo cáo hôm nay
  lines.push('📋 BÁO CÁO HÔM NAY');
  const mocaStatus   = mocaCount   >= deptCount && deptCount > 0 ? '✅' : (mocaCount   > 0 ? '⚠️' : '❌');
  const bcStatus     = bcCount     >= shiftBase && shiftBase > 0 ? '✅' : (bcCount     > 0 ? '⚠️' : '❌');
  const dongcaStatus = dongcaCount >= deptCount && deptCount > 0 ? '✅' : (dongcaCount > 0 ? '⚠️' : '❌');
  lines.push(`• Mở ca: ${mocaCount}/${deptCount} bộ phận ${mocaStatus}`);
  lines.push(`• Bàn giao: ${bcCount}/${shiftBase} ${bcStatus}`);
  lines.push(`• Đóng ca: ${dongcaCount}/${deptCount} bộ phận ${dongcaStatus}`);
  lines.push('');

  // ⚠️ Cần xử lý
  const needsAttention = [];
  if (notCheckedIn.length > 0) {
    const names = notCheckedIn.map(s => s.name).join(', ');
    needsAttention.push(`• ${notCheckedIn.length} nhân viên chưa checkin (${names})`);
  }
  if (huyHangCount > 0) {
    needsAttention.push(`• ${huyHangCount} món hủy hàng`);
  }
  if (donSaisotCount > 0) {
    needsAttention.push(`• Đơn sai sót: ${donSaisotCount}`);
  }

  if (needsAttention.length > 0) {
    lines.push('⚠️ CẦN XỬ LÝ');
    lines.push(...needsAttention);
    lines.push('');
  } else {
    lines.push('✅ Không có vấn đề cần xử lý');
    lines.push('');
  }

  // 💰 Doanh thu
  lines.push('💰 DOANH THU HÔM NAY (từ đóng ca)');
  if (revenue) {
    lines.push(`• Tiền mặt: ${fmtMoney(revenue.cash)} | Chuyển khoản: ${fmtMoney(revenue.transfer)} | Grab: ${fmtMoney(revenue.grab)}`);
    lines.push(`• Tổng: ${fmtMoney(revenue.total)}`);
  } else {
    lines.push('• Tiền mặt: 0đ | Chuyển khoản: 0đ | Grab: 0đ');
    lines.push('• Tổng: 0đ (chưa có báo cáo đóng ca)');
  }
  lines.push('');

  // 🏆 Top streak
  if (topStreaks.length > 0) {
    lines.push('🏆 TOP STREAK TUẦN NÀY');
    topStreaks.forEach((s, i) => {
      const fire = s.streak >= 7 ? ' 🔥' : '';
      lines.push(`• ${i + 1}. ${s.name} — ${s.streak} ngày${fire}`);
    });
    lines.push('');
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push(`Cập nhật: ${fmtNow()}`);

  return bot.sendMessage(chatId, lines.join('\n'));
}

module.exports = { handle };
