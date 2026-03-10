/**
 * roles.js — Role thresholds, icons, permissions
 * WillOS Staff RPG Bot
 */

const ROLES = {
  newbie: {
    key: 'newbie',
    label: 'Newbie',
    icon: '🐣',
    expMin: 0,
    expMax: 99,
    special: false,
  },
  nhanvien: {
    key: 'nhanvien',
    label: 'Nhân viên',
    icon: '⚡',
    expMin: 100,
    expMax: 499,
    special: false,
  },
  kycuu: {
    key: 'kycuu',
    label: 'Kỳ cựu',
    icon: '🔥',
    expMin: 500,
    expMax: 999,
    special: false,
  },
  quanly: {
    key: 'quanly',
    label: 'Quản lý',
    icon: '🛡️',
    expMin: 1000,
    expMax: Infinity,
    special: false,
    requiresApproval: true,
  },
  gm: {
    key: 'gm',
    label: 'GM',
    icon: '⚔️',
    expMin: 0,
    expMax: Infinity,
    special: true,
  },
  creator: {
    key: 'creator',
    label: 'Creator',
    icon: '👾',
    expMin: 0,
    expMax: Infinity,
    special: true,
  },
};

// Ordered progression (non-special roles)
const ROLE_PROGRESSION = ['newbie', 'nhanvien', 'kycuu', 'quanly'];

// SOP access levels: true = full access, 'view' = read-only, false = locked
const SOP_ACCESS = {
  'mo_dong_bep': {
    label: 'Checklist mở/đóng bếp',
    newbie: 'view',
    nhanvien: true,
    kycuu: true,
    quanly: true,
    gm: true,
    creator: true,
  },
  'qc_ve_sinh': {
    label: 'QC vệ sinh',
    newbie: 'view',
    nhanvien: true,
    kycuu: true,
    quanly: true,
    gm: true,
    creator: true,
  },
  'nhap_hang': {
    label: 'Nhập hàng',
    newbie: false,
    nhanvien: false,
    kycuu: true,
    quanly: true,
    gm: true,
    creator: true,
  },
  'xu_ly_complaint': {
    label: 'Xử lý complaint',
    newbie: false,
    nhanvien: true,
    kycuu: true,
    quanly: true,
    gm: true,
    creator: true,
  },
  'tai_chinh': {
    label: 'Tài chính',
    newbie: false,
    nhanvien: false,
    kycuu: false,
    quanly: true,
    gm: true,
    creator: true,
  },
};

// ─── Permission Model ─────────────────────────────────────────────────────────
//
// Manager (quanly) — micro-managing staff:
//   Approve registrations, shift schedules, view reports, archive staff,
//   rename staff, discipline EXP penalties only.
//
// GM — strategic layer:
//   Everything Manager can do + full EXP control (rewards + KPIs),
//   role assignments (up to quanly), system overview.
//
// Creator — god mode:
//   All rights. Only one who can edit immutable records, delete accounts,
//   assign GM/Creator roles.
//
// IMMUTABLE DATA (no one edits directly):
//   Check-in timestamps, GPS coordinates, streak counts (auto-calculated),
//   no-show penalties (23:30 cron), auto-EXP from check-in.
// ─────────────────────────────────────────────────────────────────────────────

const PERMISSIONS = {
  newbie: {
    // Operations
    micro_manage: false,     // /approve, /fire, /rename, /staff, /lichca mgmt
    exp_penalty: false,      // /exp negative (discipline)
    exp_reward: false,       // /exp positive (KPI, bonuses)
    strategic: false,        // /setrole, /tongquan, full system view
    god_mode: false,         // /delete, edit immutable data
    // Legacy (kept for backward compat)
    ghi_nhan_kpi: false,
    xem_sop_day_du: false,
    xem_bao_cao_ca: false,
    duyet_nhan_vien: false,
    xem_tai_chinh: false,
    approve: false,
    manage_exp: false,
  },
  nhanvien: {
    micro_manage: false,
    exp_penalty: false,
    exp_reward: false,
    strategic: false,
    god_mode: false,
    ghi_nhan_kpi: false,
    xem_sop_day_du: false,
    xem_bao_cao_ca: false,
    duyet_nhan_vien: false,
    xem_tai_chinh: false,
    approve: false,
    manage_exp: false,
  },
  kycuu: {
    micro_manage: false,
    exp_penalty: false,
    exp_reward: false,
    strategic: false,
    god_mode: false,
    ghi_nhan_kpi: true,
    xem_sop_day_du: true,
    xem_bao_cao_ca: true,
    duyet_nhan_vien: false,
    xem_tai_chinh: false,
    approve: false,
    manage_exp: false,
  },
  quanly: {
    // Manager = micro-managing: approve staff, manage shifts, discipline, archive
    micro_manage: true,
    exp_penalty: true,       // CAN penalize (late, no BC, violations)
    exp_reward: false,       // CANNOT reward (KPI bonuses are GM territory)
    strategic: false,        // CANNOT /setrole or /tongquan
    god_mode: false,
    ghi_nhan_kpi: true,
    xem_sop_day_du: true,
    xem_bao_cao_ca: true,
    duyet_nhan_vien: true,
    xem_tai_chinh: true,
    approve: true,
    manage_exp: false,       // kept false — use exp_penalty/exp_reward instead
  },
  gm: {
    // GM = strategic: full EXP, role assign, system overview
    micro_manage: true,
    exp_penalty: true,
    exp_reward: true,        // CAN reward (KPI, bonuses, commendations)
    strategic: true,         // CAN /setrole (max quanly), /tongquan
    god_mode: false,
    ghi_nhan_kpi: true,
    xem_sop_day_du: true,
    xem_bao_cao_ca: true,
    duyet_nhan_vien: true,
    xem_tai_chinh: true,
    approve: true,
    manage_exp: true,
  },
  creator: {
    // Creator = god mode: all rights, immutable data edit, delete
    micro_manage: true,
    exp_penalty: true,
    exp_reward: true,
    strategic: true,
    god_mode: true,          // /delete, edit any record
    ghi_nhan_kpi: true,
    xem_sop_day_du: true,
    xem_bao_cao_ca: true,
    duyet_nhan_vien: true,
    xem_tai_chinh: true,
    approve: true,
    manage_exp: true,
  },
};

/**
 * Get role info by key
 */
function getRoleInfo(roleKey) {
  return ROLES[roleKey] || ROLES.newbie;
}

/**
 * Determine role from EXP (for non-special roles)
 */
function getRoleFromExp(exp) {
  if (exp >= 1000) return 'quanly';
  if (exp >= 400) return 'kycuu';
  if (exp >= 100) return 'nhanvien';
  return 'newbie';
}

/**
 * Get next role and EXP needed
 */
function getNextRole(roleKey, exp) {
  if (['gm', 'creator'].includes(roleKey)) {
    return { next: null, expNeeded: 0 };
  }
  const idx = ROLE_PROGRESSION.indexOf(roleKey);
  if (idx === -1 || idx >= ROLE_PROGRESSION.length - 1) {
    return { next: null, expNeeded: 0 };
  }
  const nextKey = ROLE_PROGRESSION[idx + 1];
  const nextRole = ROLES[nextKey];
  const expNeeded = nextRole.expMin - exp;
  return { next: nextKey, expNeeded: Math.max(0, expNeeded) };
}

/**
 * Check if sender has permission to approve/manage_exp
 */
function canApprove(role) {
  return PERMISSIONS[role]?.approve === true;
}

function canManageExp(role) {
  return PERMISSIONS[role]?.manage_exp === true;
}

// ─── New permission gates (v2 model) ─────────────────────────────────────────

/** Manager + GM + Creator: day-to-day staff ops */
function canMicroManage(role) {
  return PERMISSIONS[role]?.micro_manage === true;
}

/** GM + Creator: full EXP rewards, KPI bonuses, commendations */
function canExpReward(role) {
  return PERMISSIONS[role]?.exp_reward === true;
}

/** Manager + GM + Creator: EXP penalties for discipline */
function canExpPenalty(role) {
  return PERMISSIONS[role]?.exp_penalty === true;
}

/** GM + Creator: /setrole, /tongquan, system-level decisions */
function canStrategicManage(role) {
  return PERMISSIONS[role]?.strategic === true;
}

/** Creator only: /delete, edit immutable records */
function isGodMode(role) {
  return PERMISSIONS[role]?.god_mode === true;
}

/**
 * Get SOP access string for display
 */
function getSopAccess(roleKey, sopKey) {
  const sop = SOP_ACCESS[sopKey];
  if (!sop) return '🔒';
  const access = sop[roleKey];
  if (access === true) return '✅';
  if (access === 'view') return '👁️';
  return '🔒';
}

/**
 * Permission gates for reporting commands
 */
function canSubmitMoca(staff) {
  return staff.class_role === 'truong_ca' || ['creator', 'gm'].includes(staff.role);
}

function canSubmitDongca(staff) {
  return staff.class_role === 'truong_ca' || ['creator', 'gm'].includes(staff.role);
}

function canViewRevenue(staff) {
  return staff.class_role === 'truong_ca' || ['creator', 'gm'].includes(staff.role);
}

function canSubmitNhaphang(staff) {
  if (['newbie'].includes(staff.role)) return false;
  return staff.department === 'kho' || ['creator', 'gm', 'quanly'].includes(staff.role);
}

const PERMISSION_DENIED_MSG =
  '❌ Bạn không có quyền dùng lệnh này.\nLiên hệ quản lý nếu có nhầm lẫn.';

/**
 * Parse role from user input (handle aliases)
 */
function parseRoleInput(input) {
  if (!input) return 'newbie';
  const lower = input.toLowerCase().trim();
  const aliases = {
    'newbie': 'newbie',
    'moi': 'newbie',
    'nhanvien': 'nhanvien',
    'nhan vien': 'nhanvien',
    'nhân viên': 'nhanvien',
    'kycuu': 'kycuu',
    'ky cuu': 'kycuu',
    'kỳ cựu': 'kycuu',
    'quanly': 'quanly',
    'quan ly': 'quanly',
    'quản lý': 'quanly',
    'gm': 'gm',
    'creator': 'creator',
  };
  return aliases[lower] || 'newbie';
}

// ─── Class Roles (dept-specific sub-roles) ────────────────────────────────────

const CLASS_ROLES = {
  bep_truong:   { label: 'Bếp trưởng',   dept: 'bep',  icon: '👨‍🍳' },
  phu_bep:      { label: 'Phụ bếp',       dept: 'bep',  icon: '🍳' },
  phuc_vu_sang: { label: 'Phục vụ sáng',  dept: 'bida', icon: '☀️' },
  phuc_vu_toi:  { label: 'Phục vụ tối',   dept: 'bida', icon: '🌙' },
  truong_ca:    { label: 'Trưởng ca',      dept: null,   icon: '⭐' },
  nhanvien_bar: { label: 'Nhân viên Bar',  dept: 'bar',  icon: '🍹' },
};

function getClassRoleInfo(classRole) {
  return CLASS_ROLES[classRole] || { label: classRole || 'Nhân viên', dept: null, icon: '👤' };
}

module.exports = {
  ROLES,
  ROLE_PROGRESSION,
  SOP_ACCESS,
  PERMISSIONS,
  getRoleInfo,
  getRoleFromExp,
  getNextRole,
  canApprove,
  canManageExp,
  canMicroManage,
  canExpReward,
  canExpPenalty,
  canStrategicManage,
  isGodMode,
  getSopAccess,
  parseRoleInput,
  canSubmitMoca,
  canSubmitDongca,
  canViewRevenue,
  canSubmitNhaphang,
  PERMISSION_DENIED_MSG,
  CLASS_ROLES,
  getClassRoleInfo,
};
