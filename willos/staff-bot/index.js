/**
 * index.js — DG_HR_BOT Entry Point
 * WillOS Staff RPG Bot for DG Group
 *
 * Bot: DG_HR_BOT (existing bot, token from @BotFather)
 * Token env var: DG_HR_BOT_TOKEN
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const db = require('./db');
const { broadcastEvent, GROUPS } = require('./utils/groups');
const noshow = require('./utils/noshow');

// ─── Config ──────────────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.DG_HR_BOT_TOKEN;
const STAFF_DB_PATH = process.env.STAFF_DB_PATH || path.join(__dirname, '..', '..', 'data', 'staff.db');

if (!BOT_TOKEN || BOT_TOKEN.startsWith('#')) {
  console.error('[ERROR] DG_HR_BOT_TOKEN chưa được set trong .env');
  process.exit(1);
}

// ─── Init DB ─────────────────────────────────────────────────────────────────

db.initDb(STAFF_DB_PATH);
console.log(`[DB] Initialized: ${STAFF_DB_PATH}`);

// ─── Init Bot ─────────────────────────────────────────────────────────────────

const bot = new TelegramBot(BOT_TOKEN, {
  polling: {
    interval: 300,
    autoStart: true,
    params: { timeout: 10 },
  },
  request: {
    agentOptions: {
      keepAlive: true,
      family: 4,
    },
  },
});

// Suppress polling errors from crashing — bot auto-retries
bot.on('polling_error', (err) => {
  const code = err.code || '';
  if (code === 'ETELEGRAM' && err.message && err.message.includes('409')) {
    console.error('[POLL] 409 Conflict — another instance running. Stopping this one.');
    process.exit(1); // Force PM2 to restart cleanly
  }
  // ECONNRESET / EFATAL — log and continue (polling retries automatically)
  if (['ECONNRESET', 'EFATAL', 'ECONNREFUSED', 'ETIMEDOUT'].some(c => code.includes(c) || (err.message || '').includes(c))) {
    console.warn('[POLL] Network hiccup, retrying...', code);
    return;
  }
  console.error('[POLL ERROR]', err.message || err);
});

let botUsername = process.env.BOT_USERNAME || '';

bot.getMe().then(me => {
  botUsername = me.username;
  console.log(`[BOT] DG_HR_BOT đã kết nối: @${me.username} (${me.id})`);
}).catch(() => {
  // getMe may fail on first connect — polling will recover
});

// ─── Command Handlers ────────────────────────────────────────────────────────

const dangky    = require('./commands/dangky');
const checkin   = require('./commands/checkin');
const checkout  = require('./commands/checkout');
const profile   = require('./commands/profile');
const approve   = require('./commands/approve');
const expCmd    = require('./commands/exp_cmd');
const leaderboard = require('./commands/leaderboard');
const lichca    = require('./commands/lichca');
const roadmap   = require('./commands/roadmap');
const fire      = require('./commands/fire');
const bc        = require('./commands/bc');
const nhaphang  = require('./commands/nhaphang');
const badgesCmd = require('./commands/badges_cmd');
const reminder  = require('./commands/reminder');
const setrole   = require('./commands/setrole');
const baocao    = require('./commands/baocao');
const bosung    = require('./commands/bosung');
const tongquan  = require('./commands/tongquan');
const { registerGroupReportHandler } = require('./commands/shift_report');
const staffCmd  = require('./commands/staff');
const rename    = require('./commands/rename');
const update    = require('./commands/update');
const addstaff  = require('./commands/addstaff');
const tangca    = require('./commands/tangca');
const weeklyreport = require('./commands/weeklyreport');
const approveot = require('./commands/approveot');
const doanhthu  = require('./commands/baocaodoanhthu');
const expstart  = require('./commands/expstart');
const kpiAnalyzer = require('./modules/novaKpiAnalyzer');
const approvekpi  = require('./commands/approvekpi');
const assignesop  = require('./commands/assignesop');
const viewpool    = require('./commands/viewpool');
const esopstatus  = require('./commands/esopstatus');
const grantaccess  = require('./commands/grantaccess');
const revokeaccess = require('./commands/revokeaccess');
const handleTownboard = require('./commands/tb');
const posttask        = require('./commands/posttask');
const join            = require('./commands/join');
const completetask    = require('./commands/completetask');
const canceltask      = require('./commands/canceltask');
const confirmpayout   = require('./commands/confirmpayout');
const cashkpi         = require('./commands/cashkpi');
const kpihit          = require('./commands/kpihit');
const rehire          = require('./commands/rehire');
const setvaluation    = require('./commands/setvaluation');

/**
 * Parse command text into args array
 * "/checkin" → []
 * "/exp Hiếu +30 reason" → ["Hiếu", "+30", "reason"]
 */
function parseArgs(text) {
  if (!text) return [];
  const parts = text.trim().split(/\s+/);
  return parts.slice(1); // remove command itself
}

/**
 * Wrap handler with error catching
 */
function safeHandle(handler, bot, msg, args) {
  Promise.resolve(handler(bot, msg, args, db)).catch(err => {
    console.error('[CMD ERROR]', err);
    bot.sendMessage(msg.chat.id, `❌ Có lỗi xảy ra. Vui lòng thử lại sau.\n\nError: ${err.message}`).catch(() => {});
  });
}

// ─── Register Commands ────────────────────────────────────────────────────────

bot.onText(/^\/dangky(\s|$)/i, (msg) => {
  safeHandle(dangky.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/checkin(\s|$)/i, (msg) => {
  safeHandle(checkin.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/checkout(\s|$)/i, (msg) => {
  safeHandle(checkout.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/profile(\s|$)/i, (msg) => {
  safeHandle(profile.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/approve(\s|$)/i, (msg) => {
  safeHandle(approve.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/exp(\s|$)/i, (msg) => {
  safeHandle(expCmd.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/(leaderboard|lb)(\s|$)/i, (msg) => {
  safeHandle(leaderboard.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/lichca(\s|$)/i, (msg) => {
  safeHandle(lichca.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/roadmap(\s|$)/i, (msg) => {
  safeHandle(roadmap.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/fire(\s|$)/i, (msg) => {
  safeHandle(fire.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/forcecheckout(\s|$)/i, async (msg) => {
  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;
  const args = parseArgs(msg.text);
  const actor = db.getStaffByTelegramId(telegramId);
  if (!actor || !['gm', 'creator', 'quanly'].includes(actor.role)) {
    return bot.sendMessage(chatId, '❌ Chỉ GM và Quản lý mới dùng được lệnh này.');
  }
  if (!args || args.length === 0) {
    return bot.sendMessage(chatId, 'Cách dùng: /forcecheckout [tên nhân viên]');
  }
  const targetName = args.join(' ').replace(/^[\u201c\u201d"']+|[\u201c\u201d"']+$/g, '').trim();
  const target = db.getStaffByName(targetName);
  if (!target) return bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên: ${targetName}`);

  const ictNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const today = ictNow.toISOString().split('T')[0];
  const openCheckin = db.getOpenCheckin(target.id, today);
  if (!openCheckin) {
    return bot.sendMessage(chatId, `⚠️ ${target.name} không có ca đang mở hôm nay.`);
  }

  const checkoutTime = new Date().toISOString();
  const checkinTime = new Date(openCheckin.checkin_time);
  const diffMs = new Date() - checkinTime;
  const actualMinutes = Math.round(diffMs / 60000);
  const totalHours = Math.floor(actualMinutes / 60);
  const totalMins  = actualMinutes % 60;

  db.updateCheckout(openCheckin.id, checkoutTime, actualMinutes);

  await bot.sendMessage(chatId,
    `✅ Đã force checkout cho ${target.name}.\n` +
    `⏱ Ca làm: ${totalHours}h${totalMins}m\n` +
    `👤 Thực hiện bởi: ${actor.name}`
  );
  console.log(`[force-checkout] ${target.name} closed by ${actor.name}`);
});

bot.onText(/^\/(tangca|xintangca)(\s|$)/i, (msg) => {
  safeHandle(tangca.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/(approveot|duyettangca)(\s|$)/i, (msg) => {
  safeHandle(approveot.handle, bot, msg, parseArgs(msg.text));
});

// ─── Revenue reporting ────────────────────────────────────────────────────────
bot.onText(/^\/baocaodoanhthu(\s|$)/i, (msg) => {
  safeHandle(doanhthu.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/xemdoanhthu(\s|$)/i, (msg) => {
  safeHandle(doanhthu.handleView, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/assignreporter(\s|$)/i, (msg) => {
  safeHandle(doanhthu.handleAssign, bot, msg, parseArgs(msg.text));
});

// Revenue report step handler — intercepts text/photo while session is active
bot.on('message', async (msg) => {
  if (msg.text && msg.text.startsWith('/')) return; // commands handled above
  if (msg.photo) {
    await doanhthu.handlePhoto(bot, msg, db).catch(err => console.error('[Revenue] photo error:', err.message));
    return;
  }
  if (msg.text) {
    await doanhthu.handleStep(bot, msg, db).catch(err => console.error('[Revenue] step error:', err.message));
    await posttask.handleStep(bot, msg, db).catch(err => console.error('[Posttask] step error:', err.message));
    await cashkpi.handleStep(bot, msg, db).catch(err => console.error('[Cashkpi] step error:', err.message));
  }
});

bot.onText(/^\/delete(\s|$)/i, (msg) => {
  // Route delete with correct command name preserved in msg.text
  safeHandle(fire.handle, bot, msg, parseArgs(msg.text));
});

// ─── EXP founding calibration ─────────────────────────────────────────────────
bot.onText(/^\/expstart(\s|$)/i, (msg) => {
  safeHandle(expstart.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/expconfirm(\s|$)/i, (msg) => {
  safeHandle(expstart.handleConfirm, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/setexp(\s|$)/i, (msg) => {
  safeHandle(expstart.handleSetExp, bot, msg, parseArgs(msg.text));
});

// ─── KPI analysis ─────────────────────────────────────────────────────────────
bot.onText(/^\/reviewkpis?(\s|$)/i, (msg) => {
  safeHandle(kpiAnalyzer.handleReview, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/approvekpi(\s|$)/i, (msg) => {
  safeHandle(approvekpi.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/assignesop(\s|$)/i, (msg) => {
  safeHandle(assignesop.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/viewpool(\s|$)/i, (msg) => {
  safeHandle(viewpool.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/esopstatus(\s|$)/i, (msg) => {
  safeHandle(esopstatus.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/rehire(\s|$)/i, (msg) => {
  safeHandle(rehire.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/setvaluation(\s|$)/i, (msg) => {
  safeHandle(setvaluation.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/grantaccess(\s|$)/i, (msg) => {
  safeHandle(grantaccess.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/revokeaccess(\s|$)/i, (msg) => {
  safeHandle(revokeaccess.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/tb$/, async (msg) => {
  await handleTownboard(bot, msg);
});

bot.onText(/^\/posttask(\s|$)/i, (msg) => {
  Promise.resolve(posttask.handle(bot, msg, parseArgs(msg.text), db, botUsername))
    .catch(err => {
      console.error('[CMD ERROR]', err);
      bot.sendMessage(msg.chat.id, `❌ Có lỗi xảy ra. Vui lòng thử lại sau.\n\nError: ${err.message}`).catch(() => {});
    });
});

bot.onText(/^\/join\s+(\d+)$/i, (msg) => {
  safeHandle(join.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/completetask(\s|$)/i, (msg) => {
  safeHandle(completetask.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/kpihit(\s|$)/i, (msg) => {
  safeHandle(kpihit.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/canceltask(\s|$)/i, (msg) => {
  safeHandle(canceltask.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/confirmpayout(\s|$)/i, (msg) => {
  safeHandle(confirmpayout.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/cashkpi(\s|$)/i, (msg) => {
  safeHandle(cashkpi.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/badges(\s|$)/i, (msg) => {
  safeHandle(badgesCmd.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/setrole(\s|$)/i, (msg) => {
  safeHandle(setrole.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/(staff|nhanvien|danhsach)(\s|$)/i, (msg) => {
  safeHandle(staffCmd.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/rename(\s|$)/i, (msg) => {
  safeHandle(rename.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/update(\s|$)/i, (msg) => {
  safeHandle(update.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/(addstaff|themstaff|addnv)(\s|$)/i, (msg) => {
  safeHandle(addstaff.handle, bot, msg, parseArgs(msg.text));
});

// ─── Shift Report Commands ────────────────────────────────────────────────────

bot.onText(/^\/bc(\s|$)/i, (msg) => {
  safeHandle(bc.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/nhaphang(\s|$)/i, (msg) => {
  safeHandle(nhaphang.handle, bot, msg, parseArgs(msg.text));
});

// ─── Aliases ──────────────────────────────────────────────────────────────────

bot.onText(/^\/stats(\s|$)/i, (msg) => {
  safeHandle(profile.handle, bot, msg, parseArgs(msg.text));
});

// /me = full profile (replaces /profile)
bot.onText(/^\/me(\s|$|\s+\S+)/i, (msg) => {
  safeHandle(profile.handle, bot, msg, parseArgs(msg.text));
});

// ─── Start ────────────────────────────────────────────────────────────────────

bot.onText(/^\/start(\s|$)/i, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);

  // Track private_chat_id whenever /start is sent from private chat
  if (msg.chat.type === 'private') {
    const staffCheck = db.getStaffByTelegramId(telegramId);
    if (staffCheck && staffCheck.status === 'active' && !staffCheck.private_chat_id) {
      db.updatePrivateChatId(telegramId, chatId);
    }
  }

  const staff = db.getStaffByTelegramId(telegramId);

  // ── Deep link: taskinfo — /start taskinfo_<id> ────────────────────────────
  const startParam = (msg.text || '').split(' ')[1] || '';
  const taskMatch  = startParam.match(/^taskinfo_(\d+)$/);
  if (taskMatch) {
    const rewardId = parseInt(taskMatch[1], 10);
    const task = db.getDb().prepare(`
      SELECT rd.*, tp.pinned, tp.posted_at,
        (SELECT COUNT(*) FROM reward_assignments ra
         WHERE ra.reward_id = rd.id AND ra.status = 'active') AS participants
      FROM reward_definitions rd
      JOIN townboard_posts tp ON tp.reward_id = rd.id
      WHERE rd.id = ? AND tp.removed_at IS NULL
    `).get(rewardId);

    if (!task) {
      return bot.sendMessage(chatId, '❌ Task không tìm thấy hoặc đã đóng.');
    }

    const typeEmoji = { quest: '⚔️', cash_kpi: '💰', company_kpi: '🏆', activity: '🏃' };
    const emoji = typeEmoji[task.reward_type] || '📌';
    const lines = [
      `${emoji} *${task.title}*`,
      task.description ? `\n${task.description}` : null,
    ];

    if (task.reward_type === 'activity') {
      lines.push(`\n📅 Every ${task.recurrence_day} · ${task.recurrence_time}`);
      lines.push(`👥 ${task.participants} joined`);
      lines.push(`\nUse /join ${task.id} to join.`);
    } else if (task.reward_type === 'quest') {
      const rewards = [
        task.exp_reward    ? `${task.exp_reward} EXP`                       : null,
        task.cash_reward   ? `${task.cash_reward.toLocaleString()}đ`         : null,
        task.item_reward_desc || null,
      ].filter(Boolean).join(' · ');
      lines.push(`\n🎁 ${rewards || '—'}`);
      if (task.expires_at) lines.push(`⏳ Expires: ${task.expires_at.slice(0, 10)}`);
      if (task.target_type === 'group') lines.push(`👥 ${task.participants} joined`);
      lines.push(`\nUse /join ${task.id} to accept.`);
    } else if (task.reward_type === 'cash_kpi') {
      lines.push(`\n💵 Reward: ${task.cash_reward.toLocaleString()}đ`);
      if (task.description) lines.push(`📋 ${task.description}`);
    }

    return bot.sendMessage(chatId, lines.filter(Boolean).join('\n'), { parse_mode: 'Markdown' });
  }

  // ── Case 1: Active staff — show stats + contextual actions ────────────────
  if (staff && staff.status === 'active') {
    const { getRoleInfo } = require('./utils/roles');
    const role = getRoleInfo(staff.role);
    const name = staff.name;

    // Random personalized greeting for active user
    const activeGreetings = [
      `👋 ${name}!`, `😄 Ôi, ${name} đây rồi!`, `🙌 ${name}!`,
      `😎 Yo ${name}!`, `💪 ${name}, ready chưa?`, `🌟 ${name}!`,
      `🔔 Ding ding! ${name} đã đến.`, `🔥 ${name}! Let's go!`,
      `🧑‍🍳 Chef ${name} in the building!`, `⚡ ${name}!`,
      `🎯 ${name}!`, `🤝 ${name}.`, `👊 ${name}!`, `💫 ${name}~`,
      `☀️ ${name}, hôm nay thế nào?`, `🚀 ${name}, blast off!`,
      `💎 ${name}! Stay sharp.`, `🫡 ${name} — report for duty!`,
      `🎉 ${name}! Vào rồi!`, `🏆 ${name}!`,
    ];
    const activeGreeting = activeGreetings[Math.floor(Math.random() * activeGreetings.length)];

    // Build action suggestions by role
    let actions = '';
    if (['creator', 'gm'].includes(staff.role)) {
      actions = `📋 /approve — duyệt nhân viên mới\n🏆 /tb — xem Townboard\n💡 /help — tất cả lệnh`;
    } else if (staff.role === 'quanly') {
      actions = `✅ /checkin — vào ca\n🏆 /tb — xem Townboard\n📋 /approve — duyệt nhân viên`;
    } else {
      actions = `✅ /checkin — bắt đầu ca\n🏆 /tb — xem task đang mở\n👤 /me — xem stats của bạn`;
    }

    return bot.sendMessage(chatId,
      `${activeGreeting}\n\n` +
      `${role.icon} ${role.label} | ⚡ EXP: ${staff.exp} | 🔥 Streak: ${staff.streak} ngày\n\n` +
      actions
    );
  }

  // ── Case 2: Archived — recognize them, offer re-register ─────────────────
  if (staff && staff.status === 'archived') {
    const firstName = msg.from.first_name || 'bạn';
    return bot.sendMessage(chatId,
      `👋 ${firstName}!\n\n` +
      `Tài khoản của bạn đã bị archive.\n` +
      `Đăng ký lại: /dangky [tên]\n\n` +
      `Hoặc liên hệ quản lý để khôi phục.`
    );
  }

  // ── Case 3: New user — generic greeting (no name — they haven't registered yet)
  const greetings = [
    // Casual & warm
    `👋 Hello!`,
    `😄 Ôi, có người mới rồi!`,
    `🙌 Chào mừng!`,
    `👀 À, ghé vào rồi!`,
    `😎 Yo!`,
    `🤙 Ơi, chào!`,
    `✨ Lâu quá mới thấy người mới.`,
    `🎉 Ồ! Vào đây rồi!`,
    `💪 Ready chưa?`,
    `🌟 Mình đây.`,
    // Nhẹ nhàng, thân thiện
    `☀️ Chào, hôm nay thế nào?`,
    `🍜 Đói chưa? Vào đăng ký đi.`,
    `🫡 Report for duty!`,
    `🤗 Mừng bạn ghé qua.`,
    `🌸 Xin chào!`,
    `🫶 Hi hi!`,
    `🎶 Đây rồi~`,
    `🦾 Sẵn sàng chưa?`,
    `🐱 Nyaa~!`,
    `🌈 Ngày mới bắt đầu.`,
    // Vui vẻ, hài hước nhẹ
    `🤖 Beep boop. Hello.`,
    `🔔 Ding ding! Có người đến.`,
    `📣 Ai vào đây rồi!`,
    `🎯 Chính xác người mình cần.`,
    `🍱 Sushi đang chờ.`,
    `⚡ Điện sáng lên — có người vào rồi!`,
    `🎮 New player has entered the game.`,
    `🚀 Blast off!`,
    `🌙 Đêm muộn vẫn còn đây à.`,
    `☕ Cafe chưa? Vào đây đã.`,
    // Năng lượng cao
    `🔥 Let's go!`,
    `💥 BOOM! Có người xuất hiện!`,
    `🎸 Rock on!`,
    `⚽ Game on!`,
    `🏆 Winner's mindset!`,
    `💎 Stay sharp.`,
    `🌊 Riding the wave~`,
    `🦅 Soar high!`,
    `🎯 Locked and loaded!`,
    `⚡ ZAP! Someone's here!`,
    // Bếp / nhà hàng theme
    `🍳 Lửa bếp đang chờ.`,
    `🔪 Dao mài xong chưa?`,
    `🧑‍🍳 New chef in the building!`,
    `🍛 Curry hôm nay ngon không?`,
    `🥢 Đũa sẵn sàng chưa?`,
    `🍜 Mì ra lò rồi.`,
    `🥩 Thịt ra đông chưa?`,
    `🌶️ Cay không sợ nha.`,
    `🍤 Tôm đang chiên.`,
    `🫕 Nồi đang sôi đây.`,
    // Motivational
    `💡 Ý tưởng mới hôm nay là gì?`,
    `🧠 Big brain energy!`,
    `📈 Growth mindset on!`,
    `🎓 Học gì mới hôm nay?`,
    `🌱 Mỗi ngày một bước.`,
    `🏋️ Grind time!`,
    `🎯 Focus mode: ON.`,
    `🧩 Puzzle của hôm nay là gì?`,
    `✍️ Viết nên lịch sử hôm nay đi.`,
    `🌅 Ngày mới, cơ hội mới.`,
    // Philosophical / chill
    `🌿 Thở đi rồi bắt đầu.`,
    `🪷 Bình tĩnh, ta đây.`,
    `🍃 Nhẹ nhàng mà hiệu quả.`,
    `🌙 Đêm dài còn nhiều việc.`,
    `🔭 Nhìn xa hơn đi.`,
    `🎋 Vững như tre.`,
    `🌊 Flow like water.`,
    `🕊️ Bình an nhé.`,
    `🌸 Đẹp như hoa, chăm như ong.`,
    `🧘 Chill một cái rồi làm.`,
    // Weekend / time-aware vibes
    `🎉 Hôm nay ngon không?`,
    `🌤️ Trời đẹp phết nhỉ.`,
    `🌧️ Mưa cũng cứ vào ca thôi.`,
    `🌞 Nắng lên rồi, bắt đầu thôi.`,
    `🌃 Đêm muộn team cứng.`,
    `🏙️ SG không ngủ, mình cũng không.`,
    `🎊 Hôm nay có gì vui không?`,
    `🛵 Ship đang đổ, vào đây nhanh.`,
    `📱 Notification đây rồi.`,
    `🎬 Action!`,
    // Ngắn gọn, cool
    `🤝 Chào.`,
    `👊 Vào rồi!`,
    `🫵 Ơi!`,
    `💫 Hello~`,
    `🌟 Mình đây.`,
    `✌️ Yo!`,
    `🖐️ Hi!`,
    `😏 À...`,
    `🔑 Vào đây.`,
    `🎁 Surprise!`,
  ];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];

  // ── IP Ownership Notice — unregistered users only ──────────────────────────
  await bot.sendMessage(chatId,
    `ℹ️ Trước khi bắt đầu:\n\n` +
    `Bot này là hệ thống quản lý nội bộ của DG Group.\n` +
    `Dữ liệu ca làm, EXP và báo cáo của bạn được lưu trữ và sử dụng để vận hành quán.\n\n` +
    `Hệ thống này là tài sản riêng của Do Ngoc Minh — DG Group.\n` +
    `© 2026 Do Ngoc Minh. All Rights Reserved.\n\n` +
    `Bằng cách đăng ký, bạn đồng ý với điều khoản sử dụng nội bộ.`
  );

  bot.sendMessage(chatId,
    `${greeting}\n\n` +
    `Đây là bot quản lý ca của Kansai Osaka 🍱\n` +
    `Checkin, báo ca, bàn giao — tất cả ở đây.\n\n` +
    `Đăng ký 30 giây thôi:\n` +
    `/dangky [tên của bạn]\n\n` +
    `Ví dụ: /dangky Hiếu`
  );
});

// ─── Group Report Handler (topic 172 + 177) ───────────────────────────────────
registerGroupReportHandler(bot, db);

// ─── Baocao / Tongquan Commands ───────────────────────────────────────────────

bot.onText(/^\/baocao(\s|@\S+)?/i, (msg) => {  safeHandle(baocao.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/bosung(\s|$)/i, (msg) => {
  safeHandle(bosung.handle, bot, msg, parseArgs(msg.text));
});

bot.onText(/^\/tongquan(\s|@\S+)?$/i, (msg) => {
  safeHandle(tongquan.handle, bot, msg, []);
});

// ─── Weekly Report & Silent Mode ──────────────────────────────────────────────

bot.onText(/^\/weeklyreport(\s|$)/i, (msg) => {
  weeklyreport.handle(bot, msg, db).catch(err => console.error('[weeklyreport]', err));
});

bot.onText(/^\/silentmode(\s|$)/i, (msg) => {
  weeklyreport.handleSilentMode(bot, msg, parseArgs(msg.text), db).catch(err => console.error('[silentmode]', err));
});

// ─── Start Reminder Scheduler ─────────────────────────────────────────────────
reminder.startReminderScheduler(bot, db);

// ─── Free-text handler for guided flows ───────────────────────────────────────
bot.on('message', async (msg) => {
  // Track private_chat_id on any private chat interaction
  if (msg.chat.type === 'private' && msg.from) {
    const telegramId = String(msg.from.id);
    const staff = db.getStaffByTelegramId(telegramId);
    if (staff && staff.status === 'active') {
      // Save private_chat_id if missing
      if (!staff.private_chat_id) {
        db.updatePrivateChatId(telegramId, msg.chat.id);
      }
      // Auto-update username if it was null and they now have one
      const tgUsername = msg.from.username ? `@${msg.from.username}` : null;
      if (!staff.username && tgUsername) {
        db.getDb().prepare(`UPDATE staff SET username = ? WHERE telegram_id = ?`).run(tgUsername, telegramId);
      }
    }
  }

  // Handle photos for nhaphang
  if (msg.photo) {
    if (await nhaphang.handleNhaphangPhoto(bot, msg, db)) return;
    return;
  }

  // Handle location share for checkin
  if (msg.location) {
    if (await checkin.handleLocation(bot, msg, db)) return;
    return;
  }

  if (!msg.text) return;
  // Allow /cancel and /huy through to guided handlers even though they start with /
  const isCancel = msg.text.trim() === '/cancel' || msg.text.trim() === '/huy';
  const isSkip = msg.text.trim() === '/skip';
  if (msg.text.startsWith('/') && !isCancel && !isSkip) return;

  // Handle "❌ Hủy" for checkin (works in any chat type — location keyboard shown anywhere)
  if (msg.text === '❌ Hủy') {
    if (await checkin.handleCancel(bot, msg, db)) return;
  }

  if (msg.chat.type !== 'private') return;

  // Try each guided handler in priority order
  if (await bc.handlePendingBc(bot, msg, db)) return;
  if (await nhaphang.handlePendingNhaphang(bot, msg, db)) return;
  if (await bosung.handlePending(bot, msg, db)) return;
  if (await lichca.handlePendingLichca(bot, msg, db)) return;
});

// ─── Inline Button Callbacks ──────────────────────────────────────────────────

bot.on('callback_query', async (query) => {
  const callerId = String(query.from.id);
  const data = query.data || '';

  // Route /dangky callbacks
  if (data.startsWith('dept_') || data.startsWith('classrole_')) {
    return dangky.handleDangkyCallback(bot, query, db).catch(err => {
      console.error('[CB dangky]', err);
      bot.answerCallbackQuery(query.id).catch(() => {});
    });
  }

  // Route /addstaff callbacks
  if (data.startsWith('addstaff_')) {
    return addstaff.handleCallback(bot, query, db).catch(err => {
      console.error('[CB addstaff]', err);
      bot.answerCallbackQuery(query.id).catch(() => {});
    });
  }

  // Route /bc callbacks
  if (data.startsWith('bc_')) {
    return bc.handleBcCallback(bot, query, db).catch(err => {
      console.error('[CB bc]', err);
      bot.answerCallbackQuery(query.id).catch(() => {});
    });
  }

  // Route /nhaphang callbacks
  if (data.startsWith('nhaphang_')) {
    return nhaphang.handleNhaphangCallback(bot, query, db).catch(err => {
      console.error('[CB nhaphang]', err);
      bot.answerCallbackQuery(query.id).catch(() => {});
    });
  }

  // Route /weeklyreport submit callback
  if (data.startsWith('weeklyreport_submit_')) {
    return weeklyreport.handleCallback(bot, query, db).catch(err => {
      console.error('[CB weeklyreport]', err);
      bot.answerCallbackQuery(query.id).catch(() => {});
    });
  }

  // Route /bosung callbacks
  if (data.startsWith('bosung_')) {
    return bosung.handleCallback(bot, query, db).catch(err => {
      console.error('[CB bosung]', err);
      bot.answerCallbackQuery(query.id).catch(() => {});
    });
  }

  // Route /staff view callbacks
  if (data.startsWith('staff_view_')) {
    return staffCmd.handleStaffCallback(bot, query, db).catch(err => {
      console.error('[CB staff]', err);
      bot.answerCallbackQuery(query.id).catch(() => {});
    });
  }

  // Approve/Reject callbacks (admin only)
  const creatorIds = (process.env.CREATOR_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const gmIds = (process.env.GM_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const isPrivileged = creatorIds.includes(callerId) || gmIds.includes(callerId);
  const callerStaff = db.getStaffByTelegramId(callerId);
  const isPrivilegedByRole = callerStaff && require('./utils/roles').canApprove(callerStaff.role);

  if (!isPrivileged && !isPrivilegedByRole) {
    return bot.answerCallbackQuery(query.id, { text: '❌ Bạn không có quyền này.', show_alert: true });
  }

  const [action, name] = data.split(':');
  if (!action || !name) return bot.answerCallbackQuery(query.id);

  if (action === 'approve') {
    const staff = db.getStaffByName(name);
    if (!staff) return bot.answerCallbackQuery(query.id, { text: `❌ Không tìm thấy ${name}`, show_alert: true });
    if (staff.status === 'active') return bot.answerCallbackQuery(query.id, { text: `✅ ${name} đã active rồi.` });
    db.updateStaffStatus(staff.telegram_id, 'active');
    // Notify the staff member
    if (staff.telegram_id) {
      bot.sendMessage(staff.telegram_id, `✅ Tài khoản của bạn đã được duyệt!\n${require('./utils/roles').getRoleInfo(staff.role).icon} ${name} — Bắt đầu dùng /checkin nhé!`).catch(() => {});
    }
    // Update the group message
    bot.editMessageText(
      `✅ ĐÃ DUYỆT\n━━━━━━━━━━━━━\n👤 ${name}\n━━━━━━━━━━━━━\nDuyệt bởi: ${query.from.first_name}`,
      { chat_id: query.message.chat.id, message_id: query.message.message_id }
    ).catch(() => {});
    return bot.answerCallbackQuery(query.id, { text: `✅ Đã duyệt ${name}!` });
  }

  if (action === 'reject') {
    const staff = db.getStaffByName(name);
    if (!staff) return bot.answerCallbackQuery(query.id, { text: `❌ Không tìm thấy ${name}`, show_alert: true });
    db.getDb().prepare("UPDATE staff SET status='rejected' WHERE name=?").run(name);
    if (staff.telegram_id) {
      bot.sendMessage(staff.telegram_id, `❌ Đăng ký của bạn (${name}) đã bị từ chối. Liên hệ Quản lý để biết thêm.`).catch(() => {});
    }
    bot.editMessageText(
      `❌ ĐÃ TỪ CHỐI\n━━━━━━━━━━━━━\n👤 ${name}\n━━━━━━━━━━━━━\nTừ chối bởi: ${query.from.first_name}`,
      { chat_id: query.message.chat.id, message_id: query.message.message_id }
    ).catch(() => {});
    return bot.answerCallbackQuery(query.id, { text: `❌ Đã từ chối ${name}.` });
  }

  bot.answerCallbackQuery(query.id);
});

// ─── Help ─────────────────────────────────────────────────────────────────────

bot.onText(/^\/help(\s|$)/i, (msg) => {
  const chatId = msg.chat.id;
  const telegramId = String(msg.from.id);
  const staff = db.getStaffByTelegramId(telegramId);
  const role = staff?.role || 'newbie';
  const dept = staff?.department || '';
  const isPrivileged = (process.env.CREATOR_IDS || '').split(',').map(s => s.trim()).includes(telegramId)
    || (process.env.GM_IDS || '').split(',').map(s => s.trim()).includes(telegramId);
  const isManager = isPrivileged || ['quanly', 'gm', 'creator'].includes(role);
  const isGmCreator = isPrivileged || ['gm', 'creator'].includes(role);
  const isKho = dept === 'kho' || isManager;

  const lines = [
    '🤖 DG HR BOT — Lệnh của bạn',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    '👤 CÁ NHÂN',
    '/checkin — Bắt đầu ca',
    '/checkout — Kết thúc ca',
    '/me [tên?] — Xem profile',
    '/leaderboard — Bảng xếp hạng',
    '/roadmap — Lộ trình thăng cấp',
    '',
    '🏆 TOWNBOARD',
    '/tb — Xem task & KPI đang mở',
    '/join [id] — Tham gia task',
  ];

  // Shift reports
  const isTruongCa = staff?.class_role === 'truong_ca' || isGmCreator;
  lines.push('', '📋 BÁO CÁO CA');
  lines.push('/bc — Bàn giao ca');
  if (isKho) lines.push('/nhaphang — Nhập hàng (kho)');

  // Manager
  if (isManager) {
    lines.push('', '🛡️ QUẢN LÝ');
    lines.push('/baocao — Báo cáo team hôm nay');
    lines.push('/approve [tên] — Duyệt nhân viên');
    lines.push('/exp [tên] [±số] [lý do] — Điều chỉnh EXP');
    lines.push('/lichca — Submit / xem lịch ca');
    lines.push('/fire [tên] — Archive nhân viên');
  }

  // GM/Creator
  if (isGmCreator) {
    lines.push('', '👾 GM / CREATOR');
    lines.push('/tongquan — Tổng quan toàn bộ');
    lines.push('/addstaff [tên] — Thêm nhân viên thủ công');
    lines.push('/update @username [field] [value] — Cập nhật thông tin');
    lines.push('/delete [tên] — Xóa nhân viên');
    lines.push('', '🏆 REWARD ENGINE');
    lines.push('/tb — Townboard: xem tất cả task & KPI đang mở');
    lines.push('/posttask — Đăng task / KPI mới lên Townboard');
    lines.push('/completetask [id] [tên] — Xác nhận hoàn thành task');
    lines.push('/canceltask [id] [tên] — Huỷ task của nhân viên');
    lines.push('/cashkpi [tên] — Tạo Cash KPI cho nhân viên');
    lines.push('/kpihit [assignment_id] — Xác nhận nhân viên đạt KPI');
    lines.push('/confirmpayout — Xác nhận thanh toán cash reward');
  } else if (isManager) {
    lines.push('', '🏆 REWARD ENGINE');
    lines.push('/tb — Townboard: xem task & KPI đang mở');
    lines.push('/completetask [id] [tên] — Xác nhận hoàn thành task');
    lines.push('/kpihit [assignment_id] — Xác nhận nhân viên đạt KPI');
  }

  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('DG Group Staff RPG v2.0');

  bot.sendMessage(chatId, lines.join('\n'));
});

// ─── Cron: No-show detection 23:30 mỗi ngày (ICT) ───────────────────────────

cron.schedule('30 23 * * *', async () => {
  console.log('[CRON] Chạy no-show detection...');
  try {
    const now = new Date();
    const { getCurrentWeek, getDayCode, detectNoShows } = noshow;
    const ictNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const today = ictNow.toISOString().split('T')[0];
    const weekStr = getCurrentWeek(ictNow);
    const dayCode = getDayCode(ictNow);
    const results = detectNoShows(db, today, weekStr, dayCode);
    if (results && results.length > 0) {
      console.log(`[CRON] No-show: ${results.length} nhân viên bị phạt -25 EXP`);
    } else {
      console.log('[CRON] No-show: không có vi phạm hôm nay');
    }
  } catch (err) {
    console.error('[CRON] No-show error:', err.message);
  }
}, { timezone: 'Asia/Ho_Chi_Minh' });

// ─── Cron: Birthday alert 08:00 ICT mỗi ngày ─────────────────────────────────

cron.schedule('0 8 * * *', async () => {
  console.log('[CRON] Birthday check...');
  try {
    const allStaff = db.getDb().prepare(
      `SELECT name, nickname, date_of_birth FROM staff WHERE status = 'active' AND date_of_birth IS NOT NULL`
    ).all();

    if (!allStaff.length) return;

    const now = new Date(new Date().getTime() + 7 * 60 * 60 * 1000); // ICT
    const todayMD = `${String(now.getMonth() + 1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in7MD = `${String(in7.getMonth() + 1).padStart(2,'0')}-${String(in7.getDate()).padStart(2,'0')}`;

    const birthdays = [];
    const upcoming  = [];

    for (const s of allStaff) {
      const dob = s.date_of_birth; // YYYY-MM-DD
      if (!dob) continue;
      const dobMD = dob.substring(5); // MM-DD
      const displayName = s.nickname || s.name;
      if (dobMD === todayMD) birthdays.push(displayName);
      else if (dobMD === in7MD) upcoming.push(displayName);
    }

    if (birthdays.length) {
      const msg = `🎂 Sinh nhật hôm nay\n\n` +
        birthdays.map(n => `${n}`).join('\n');
      broadcastEvent(bot, 'birthday', msg).catch(() => {});
    }

    if (upcoming.length) {
      const msg = `🗓 Sinh nhật trong 7 ngày tới\n\n` +
        upcoming.map(n => `${n}`).join('\n');
      broadcastEvent(bot, 'birthday', msg).catch(() => {});
    }
  } catch (err) {
    console.error('[CRON] Birthday error:', err.message);
  }
}, { timezone: 'Asia/Ho_Chi_Minh' });

// ─── Cron: 09:00 fallback shift open ─────────────────────────────────────────
// If nobody has checked in by 09:00, post a silent auto-open so there's a paper trail.

cron.schedule('0 9 * * *', async () => {
  try {
    const now = new Date();
    const ictNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const today = ictNow.toISOString().split('T')[0];
    const dd = String(ictNow.getUTCDate()).padStart(2, '0');
    const mo = String(ictNow.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = ictNow.getUTCFullYear();
    const dateDisplay = `${dd}/${mo}/${yyyy}`;

    // Only fire if no shift open exists yet today
    const alreadyOpened = db.hasAutoShiftReport('auto_moca', null, today);
    if (alreadyOpened) return;

    db.createShiftReport({
      staffId: null,
      reportType: 'auto_moca',
      reportData: JSON.stringify({ triggeredBy: 'system', trigger: 'time_fallback', openTime: '09:00' }),
      date: today,
    });

    const msg =
      `🟢 MỞ CA — ${dateDisplay}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⏰ 09:00 · chưa có nhân viên\n` +
      `━━━━━━━━━━━━━━━━━━━━`;

    await broadcastEvent(bot, 'checkin', msg, { message_thread_id: 172 });
  } catch (err) {
    console.error('[CRON] 09:00 shift fallback error:', err.message);
  }
}, { timezone: 'Asia/Ho_Chi_Minh' });

// ─── Analytics Jobs (Kai Sprint 1) ───────────────────────────────────────────

const { startDailyScorecardJob } = require('./jobs/daily_scorecard');
const { startWeeklyLeaderboardJob } = require('./jobs/weekly_leaderboard');
const { runMasterSheetSync } = require('./jobs/master_sheet_sync');

// Shared firedJobs map — tracks fired jobs to prevent double-firing on same day
// Key format: 'daily_scorecard_2026-02-28' or 'weekly_leaderboard_2026-03-02' → true
const firedJobs = new Map();

startDailyScorecardJob(bot, db, firedJobs);
startWeeklyLeaderboardJob(bot, db, firedJobs);

// ─── Cron: Master Sheet sync 23:00 ICT nightly ───────────────────────────────
cron.schedule('0 23 * * *', () => {
  runMasterSheetSync().catch(err => console.error('[CRON] master_sheet error:', err.message));
}, { timezone: 'Asia/Ho_Chi_Minh' });

// ─── Cron: Forgot checkout alert — 22:30 ICT ─────────────────────────────────
// Alert GMs/Managers of staff who checked in but never checked out.
// No EXP deduction — management reviews and decides manually.
cron.schedule('30 22 * * *', async () => {
  try {
    const ictNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const today = ictNow.toISOString().split('T')[0];

    const openSessions = db.getAllOpenCheckinsToday(today);
    if (!openSessions || openSessions.length === 0) return;

    // Build alert message
    const lines = openSessions.map(s => {
      const checkinTime = s.checkin_time
        ? new Date(s.checkin_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })
        : '—';
      return `• ${s.name} (${s.department || '—'}) — vào ca ${checkinTime}`;
    });

    const msg =
      `⚠️ CHƯA CHECKOUT — 22:30\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `${lines.join('\n')}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Quản lý kiểm tra và dùng /forcecheckout [tên] nếu cần.`;

    await broadcastEvent(bot, 'staff_onoff', msg);
    console.log(`[CRON] forgot-checkout alert: ${openSessions.length} session(s) open`);
  } catch (err) {
    console.error('[CRON] forgot-checkout error:', err.message);
  }
}, { timezone: 'Asia/Ho_Chi_Minh' });

// ─── Cron: Revenue report window opens — 23:59 ICT ────────────────────────────
// Notify the assigned reporter to submit today's revenue.
cron.schedule('59 23 * * *', async () => {
  try {
    const reporter = db.getActiveRevenueReporter();
    if (!reporter || !reporter.private_chat_id) return;

    const ictNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const today  = ictNow.toISOString().split('T')[0];

    const existing = db.getRevenueReport(today);
    if (existing && ['submitted', 'flagged'].includes(existing.status)) return; // already done

    await bot.sendMessage(reporter.private_chat_id,
      `📋 *Nhắc nhở: Báo cáo doanh thu hôm nay (${today})*\n` +
      `Cửa sổ nộp đã mở. Hạn: 23:59 ngày mai.\n\n` +
      `Dùng /baocaodoanhthu để bắt đầu.`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});

    console.log(`[CRON] Revenue window opened — notified ${reporter.name}`);
  } catch (err) {
    console.error('[CRON] revenue-window error:', err.message);
  }
}, { timezone: 'Asia/Ho_Chi_Minh' });

// ─── Cron: Revenue report missed window — 23:00 ICT next day ─────────────────
// If report not submitted by 23:00, alert GM/Creator.
cron.schedule('0 23 * * *', async () => {
  try {
    const ictNow   = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const today    = ictNow.toISOString().split('T')[0];
    // Check yesterday's report
    const ictYest  = new Date(Date.now() + 7 * 60 * 60 * 1000 - 86400000);
    const yesterday = ictYest.toISOString().split('T')[0];

    const report = db.getRevenueReport(yesterday);
    if (report && ['submitted', 'flagged'].includes(report.status)) return; // submitted

    const reporter  = db.getActiveRevenueReporter();
    const managers  = db.getAllActiveStaff().filter(s => ['gm', 'creator'].includes(s.role) && s.private_chat_id);

    for (const mgr of managers) {
      await bot.sendMessage(mgr.private_chat_id,
        `🚨 *Báo cáo doanh thu ${yesterday} CHƯA được nộp!*\n` +
        `Reporter: ${reporter ? reporter.name : 'Chưa có'}\n` +
        `Cần kiểm tra và xử lý.`,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
    console.log(`[CRON] Revenue missed window alert — ${yesterday}`);
  } catch (err) {
    console.error('[CRON] revenue-missed error:', err.message);
  }
}, { timezone: 'Asia/Ho_Chi_Minh' });

// ─── Cron: Monthly KPI analysis — 1st of month, 09:00 ICT ────────────────────
// Runs behavioral analysis on all staff, writes pending KPI suggestions to DB.
// GM reviews via /reviewkpis.
cron.schedule('0 9 1 * *', async () => {
  try {
    const results = kpiAnalyzer.runAnalysis(db);
    const analyzed = results.filter(r => r.status !== 'insufficient_data').length;
    const pending  = results.filter(r => r.status === 'insufficient_data').length;

    // Notify GM/Creator
    const managers = db.getAllActiveStaff().filter(s => ['gm', 'creator'].includes(s.role) && s.private_chat_id);
    for (const mgr of managers) {
      await bot.sendMessage(mgr.private_chat_id,
        `📊 *Phân tích KPI tháng này hoàn tất*\n\n` +
        `Đã phân tích: ${analyzed} nhân viên\n` +
        `Chưa đủ dữ liệu: ${pending} nhân viên\n\n` +
        `Dùng /reviewkpis để xem đề xuất và duyệt.`,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
    console.log(`[CRON] Monthly KPI analysis done — ${analyzed} analyzed, ${pending} pending data`);
  } catch (err) {
    console.error('[CRON] monthly-kpi error:', err.message);
  }
}, { timezone: 'Asia/Ho_Chi_Minh' });

// ─── ESOP Leaderboard Period Resets ──────────────────────────────────────────
// Weekly snapshot: every Monday 00:01 ICT — freeze exp_week_start for all active staff
cron.schedule('1 0 * * 1', () => {
  try {
    db.resetWeeklyExpSnapshots();
    console.log('[CRON] Weekly EXP snapshot reset — leaderboard period restarted');
  } catch (err) {
    console.error('[CRON] weekly-exp-reset error:', err.message);
  }
}, { timezone: 'Asia/Ho_Chi_Minh' });

// Monthly snapshot: 1st of each month 00:01 ICT
cron.schedule('1 0 1 * *', () => {
  try {
    db.resetMonthlyExpSnapshots();
    console.log('[CRON] Monthly EXP snapshot reset — leaderboard period restarted');
  } catch (err) {
    console.error('[CRON] monthly-exp-reset error:', err.message);
  }
}, { timezone: 'Asia/Ho_Chi_Minh' });

// ─── Edited Message Handler ───────────────────────────────────────────────────
// Handles message edits — routes back into guided flows so staff can fix typos
// during an active session without restarting the whole flow.
// Note: Telegram does NOT re-trigger onText for edits, so we catch them here.

bot.on('edited_message', async (msg) => {
  if (!msg || !msg.from) return;

  const telegramId = String(msg.from.id);
  const chatId = msg.chat.id;

  // Only process text edits
  if (!msg.text) return;

  // Track private_chat_id on edit (same as message handler)
  if (msg.chat.type === 'private') {
    const staff = db.getStaffByTelegramId(telegramId);
    if (staff && staff.status === 'active' && !staff.private_chat_id) {
      db.updatePrivateChatId(telegramId, chatId);
    }
  }

  // Commands in edits are not re-executed — silently ignore
  if (msg.text.startsWith('/')) return;

  // Only route guided flows in private chat
  if (msg.chat.type !== 'private') return;

  // Re-route into pending guided handlers (same priority as message handler)
  try {
    if (await bc.handlePendingBc(bot, msg, db)) return;
    if (await nhaphang.handlePendingNhaphang(bot, msg, db)) return;
    if (await bosung.handlePending(bot, msg, db)) return;
    if (await lichca.handlePendingLichca(bot, msg, db)) return;
  } catch (err) {
    console.error('[EDIT] guided flow error:', err.message);
  }
});

// ─── Start message ────────────────────────────────────────────────────────────

console.log('[BOT] DG_HR_BOT đang chạy... Ctrl+C để dừng.');
