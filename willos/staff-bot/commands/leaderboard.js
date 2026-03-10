/**
 * leaderboard.js — /leaderboard (/lb) command
 * Bảng xếp hạng nhân viên theo EXP
 */

const { formatLeaderboard } = require('../utils/format');

async function handle(bot, msg, args, db) {
  const chatId = msg.chat.id;
  const staffList = db.getLeaderboard(10);
  return bot.sendMessage(chatId, formatLeaderboard(staffList));
}

module.exports = { handle };
