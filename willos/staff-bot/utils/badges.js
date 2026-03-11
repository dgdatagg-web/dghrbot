/**
 * badges.js — Badge definitions + check logic
 * WillOS Staff RPG Bot
 */

const BADGE_DEFS = [
  { key: 'first_blood', icon: '🩸', name: 'First Blood', desc: 'Ca đầu tiên' },
  { key: 'grinder',     icon: '⚙️',  name: 'Grinder',    desc: '30 ca tích lũy' },
  { key: 'century',     icon: '💯',  name: 'Century',    desc: '100 ca tích lũy' },
  { key: 'on_fire',     icon: '🔥',  name: 'On Fire',    desc: 'Streak 7 ngày' },
  { key: 'legendary',   icon: '🌟',  name: 'Legendary',  desc: 'Streak 30 ngày' },
  { key: 'mentor',      icon: '🎓',  name: 'Mentor',     desc: 'Có 1 người mình giới thiệu lên Nhân viên' },
  { key: 'kpi_king',    icon: '👑',  name: 'KPI King',   desc: '3 tháng KPI 100% liên tiếp' },
  { key: 'clean_slate', icon: '🧹',  name: 'Clean Slate',desc: '30 ngày không vi phạm' },
  { key: 'comeback',    icon: '⚡',  name: 'Comeback',   desc: 'Từ EXP âm → positive' },
  { key: 'architect',   icon: '🏗️',  name: 'Architect',  desc: 'Creator — người xây dựng hệ thống' },
  { key: 'general',     icon: '⚔️',  name: 'General',    desc: 'GM — chỉ huy toàn quân' },
];

/**
 * Get badge definition by key
 */
function getBadgeDef(key) {
  return BADGE_DEFS.find(b => b.key === key) || null;
}

/**
 * Format earned badges into icon string
 * @param {Array} badgeRows - array of {badge_key} objects
 * @returns {string} e.g. "🩸 ⚙️"
 */
function formatBadges(badgeRows) {
  if (!badgeRows || badgeRows.length === 0) return 'Chưa có badge';
  return badgeRows
    .map(row => {
      const def = getBadgeDef(row.badge_key);
      return def ? def.icon : null;
    })
    .filter(Boolean)
    .join(' ');
}

/**
 * Check all badge conditions and award new ones.
 * @param {object} dbModule - the db.js module (has getBadges, hasBadge, awardBadge, etc.)
 * @param {object} staff - staff record from DB (with id, exp, streak, role)
 * @param {number} prevExp - EXP before the current change (for comeback check)
 * @returns {string[]} array of newly awarded badge keys
 */
function checkAndAwardBadges(dbModule, staff, prevExp = null) {
  const staffId = staff.id;
  const awarded = [];

  const checkinCount = dbModule.getCheckinCount(staffId);
  const referrals = dbModule.getReferrals(staffId);
  const consecutiveKpi = dbModule.getConsecutiveMonthsKpi(staffId);
  const cleanSlateDays = dbModule.getCleanSlateDays(staffId);

  const checks = [
    {
      key: 'first_blood',
      condition: () => checkinCount >= 1,
    },
    {
      key: 'grinder',
      condition: () => checkinCount >= 30,
    },
    {
      key: 'century',
      condition: () => checkinCount >= 100,
    },
    {
      key: 'on_fire',
      condition: () => staff.streak >= 7,
    },
    {
      key: 'legendary',
      condition: () => staff.streak >= 30,
    },
    {
      key: 'mentor',
      // Check if any referral has reached nhanvien or above
      condition: () => {
        if (!referrals || referrals.length === 0) return false;
        const progressionRanks = { newbie: 0, nhanvien: 1, kycuu: 2, quanly: 3, gm: 4, creator: 5 };
        return referrals.some(r => (progressionRanks[r.role] || 0) >= 1);
      },
    },
    {
      key: 'kpi_king',
      condition: () => consecutiveKpi >= 3,
    },
    {
      key: 'clean_slate',
      condition: () => cleanSlateDays >= 30,
    },
    {
      key: 'comeback',
      condition: () => {
        if (prevExp === null) return false;
        // Chỉ award khi prevExp THỰC SỰ ÂM (< 0), không phải = 0
        return prevExp < 0 && staff.exp > 0;
      },
    },
    {
      key: 'architect',
      condition: () => staff.role === 'creator',
    },
    {
      key: 'general',
      condition: () => staff.role === 'gm',
    },
  ];

  for (const check of checks) {
    if (!dbModule.hasBadge(staffId, check.key)) {
      try {
        if (check.condition()) {
          dbModule.awardBadge(staffId, check.key);
          awarded.push(check.key);
        }
      } catch (e) {
        // Non-fatal: log and continue
        console.error(`[badges] Error checking ${check.key}:`, e.message);
      }
    }
  }

  return awarded;
}

/**
 * Format badge award notification lines
 * @param {string[]} newBadgeKeys
 * @returns {string}
 */
function formatBadgeAwards(newBadgeKeys) {
  if (!newBadgeKeys || newBadgeKeys.length === 0) return '';
  const lines = ['', '🏅 BADGE MỚI!'];
  for (const key of newBadgeKeys) {
    const def = getBadgeDef(key);
    if (def) lines.push(`${def.icon} ${def.name} — ${def.desc}`);
  }
  return lines.join('\n');
}

module.exports = {
  BADGE_DEFS,
  getBadgeDef,
  formatBadges,
  formatBadgeAwards,
  checkAndAwardBadges,
};
