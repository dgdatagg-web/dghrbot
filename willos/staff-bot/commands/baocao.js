/**
 * baocao.js — /baocao command
 * Quản lý xem báo cáo team trong ngày
 * Permission: quanly / gm / creator
 */

'use strict';

const { canApprove } = require('../utils/roles');

// Department icons
const DEPT_ICON = {
  bep:  '🍳',
  bar:  '🍹',
  bida: '🎱',
  kho:  '📦',
};

function deptIcon(dept) {
  return DEPT_ICON[dept] || '👤';
}

/**
 * Get ICT (UTC+7) date string YYYY-MM-DD
 */
function getIctDate() {
  const now = new Date();
  const ict = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return ict.toISOString().split('T')[0];
}

/**
 * Format time HH:MM from datetime string, or '--'
 */
function fmtTime(dtStr) {
  if (!dtStr) return '--';
  // Convert UTC ISO datetime to ICT (UTC+7)
  if (dtStr.includes('T')) {
    const d = new Date(dtStr);
    const ict = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    return ict.toISOString().split('T')[1].slice(0, 5);
  }
  // Already HH:MM:SS format
  return dtStr.slice(0, 5);
}

/**
 * Format DD/MM/YYYY from YYYY-MM-DD
 */
function fmtDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Format number with thousands separator (Vietnamese style)
 */
function fmtMoney(n) {
  return (n || 0).toLocaleString('vi-VN') + 'đ';
}

// ─── Handle /baocao ──────────────────────────────────────────────────────────

async function handle(bot, msg, args, db) {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);

  // Permission check — role trong DB là source of truth (respects /setrole test mode)
  // env bypass chỉ áp dụng khi chưa có record trong DB
  const creatorIds = (process.env.CREATOR_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const gmIds = (process.env.GM_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const sender = db.getStaffByTelegramId(telegramId);
  const byEnv = !sender && (creatorIds.includes(telegramId) || gmIds.includes(telegramId));
  const byRole = sender && canApprove(sender.role);
  if (!byEnv && !byRole) {
    return bot.sendMessage(chatId, '❌ Lệnh này dành cho Quản lý / GM / Creator.');
  }

  const today = getIctDate();
  const nameArg = args[0]; // optional: /baocao [tên]

  // ── Detail mode: /baocao [tên] ──────────────────────────────────────────
  if (nameArg) {
    return handleDetail(bot, chatId, nameArg, today, db);
  }

  // ── Summary mode ─────────────────────────────────────────────────────────
  return handleSummary(bot, chatId, today, db);
}

// ─── Summary ─────────────────────────────────────────────────────────────────

async function handleSummary(bot, chatId, today, db) {
  const activeStaff  = db.getActiveStaff();          // excludes gm/creator
  const checkins     = db.getTodayCheckins(today);
  const reports      = db.getTodayShiftReports(today);
  const huyHang      = db.getTodayHuyHang(today);
  const donSaisot    = db.getTodayDonSaisot(today);

  // Build lookup sets
  const checkinMap = new Map(); // staffId → checkin row
  for (const c of checkins) {
    checkinMap.set(c.staff_id, c);
  }

  // shift_report grouped by staffId → { auto_moca, bc, auto_dongca }
  // Also track dept-level auto reports (auto_moca/auto_dongca are per-dept, not per-staff)
  const reportMap = new Map();
  // Dept-level auto open/close maps: dept → boolean
  const deptAutoMoca = {};
  const deptAutoDongca = {};

  for (const r of reports) {
    if (r.report_type === 'auto_moca') {
      try {
        const data = JSON.parse(r.report_data || '{}');
        if (data.dept) deptAutoMoca[data.dept] = true;
      } catch { }
      continue;
    }
    if (r.report_type === 'auto_dongca') {
      try {
        const data = JSON.parse(r.report_data || '{}');
        if (data.dept) deptAutoDongca[data.dept] = true;
      } catch { }
      continue;
    }
    // Other report types (bc, etc.)
    if (!reportMap.has(r.staff_id)) {
      reportMap.set(r.staff_id, {});
    }
    reportMap.get(r.staff_id)[r.report_type] = r;
  }

  // Split staff into checked-in / not checked-in
  const checkedIn  = [];
  const notCheckedIn = [];

  for (const s of activeStaff) {
    if (checkinMap.has(s.id)) {
      checkedIn.push(s);
    } else {
      notCheckedIn.push(s);
    }
  }

  // Sort checked-in by checkin_time
  checkedIn.sort((a, b) => {
    const ta = checkinMap.get(a.id)?.checkin_time || '';
    const tb = checkinMap.get(b.id)?.checkin_time || '';
    return ta.localeCompare(tb);
  });

  const lines = [];

  lines.push(`📋 BÁO CÁO NGÀY ${fmtDate(today)}`);
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  // ✅ Đã checkin
  lines.push(`✅ ĐÃ CHECKIN (${checkedIn.length} người):`);
  if (checkedIn.length === 0) {
    lines.push('  (chưa có ai)');
  } else {
    for (const s of checkedIn) {
      const c = checkinMap.get(s.id);
      const inTime  = fmtTime(c.checkin_time);
      const outTime = c.checkout_time ? fmtTime(c.checkout_time) : '--';
      const late    = c.late_minutes > 0 ? ` (+${c.late_minutes}p trễ)` : '';
      const icon    = deptIcon(s.department);

      // Location indicator
      let locPart = '';
      if (c.location_verified === 1) {
        locPart = ''; // verified — normal, no extra indicator
      } else if (c.lat != null) {
        // Has location but outside venue
        locPart = ` ❌ ngoài quán (~${c.distance_meters}m)`;
      } else {
        locPart = ' ⚠️ vị trí không xác định';
      }

      lines.push(`• ${s.name} ${icon} | Vào: ${inTime}${late} | Ra: ${outTime}${locPart}`);
    }
  }
  lines.push('');

  // ❌ Chưa checkin
  lines.push(`❌ CHƯA CHECKIN (${notCheckedIn.length} người):`);
  if (notCheckedIn.length === 0) {
    lines.push('  (tất cả đã checkin 🎉)');
  } else {
    for (const s of notCheckedIn) {
      lines.push(`• ${s.name} ${deptIcon(s.department)}`);
    }
  }
  lines.push('');

  // 📝 Báo cáo ca — only staff who checked in
  const staffWithReports = checkedIn.filter(s => reportMap.has(s.id));
  const staffNoReports   = checkedIn.filter(s => !reportMap.has(s.id));

  // Also include staff who filed reports but didn't checkin (edge case)
  const allReportStaffIds = new Set(reports.map(r => r.staff_id));
  const extraReporters = activeStaff.filter(
    s => allReportStaffIds.has(s.id) && !checkinMap.has(s.id)
  );

  const allShiftStaff = [...checkedIn, ...extraReporters];

  lines.push('📝 BÁO CÁO CA:');
  if (allShiftStaff.length === 0) {
    lines.push('  (chưa có báo cáo)');
  } else {
    for (const s of allShiftStaff) {
      const rmap = reportMap.get(s.id) || {};
      const dept = s.department || '';

      if (dept === 'bar') {
        // Bar: show BC status + handover only (no mở ca / đóng ca)
        const bc = rmap['bc'] ? '✅ BC' : '❌ BC';
        const handover = rmap['bc'] ? (() => {
          try { return JSON.parse(rmap['bc'].report_data).handover_to || '--'; }
          catch { return '--'; }
        })() : '--';
        lines.push(`• ${s.name} — ${bc} | 👤 ${handover}`);
      } else {
        const checkin = checkinMap.get(s.id);
        // Mở ca: auto_moca record HOẶC có checkin (fallback)
        const mocaOk = deptAutoMoca[dept] || !!checkin;
        // Đóng ca: auto_dongca record HOẶC có checkout
        const dongcaOk = deptAutoDongca[dept] || !!(checkin && checkin.checkout_time);
        const moca   = mocaOk   ? '✅ Mở ca'   : '❌ Mở ca';
        const bc     = rmap['bc'] ? '✅ BC'      : '❌ BC';
        const dongca = dongcaOk  ? '✅ Đóng ca' : '❌ Đóng ca';
        lines.push(`• ${s.name} — ${moca} | ${bc} | ${dongca}`);
      }
    }
  }
  lines.push('');

  // ⚠️ Alerts
  const alertLines = [];

  // Hủy hàng — group by staff
  if (huyHang.length > 0) {
    const byStaff = new Map();
    for (const h of huyHang) {
      const k = h.name || 'Không rõ';
      byStaff.set(k, (byStaff.get(k) || 0) + 1);
    }
    for (const [name, count] of byStaff.entries()) {
      alertLines.push(`• Hủy hàng: ${count} món (${name})`);
    }
  }

  // Đơn sai sót — group by order_type
  if (donSaisot.length > 0) {
    const byType = new Map();
    for (const d of donSaisot) {
      const k = d.order_type || 'Khác';
      byType.set(k, (byType.get(k) || 0) + 1);
    }
    for (const [type, count] of byType.entries()) {
      alertLines.push(`• Đơn sai sót: ${count} đơn ${type}`);
    }
  }

  if (alertLines.length > 0) {
    lines.push('⚠️ ALERTS:');
    lines.push(...alertLines);
    lines.push('');
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('💡 /baocao [tên] — xem chi tiết 1 người');

  return bot.sendMessage(chatId, lines.join('\n'));
}

// ─── Detail (1 người) ─────────────────────────────────────────────────────────

async function handleDetail(bot, chatId, nameArg, today, db) {
  const staff = db.getStaffByName(nameArg);
  if (!staff) {
    return bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên "${nameArg}".`);
  }

  const checkin = db.getTodayCheckin(staff.id, today);
  const reports = db.getTodayShiftReports(today).filter(r => r.staff_id === staff.id);
  const huyHang = db.getTodayHuyHang(today).filter(h => h.staff_id === staff.id);
  const donSaisot = db.getTodayDonSaisot(today).filter(d => d.staff_id === staff.id);

  const icon = deptIcon(staff.department);
  const lines = [];

  lines.push(`📋 CHI TIẾT — ${staff.name} ${icon}`);
  lines.push(`Ngày: ${fmtDate(today)}`);
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  // Checkin info
  if (checkin) {
    const late = checkin.late_minutes > 0 ? ` (trễ ${checkin.late_minutes}p)` : '';
    lines.push(`⏰ Checkin: ${fmtTime(checkin.checkin_time)}${late}`);
    lines.push(`🔚 Checkout: ${checkin.checkout_time ? fmtTime(checkin.checkout_time) : 'Chưa ra'}`);
  } else {
    lines.push('❌ Chưa checkin hôm nay');
  }
  lines.push('');

  // Shift reports
  const reportTypes = { auto_moca: '🌅 Mở ca', bc: '📝 Bàn giao', auto_dongca: '🌙 Đóng ca' };
  lines.push('📋 BÁO CÁO CA:');

  if (reports.length === 0) {
    // Check dept-level auto reports
    const deptReports = db.getTodayShiftReports(today).filter(r =>
      (r.report_type === 'auto_moca' || r.report_type === 'auto_dongca') &&
      (() => { try { return JSON.parse(r.report_data || '{}').dept === staff.department; } catch { return false; } })()
    );
    if (deptReports.length === 0) {
      lines.push('  (chưa có báo cáo)');
    } else {
      for (const r of deptReports) {
        const label = reportTypes[r.report_type] || r.report_type;
        lines.push(`${label}: ✅ (tự động)`);
      }
    }
  } else {
    const byType = {};
    for (const r of reports) byType[r.report_type] = r;

    // Also check dept auto reports
    const allReports = db.getTodayShiftReports(today);
    const dept = staff.department;
    for (const r of allReports) {
      if ((r.report_type === 'auto_moca' || r.report_type === 'auto_dongca')) {
        try {
          const data = JSON.parse(r.report_data || '{}');
          if (data.dept === dept) byType[r.report_type] = r;
        } catch { }
      }
    }

    for (const [type, label] of Object.entries(reportTypes)) {
      const r = byType[type];
      if (!r) {
        lines.push(`${label}: ❌ Chưa nộp`);
        continue;
      }
      const isAuto = type === 'auto_moca' || type === 'auto_dongca';
      lines.push(`${label}: ✅ ${isAuto ? '(tự động)' : fmtTime(r.created_at)}`);

      if (!isAuto) {
        try {
          const data = JSON.parse(r.report_data || '{}');
          const answers = data.answers || {};

          // Checklist
          if (answers.checklist) {
            const done = answers.checklist.done || [];
            const missing = answers.checklist.missing || [];
            if (done.length) lines.push(`  ✅ Đủ: ${done.join(', ')}`);
            if (missing.length) lines.push(`  ❌ Thiếu: ${missing.join(', ')}`);
          }
          // Cơm/mì
          if (answers.com_mi) lines.push(`  🍚 Cơm/mì: ${answers.com_mi}`);
          // Xuất kho
          if (answers.xuat_kho) lines.push(`  📦 Xuất kho: ${answers.xuat_kho}`);
          // Nhận hàng
          if (answers.nhan_hang) lines.push(`  📥 Nhận hàng: ${answers.nhan_hang}`);
          // Hủy hàng inline
          if (answers.huy_hang && answers.huy_hang.length > 0) {
            lines.push(`  ⚠️ Hủy hàng: ${answers.huy_hang.join(', ')}`);
          }
          // Đơn sai sót
          if (answers.don_saisot?.hasIssue) {
            lines.push(`  🚫 Sai sót: ${(answers.don_saisot.issues || []).join(', ') || 'có vấn đề'}`);
          }
          // Ghi chú tự do
          if (data.note) lines.push(`  📝 Note: ${data.note}`);
        } catch {
          const raw = String(r.report_data || '').slice(0, 200);
          if (raw) lines.push(`  ${raw}`);
        }
      }
    }
  }
  lines.push('');

  // Hủy hàng
  if (huyHang.length > 0) {
    lines.push(`⚠️ HỦY HÀNG (${huyHang.length} món):`);
    for (const h of huyHang) {
      lines.push(`  • ${h.item || '?'} — ${h.reason || 'không rõ lý do'}`);
    }
    lines.push('');
  }

  // Đơn sai sót
  if (donSaisot.length > 0) {
    lines.push(`⚠️ ĐƠN SAI SÓT (${donSaisot.length} đơn):`);
    for (const d of donSaisot) {
      lines.push(`  • ${d.order_type || '?'} #${d.order_id || 'N/A'} — ${d.issue || ''}`);
    }
    lines.push('');
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━');

  return bot.sendMessage(chatId, lines.join('\n'));
}

module.exports = { handle };
