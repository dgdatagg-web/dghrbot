/**
 * format.js — Message formatting utilities
 * WillOS Staff RPG Bot
 */

const { getRoleInfo, getNextRole, getSopAccess, PERMISSIONS } = require('./roles');
const { formatExpBar } = require('./exp');

const SEP = '━━━━━━━━━━━━━━━━━━━━';
const SEP_SHORT = '━━━━━━━━━━━━━';

/**
 * Format date DD/MM/YYYY
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Parse promoted_dates JSON safely
 */
function parsePromotedDates(promotedDatesStr) {
  try {
    return JSON.parse(promotedDatesStr || '{}');
  } catch {
    return {};
  }
}

/**
 * Format character sheet (/profile)
 */
function formatProfile(staff) {
  const role = getRoleInfo(staff.role);
  const promotedDates = parsePromotedDates(staff.promoted_dates);
  const promotedDate = promotedDates[staff.role];
  const { next, expNeeded } = getNextRole(staff.role, staff.exp);
  const nextRole = next ? getRoleInfo(next) : null;
  const perms = PERMISSIONS[staff.role] || {};

  let lines = [];

  // ── Header ───────────────────────────────────────────────────────────────
  lines.push(`${role.icon} ${staff.name} — ${role.label}`);
  if (staff.full_name) lines.push(`👤 Tên thật: ${staff.full_name}`);
  if (staff.username)  lines.push(`📱 Username: ${staff.username}`);
  lines.push(SEP);

  // ── Stats ─────────────────────────────────────────────────────────────────
  lines.push(`⚡ EXP: ${formatExpBar(staff.exp, staff.role)}`);
  lines.push(`📅 Ngày vào: ${formatDate(staff.joined_date)}`);
  if (promotedDate) {
    lines.push(`🏆 ${role.label} từ: ${formatDate(promotedDate)}`);
  }
  lines.push(`🔥 Streak: ${staff.streak} ngày`);

  // ── Next level (Newbie & Nhân viên — motivational) ────────────────────────
  if (['newbie', 'nhanvien'].includes(staff.role)) {
    lines.push(SEP);
    if (nextRole && expNeeded > 0) {
      lines.push(`🎯 Còn ${expNeeded} EXP → ${nextRole.icon} ${nextRole.label}`);
    }
    return lines.join('\n');
  }

  // ── Trưởng ca ─────────────────────────────────────────────────────────────
  if (staff.role === 'truong_ca') {
    lines.push(SEP);
    lines.push('📋 NHIỆM VỤ');
    lines.push(`${perms.ghi_nhan_kpi ? '✅' : '🔒'} Ghi nhận KPI`);
    lines.push(`${perms.xem_bao_cao_ca ? '✅' : '🔒'} Xem báo cáo ca`);
    lines.push(SEP);
    if (nextRole && expNeeded > 0) {
      lines.push(`🎯 Còn ${expNeeded} EXP → ${nextRole.icon} ${nextRole.label}`);
    }
    return lines.join('\n');
  }

  // ── Quản lý ───────────────────────────────────────────────────────────────
  if (staff.role === 'quanly') {
    lines.push(SEP);
    lines.push('📋 QUYỀN HẠN');
    lines.push(`${perms.ghi_nhan_kpi ? '✅' : '🔒'} Ghi nhận KPI`);
    lines.push(`${perms.xem_sop_day_du ? '✅' : '🔒'} Xem SOP đầy đủ`);
    lines.push(`${perms.xem_bao_cao_ca ? '✅' : '🔒'} Xem báo cáo ca`);
    lines.push(`${perms.duyet_nhan_vien ? '✅' : '🔒'} Duyệt nhân viên mới`);
    lines.push(SEP);
    lines.push(`🎯 Quản lý — cấp cao nhất nhân viên`);
    return lines.join('\n');
  }

  // ── GM / Creator — full view ──────────────────────────────────────────────
  lines.push(SEP);
  lines.push('📋 QUYỀN HẠN');
  lines.push(`✅ Ghi nhận KPI`);
  lines.push(`✅ Xem SOP đầy đủ`);
  lines.push(`✅ Xem báo cáo ca`);
  lines.push(`✅ Duyệt nhân viên mới`);
  lines.push(`✅ Xem tài chính`);
  lines.push(SEP);
  lines.push('📖 SOP ACCESS');
  lines.push(`• Checklist mở/đóng bếp ${getSopAccess(staff.role, 'mo_dong_bep')}`);
  lines.push(`• QC vệ sinh ${getSopAccess(staff.role, 'qc_ve_sinh')}`);
  lines.push(`• Xử lý complaint ${getSopAccess(staff.role, 'xu_ly_complaint')}`);
  lines.push(`• Nhập hàng ${getSopAccess(staff.role, 'nhap_hang')}`);
  lines.push(`• Tài chính ${getSopAccess(staff.role, 'tai_chinh')}`);
  lines.push(SEP);
  lines.push(`🎯 ${role.label} — God mode activated`);

  return lines.join('\n');
}

/**
 * Format checkin response
 */
function formatCheckin(staff, expDelta, newExp) {
  const role = getRoleInfo(staff.role);
  const expBar = formatExpBar(newExp, staff.role);
  const isTruongCa = staff.class_role === 'truong_ca' || ['gm', 'creator'].includes(staff.role);

  const tasks = ['• Bàn giao ca /bc'];
  if (isTruongCa) {
    tasks.unshift('• Báo mở ca /moca (nếu chưa có)');
    tasks.push('• Đóng ca /dongca');
  }

  return [
    `✅ ${staff.name} đã vào ca!`,
    SEP_SHORT,
    '📋 TASK HÔM NAY:',
    ...tasks,
    SEP_SHORT,
    `⭐ ${role.icon} ${role.label} | EXP: ${expBar}${expDelta !== 0 ? ` (+${expDelta})` : ''}`,
    `🔥 Streak: ${staff.streak} ngày liên tục`,
  ].join('\n');
}

/**
 * Format checkout response
 */
function formatCheckout(staff, checkinTime) {
  const role = getRoleInfo(staff.role);
  const now = new Date();
  const checkin = new Date(checkinTime);
  const diffMs = now - checkin;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  return [
    `👋 ${staff.name} đã kết thúc ca!`,
    SEP_SHORT,
    `⏱ Thời gian làm việc: ${hours}h ${minutes}p`,
    `${role.icon} ${role.label} | EXP: ${formatExpBar(staff.exp, staff.role)}`,
    SEP_SHORT,
    'Nghỉ ngơi tốt nhé! 🌙',
  ].join('\n');
}

/**
 * Format leaderboard
 */
function formatLeaderboard(staffList) {
  if (!staffList || staffList.length === 0) {
    return '📊 Chưa có dữ liệu leaderboard.';
  }

  const medals = ['🥇', '🥈', '🥉'];
  const lines = ['🏆 LEADERBOARD — DG GROUP', SEP];

  staffList.forEach((s, i) => {
    const role = getRoleInfo(s.role);
    const medal = medals[i] || `${i + 1}.`;
    lines.push(`${medal} ${role.icon} ${s.name} — ${s.exp} EXP`);
  });

  lines.push(SEP);
  lines.push(`📅 Cập nhật: ${new Date().toLocaleDateString('vi-VN')}`);

  return lines.join('\n');
}

/**
 * Format level-up notification
 */
function formatLevelUp(name, oldRole, newRole) {
  const old = getRoleInfo(oldRole);
  const next = getRoleInfo(newRole);
  return [
    `🎉 LEVEL UP! 🎉`,
    `${old.icon} ${old.label} → ${next.icon} ${next.label}`,
    ``,
    `Chúc mừng ${name}! Bạn đã lên rank ${next.label}!`,
    `Quyền hạn mới đã được mở khóa. Dùng /profile để xem.`,
  ].join('\n');
}

/**
 * Format pending approval notification for group topic
 */
function formatPendingApproval(staff) {
  return [
    `🔔 YÊU CẦU PHÊ DUYỆT NHÂN VIÊN MỚI`,
    SEP_SHORT,
    `👤 Tên: ${staff.name}`,
    `🛡️ Role xin: Quản lý`,
    `📅 Đăng ký: ${formatDate(new Date().toISOString().split('T')[0])}`,
    `🆔 Telegram ID: ${staff.telegram_id}`,
    SEP_SHORT,
    `Vui lòng duyệt hoặc từ chối:`,
  ].join('\n');
}

/**
 * Format EXP log entry
 */
function formatExpChange(staffName, delta, reason, newExp, role) {
  const sign = delta >= 0 ? '+' : '';
  const roleInfo = getRoleInfo(role);
  return [
    `${delta >= 0 ? '⬆️' : '⬇️'} EXP Update: ${staffName}`,
    `${sign}${delta} EXP — ${reason}`,
    `${roleInfo.icon} Tổng: ${newExp} EXP`,
  ].join('\n');
}

module.exports = {
  formatProfile,
  formatCheckin,
  formatCheckout,
  formatLeaderboard,
  formatLevelUp,
  formatPendingApproval,
  formatExpChange,
  formatDate,
  formatExpBar,
  SEP,
  SEP_SHORT,
};
