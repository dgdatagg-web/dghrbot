/**
 * baocaodoanhthu.js — /baocaodoanhthu
 * Isolated revenue reporting command. Fixed frame, step-by-step.
 * Only the assigned reporter can submit. GM/Creator receives the final report.
 *
 * Flow:
 *   /baocaodoanhthu         → start a new report for today
 *   (step-by-step guided input via session state)
 *   (photo upload → Nova cross-checks slip vs reported figures)
 *
 * Access:
 *   Submit:  assigned reporter only
 *   View:    GM / Creator only (+ explicit access grants)
 *   Assign:  GM / Creator only → /assignreporter [tên]
 */

'use strict';

const { fmt } = require('../utils/format');

// ─── Creator MB account for cross-check ───────────────────────────────────────
const CREATOR_ACCOUNT = '80817777128';
const CREATOR_NAME    = 'DO NGOC MINH';
const DRIVE_FOLDER_ID = '1f5wqFNpV_5sUY9AISN-07CqWDTaFyh-Y';

// ─── In-memory session state per chat ─────────────────────────────────────────
// { [chatId]: { step, reportDate, data: {}, reportId } }
const sessions = new Map();

const STEPS = [
  'tien_mat',
  'chuyen_khoan',
  'grab',
  'chi_phi',
  'ket_cuoi_ngay',
  'receipts',
  'done',
];

const STEP_PROMPTS = {
  tien_mat:      '💵 *Bước 1/6 — Tiền Mặt*\nNhập số tiền mặt thu trong ngày (đ):',
  chuyen_khoan:  '🏦 *Bước 2/6 — Chuyển Khoản trực tiếp*\nKhách chuyển thẳng vào tài khoản Creator (đ):',
  grab:          '🛵 *Bước 3/6 — Grab/Online*\nDoanh thu Grab hôm nay (đ). Nhập 0 nếu không có:',
  chi_phi:       '📋 *Bước 4/6 — Chi Phí*\nNhập theo định dạng: [tên khoản] [số tiền]\nVí dụ: `NH Tuần 1/T3 L2 8986150`',
  ket_cuoi_ngay: '📊 *Bước 5/6 — Kết Cuối Ngày*\nNhập số dư cuối ngày (đ):',
  receipts:      '🧾 *Bước 6/6 — Chứng từ*\nGửi ảnh chứng từ chuyển khoản (1 hoặc nhiều ảnh).\nKhi xong tất cả ảnh, nhắn `/xong` để hoàn tất.',
};

function ictToday() {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return now.toISOString().split('T')[0];
}

function parseMoney(text) {
  const cleaned = text.replace(/[.,\s₫đvnd]/gi, '').trim();
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : n;
}

function formatMoney(n) {
  if (n == null) return '—';
  return n.toLocaleString('vi-VN') + 'đ';
}

// ─── Start command ─────────────────────────────────────────────────────────────

async function handle(bot, msg, _args, db) {
  const chatId     = msg.chat.id;
  const telegramId = String(msg.from.id);
  const staff      = db.getStaffByTelegramId(telegramId);

  if (!staff) return bot.sendMessage(chatId, '❌ Bạn chưa đăng ký trong hệ thống.');

  // Only assigned reporter OR GM/Creator can open a report
  const isPrivileged = ['gm', 'creator'].includes(staff.role);
  const reporter     = db.getActiveRevenueReporter();

  if (!isPrivileged) {
    if (!reporter || reporter.staff_id !== staff.id) {
      return bot.sendMessage(chatId, '❌ Bạn không được phân công báo cáo doanh thu hôm nay.');
    }
  }

  const today = ictToday();

  // Check if already submitted
  const existing = db.getRevenueReport(today);
  if (existing && existing.status === 'submitted') {
    return bot.sendMessage(chatId,
      `✅ Báo cáo ngày ${today} đã được nộp.\nDùng /xemdoanhthu để xem (GM/Creator only).`,
      { parse_mode: 'Markdown' }
    );
  }

  // Create or resume
  const report = db.getOrCreateRevenueReport(today, staff.id);
  sessions.set(chatId, { step: 'tien_mat', reportDate: today, reportId: report.id, data: {} });

  await bot.sendMessage(chatId,
    `📋 *Báo cáo Doanh Thu — ${today}*\n\nBắt đầu nhập từng mục. Nhập số, không cần đơn vị.\n\n` +
    STEP_PROMPTS.tien_mat,
    { parse_mode: 'Markdown' }
  );
}

// ─── Step handler (text messages) ─────────────────────────────────────────────

async function handleStep(bot, msg, db) {
  const chatId = msg.chat.id;
  const text   = (msg.text || '').trim();
  const state  = sessions.get(chatId);
  if (!state || state.step === 'done') return false;

  // Cancel command
  if (text === '/huy' || text === '/cancel') {
    sessions.delete(chatId);
    await bot.sendMessage(chatId, '❌ Đã huỷ báo cáo. Dùng /baocaodoanhthu để bắt đầu lại.');
    return true;
  }

  // Done command (end receipt phase)
  if (text === '/xong' && state.step === 'receipts') {
    return await finalizeReport(bot, chatId, db, state);
  }

  const step = state.step;

  if (step === 'tien_mat') {
    const val = parseMoney(text);
    if (val === null) {
      await bot.sendMessage(chatId, '⚠️ Không đọc được số. Nhập lại (ví dụ: `122300` hoặc `122,300`)', { parse_mode: 'Markdown' });
      return true;
    }
    state.data.tien_mat = val;
    state.step = 'chuyen_khoan';
    await bot.sendMessage(chatId, `✅ Tiền Mặt: ${formatMoney(val)}\n\n` + STEP_PROMPTS.chuyen_khoan, { parse_mode: 'Markdown' });
    return true;
  }

  if (step === 'chuyen_khoan') {
    const val = parseMoney(text);
    if (val === null) {
      await bot.sendMessage(chatId, '⚠️ Không đọc được số. Nhập lại:', { parse_mode: 'Markdown' });
      return true;
    }
    state.data.chuyen_khoan = val;
    state.step = 'grab';
    await bot.sendMessage(chatId, `✅ Chuyển Khoản: ${formatMoney(val)}\n\n` + STEP_PROMPTS.grab, { parse_mode: 'Markdown' });
    return true;
  }

  if (step === 'grab') {
    const val = parseMoney(text);
    if (val === null) {
      await bot.sendMessage(chatId, '⚠️ Không đọc được số. Nhập lại:', { parse_mode: 'Markdown' });
      return true;
    }
    state.data.grab = val;
    state.step = 'chi_phi';
    await bot.sendMessage(chatId, `✅ Grab: ${formatMoney(val)}\n\n` + STEP_PROMPTS.chi_phi, { parse_mode: 'Markdown' });
    return true;
  }

  if (step === 'chi_phi') {
    // Format: "[label] [amount]"
    const parts  = text.trim().split(/\s+/);
    const amount = parseMoney(parts[parts.length - 1]);
    const label  = parts.slice(0, -1).join(' ') || 'Chi phí';
    if (amount === null) {
      await bot.sendMessage(chatId, '⚠️ Không đọc được số tiền. Nhập lại (ví dụ: `NH Tuần 1 8986150`):', { parse_mode: 'Markdown' });
      return true;
    }
    state.data.chi_phi       = amount;
    state.data.chi_phi_label = label;
    state.step = 'ket_cuoi_ngay';
    await bot.sendMessage(chatId, `✅ Chi Phí: ${label} — ${formatMoney(amount)}\n\n` + STEP_PROMPTS.ket_cuoi_ngay, { parse_mode: 'Markdown' });
    return true;
  }

  if (step === 'ket_cuoi_ngay') {
    const val = parseMoney(text);
    if (val === null) {
      await bot.sendMessage(chatId, '⚠️ Không đọc được số. Nhập lại:', { parse_mode: 'Markdown' });
      return true;
    }
    state.data.ket_cuoi_ngay = val;

    // Compute TỔNG DT
    const tongDt = (state.data.tien_mat || 0) + (state.data.chuyen_khoan || 0) + (state.data.grab || 0);
    state.data.tong_dt = tongDt;

    state.step = 'receipts';
    state.receipts = [];

    // Show summary so far
    const summary =
      `📊 *Tóm tắt báo cáo ${state.reportDate}*\n\n` +
      `OFFLINE\n` +
      `  Tiền Mặt:        ${formatMoney(state.data.tien_mat)}\n` +
      `  Chuyển Khoản:    ${formatMoney(state.data.chuyen_khoan)}\n` +
      `ONLINE\n` +
      `  Grab:            ${formatMoney(state.data.grab)}\n` +
      `─────────────────────\n` +
      `TỔNG DT:           ${formatMoney(tongDt)}\n` +
      `CHI PHÍ (${state.data.chi_phi_label}): ${formatMoney(state.data.chi_phi)}\n` +
      `KẾT CUỐI NGÀY:     ${formatMoney(val)}\n\n` +
      STEP_PROMPTS.receipts;

    await bot.sendMessage(chatId, summary, { parse_mode: 'Markdown' });
    return true;
  }

  // In receipts step but text (not photo) → remind
  if (step === 'receipts') {
    if (text !== '/xong') {
      await bot.sendMessage(chatId, 'Gửi ảnh chứng từ, hoặc nhắn `/xong` nếu đã xong tất cả.', { parse_mode: 'Markdown' });
    }
    return true;
  }

  return false;
}

// ─── Photo handler ─────────────────────────────────────────────────────────────

async function handlePhoto(bot, msg, db) {
  const chatId = msg.chat.id;
  const state  = sessions.get(chatId);
  if (!state || state.step !== 'receipts') return false;

  // Get highest-res photo
  const photos = msg.photo;
  const photo  = photos[photos.length - 1];
  const fileId = photo.file_id;

  state.receipts = state.receipts || [];
  state.receipts.push(fileId);

  const n = state.receipts.length;
  await bot.sendMessage(chatId,
    `✅ Đã nhận ảnh ${n}. Gửi thêm ảnh khác hoặc nhắn /xong để hoàn tất.`,
    { parse_mode: 'Markdown' }
  );
  return true;
}

// ─── Finalize report ───────────────────────────────────────────────────────────

async function finalizeReport(bot, chatId, db, state) {
  if (!state.receipts || state.receipts.length === 0) {
    await bot.sendMessage(chatId, '⚠️ Cần ít nhất 1 ảnh chứng từ. Gửi ảnh trước khi hoàn tất.');
    return true;
  }

  await bot.sendMessage(chatId, '⏳ Đang xử lý và xác minh chứng từ...');

  const { data, reportDate, reportId } = state;

  // Save report figures
  db.updateRevenueReport(reportDate, {
    tien_mat:      data.tien_mat,
    chuyen_khoan:  data.chuyen_khoan,
    grab:          data.grab,
    tong_dt:       data.tong_dt,
    chi_phi:       data.chi_phi,
    chi_phi_label: data.chi_phi_label,
    ket_cuoi_ngay: data.ket_cuoi_ngay,
    status:        'verifying',
    submitted_at:  new Date().toISOString(),
  });

  // Store receipts + cross-check each
  const mismatches = [];
  for (const fileId of state.receipts) {
    const receipt = db.addRevenueReceipt(reportId, fileId, 'bank_slip');
    const receiptId = receipt.lastInsertRowid;

    // Cross-check via vision
    const checkResult = await crossCheckSlip(bot, fileId, data, reportDate);
    db.updateReceiptMatch(receiptId, {
      extracted_amount:  checkResult.amount,
      extracted_date:    checkResult.date,
      extracted_account: checkResult.account,
      extracted_ref:     checkResult.ref,
      matched:           checkResult.matched ? 1 : 0,
      mismatch_note:     checkResult.mismatchNote || null,
    });

    if (!checkResult.matched) {
      mismatches.push(checkResult.mismatchNote);
    }
  }

  // Upload to Drive (async, fire and forget for now — stub)
  uploadReceiptsToDrive(bot, state.receipts, reportDate, db, reportId).catch(err => {
    console.error('[Revenue] Drive upload error:', err.message);
  });

  sessions.delete(chatId);

  if (mismatches.length > 0) {
    // Flag to reporter
    await bot.sendMessage(chatId,
      `⚠️ *Phát hiện sai lệch trong chứng từ:*\n\n` +
      mismatches.map((m, i) => `${i + 1}. ${m}`).join('\n') +
      `\n\nBáo cáo đã được giữ lại và gửi cho GM/Creator xem xét.`,
      { parse_mode: 'Markdown' }
    );
    db.updateRevenueReport(reportDate, { status: 'flagged' });
  } else {
    await bot.sendMessage(chatId, '✅ Báo cáo đã nộp thành công. Tất cả chứng từ khớp.');
    db.updateRevenueReport(reportDate, { status: 'submitted' });
  }

  // Notify GM/Creator regardless
  await notifyManagement(bot, db, reportDate, data, mismatches);
  return true;
}

// ─── Vision cross-check ────────────────────────────────────────────────────────

async function crossCheckSlip(bot, fileId, reportData, reportDate) {
  try {
    // Get file URL from Telegram
    const file    = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;

    // Call vision LLM to extract slip data
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Fetch image as base64
    const https    = require('https');
    const imageB64 = await new Promise((resolve, reject) => {
      https.get(fileUrl, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
        res.on('error', reject);
      });
    });

    const resp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: imageB64 },
          },
          {
            type: 'text',
            text: `This is a bank transfer receipt. Extract the following as JSON only, no explanation:
{
  "amount": <number in VND, no commas>,
  "date": "<DD/MM/YYYY or YYYY-MM-DD>",
  "account": "<destination account number>",
  "recipient": "<recipient name>",
  "ref": "<transfer reference/note if visible>"
}
If a field is not visible, use null.`,
          },
        ],
      }],
    });

    const raw = resp.content[0]?.text?.trim() || '{}';
    let extracted = {};
    try {
      // Strip markdown code fences if present
      const clean = raw.replace(/```json?/g, '').replace(/```/g, '').trim();
      extracted = JSON.parse(clean);
    } catch { /* parse failed — treat as no data */ }

    // Cross-check rules
    const mismatches = [];

    // 1. Account should match Creator MB account
    if (extracted.account && !extracted.account.includes(CREATOR_ACCOUNT)) {
      mismatches.push(`Tài khoản nhận ${extracted.account} ≠ ${CREATOR_ACCOUNT} (${CREATOR_NAME})`);
    }

    // 2. Amount should match one of the reported figures (tiền mặt or chuyển khoản direct)
    if (extracted.amount != null) {
      const expected = [reportData.tien_mat, reportData.chuyen_khoan].filter(Boolean);
      const amountMatch = expected.some(e => Math.abs(e - extracted.amount) <= 1000); // 1k tolerance
      if (!amountMatch) {
        mismatches.push(`Số tiền trên chứng từ ${extracted.amount.toLocaleString('vi-VN')}đ không khớp với Tiền Mặt (${(reportData.tien_mat||0).toLocaleString('vi-VN')}đ) hoặc CK (${(reportData.chuyen_khoan||0).toLocaleString('vi-VN')}đ)`);
      }
    }

    return {
      amount:       extracted.amount,
      date:         extracted.date,
      account:      extracted.account,
      ref:          extracted.ref,
      matched:      mismatches.length === 0,
      mismatchNote: mismatches.join('; ') || null,
    };

  } catch (err) {
    console.error('[Revenue] crossCheckSlip error:', err.message);
    return { matched: false, mismatchNote: `Không thể đọc chứng từ: ${err.message}` };
  }
}

// ─── Drive upload (stub — activates when Drive creds confirmed) ────────────────

async function uploadReceiptsToDrive(bot, fileIds, date, db, reportId) {
  try {
    const { uploadFileToDrive } = require('../modules/driveTool');
    for (let i = 0; i < fileIds.length; i++) {
      const fileId = fileIds[i];
      const file   = await bot.getFile(fileId);
      const url    = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
      const name   = `revenue_${date}_slip${i + 1}.jpg`;
      const driveId = await uploadFileToDrive(url, name, DRIVE_FOLDER_ID);
      if (driveId) {
        const receipts = db.getReceiptsByReport(reportId);
        const receipt  = receipts[i];
        if (receipt) db.updateReceiptMatch(receipt.id, { drive_file_id: driveId });
      }
    }
    db.updateRevenueReport(date, { drive_folder_id: DRIVE_FOLDER_ID });
    console.log(`[Revenue] Drive upload complete — ${date}`);
  } catch (err) {
    console.error('[Revenue] Drive upload failed:', err.message);
  }
}

// ─── Notify GM/Creator ─────────────────────────────────────────────────────────

async function notifyManagement(bot, db, date, data, mismatches) {
  try {
    const managers = db.getAllActiveStaff().filter(s => ['gm', 'creator'].includes(s.role) && s.private_chat_id);
    const status   = mismatches.length > 0 ? '⚠️ CÓ SAI LỆCH' : '✅ HỢP LỆ';
    const offlineDt = (data.tien_mat || 0) + (data.chuyen_khoan || 0);

    const msg =
      `📊 *Báo Cáo Doanh Thu — ${date}*\n` +
      `Trạng thái: ${status}\n\n` +
      `OFFLINE:          ${(offlineDt).toLocaleString('vi-VN')}đ\n` +
      `  Tiền Mặt:       ${(data.tien_mat||0).toLocaleString('vi-VN')}đ\n` +
      `  Chuyển Khoản:   ${(data.chuyen_khoan||0).toLocaleString('vi-VN')}đ\n` +
      `ONLINE (Grab):    ${(data.grab||0).toLocaleString('vi-VN')}đ\n` +
      `─────────────────────────\n` +
      `TỔNG DT:          ${(data.tong_dt||0).toLocaleString('vi-VN')}đ\n` +
      `CHI PHÍ (${data.chi_phi_label||''}): ${(data.chi_phi||0).toLocaleString('vi-VN')}đ\n` +
      `KẾT CUỐI NGÀY:    ${(data.ket_cuoi_ngay||0).toLocaleString('vi-VN')}đ\n` +
      (mismatches.length > 0 ? `\n⚠️ *Sai lệch:*\n${mismatches.map(m => `• ${m}`).join('\n')}` : '');

    for (const mgr of managers) {
      await bot.sendMessage(mgr.private_chat_id, msg, { parse_mode: 'Markdown' }).catch(() => {});
    }
  } catch (err) {
    console.error('[Revenue] notifyManagement error:', err.message);
  }
}

// ─── /xemdoanhthu — view report (GM/Creator only) ─────────────────────────────

async function handleView(bot, msg, args, db) {
  const chatId     = msg.chat.id;
  const telegramId = String(msg.from.id);
  const staff      = db.getStaffByTelegramId(telegramId);

  if (!staff || !['gm', 'creator'].includes(staff.role)) {
    // Check explicit access grant
    if (!staff || !db.hasAccess(staff.id, 'revenue_view', null)) {
      return bot.sendMessage(chatId, '❌ Không có quyền xem doanh thu.');
    }
  }

  const date   = args[0] || ictToday();
  const report = db.getRevenueReport(date);

  if (!report) {
    return bot.sendMessage(chatId, `📭 Chưa có báo cáo cho ngày ${date}.`);
  }

  const offlineDt = report.tien_mat + report.chuyen_khoan;
  const statusMap = {
    pending:    '⏳ Chưa nộp',
    verifying:  '🔄 Đang xác minh',
    flagged:    '⚠️ Có sai lệch',
    submitted:  '✅ Đã nộp',
  };

  await bot.sendMessage(chatId,
    `📊 *Doanh Thu — ${date}*\n` +
    `Trạng thái: ${statusMap[report.status] || report.status}\n\n` +
    `OFFLINE:          ${offlineDt.toLocaleString('vi-VN')}đ\n` +
    `  Tiền Mặt:       ${report.tien_mat.toLocaleString('vi-VN')}đ\n` +
    `  Chuyển Khoản:   ${report.chuyen_khoan.toLocaleString('vi-VN')}đ\n` +
    `ONLINE (Grab):    ${report.grab.toLocaleString('vi-VN')}đ\n` +
    `─────────────────────────\n` +
    `TỔNG DT:          ${report.tong_dt.toLocaleString('vi-VN')}đ\n` +
    `CHI PHÍ (${report.chi_phi_label||''}): ${report.chi_phi.toLocaleString('vi-VN')}đ\n` +
    `KẾT CUỐI NGÀY:    ${report.ket_cuoi_ngay.toLocaleString('vi-VN')}đ`,
    { parse_mode: 'Markdown' }
  );
}

// ─── /assignreporter — assign reporter duty (GM/Creator only) ─────────────────

async function handleAssign(bot, msg, args, db) {
  const chatId     = msg.chat.id;
  const telegramId = String(msg.from.id);
  const actor      = db.getStaffByTelegramId(telegramId);

  if (!actor || !['gm', 'creator'].includes(actor.role)) {
    return bot.sendMessage(chatId, '❌ Chỉ GM và Creator mới được phân công reporter.');
  }

  if (!args || args.length === 0) {
    const current = db.getActiveRevenueReporter();
    if (!current) return bot.sendMessage(chatId, '📭 Chưa có ai được phân công báo cáo doanh thu.');
    return bot.sendMessage(chatId, `📋 Reporter hiện tại: *${current.name}*`, { parse_mode: 'Markdown' });
  }

  const targetName = args.join(' ').trim();
  const target     = db.getStaffByName(targetName);
  if (!target) return bot.sendMessage(chatId, `❌ Không tìm thấy nhân viên: ${targetName}`);

  db.assignRevenueReporter(target.id, actor.id);
  await bot.sendMessage(chatId,
    `✅ Đã phân công *${target.name}* làm reporter doanh thu.\n` +
    `Cửa sổ nộp: mở 23:59 hôm nay, đóng 23:59 ngày mai.`,
    { parse_mode: 'Markdown' }
  );

  // Notify the assigned reporter via DM
  if (target.private_chat_id) {
    await bot.sendMessage(target.private_chat_id,
      `📋 Bạn được phân công *báo cáo doanh thu* hôm nay.\n` +
      `Dùng /baocaodoanhthu để bắt đầu.\n` +
      `Hạn nộp: 23:59 ngày mai.`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }
}

module.exports = { handle, handleStep, handlePhoto, handleView, handleAssign };
