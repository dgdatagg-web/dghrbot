/**
 * shift_report.js — Parser báo cáo ca tự do từ Telegram group
 * 
 * Hỗ trợ format thực tế từ nhân viên DG Group:
 *   - Mở bếp / Tồn đầu ca
 *   - Bàn giao ca (ra đông, prep, fill)
 *   - Đóng ca (doanh thu, huỷ, sai sót, nhập/xuất)
 */

'use strict';

const DG_GROUP_IDS = [-1003613329641, -1003827938422, -1003743309217, -1003742682679];
const TOPIC = {
  baocao:   172,
  tuchi:    173,
  nhaphang: 174,
  standup:  177,
};

/**
 * Detect loại báo cáo từ text
 */
function detectReportType(text) {
  const t = text.toLowerCase();
  if (/mở bếp|mo bep|tồn.*\d+\/\d+|ton.*\d+\/\d+/.test(t)) return 'open';
  if (/bàn giao|ban giao|giao ca/.test(t)) return 'handover';
  if (/đóng ca|dong ca/.test(t)) return 'close';
  return 'general';
}

/**
 * Extract tên nhân viên từ text
 * VD: "Bàn giao prep ca sáng 27/2/26 BETY" → "BETY"
 *     "Giao ca sáng 27/02 Chi" → "Chi"
 *     "Mở bếp 27/2 Hiếu" → "Hiếu"
 */
function extractReporter(text) {
  // Pattern: [keyword] [ngày] [Tên]
  const patterns = [
    /(?:mở bếp|mo bep|đóng ca|dong ca|bàn giao|ban giao|giao ca)[^\n]*?\d+\/\d+(?:\/\d+)?\s+([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zA-ZÀ-ỹ]+)/i,
    /(?:mở bếp|mo bep)[^\n]*?(hiếu|tân|bety|thảo|thu|nhân|lý|khôi|nhím|chi)/i,
    /(?:bàn giao|giao ca)[^\n]*(hiếu|tân|bety|thảo|thu|nhân|lý|khôi|nhím|chi)/i,
    /(?:đóng ca|dong ca)[^\n]*(hiếu|tân|bety|thảo|thu|nhân|lý|khôi|nhím|chi)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

/**
 * Extract ngày từ text (DD/MM hoặc DD/MM/YY)
 */
function extractDate(text) {
  const m = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (!m) return new Date().toISOString().slice(0, 10);
  const d = m[1].padStart(2, '0');
  const mo = m[2].padStart(2, '0');
  const yr = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : new Date().getFullYear();
  return `${yr}-${mo}-${d}`;
}

/**
 * Extract số từ dòng text
 * VD: "- 20 heo" → 20, "Heo 30" → 30
 */
function extractNumber(line) {
  const m = line.match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

/**
 * Parse tồn kho từ block text
 * VD: "20 heo\n2 gà\n7 tôm"
 */
function parseInventory(text) {
  const items = {};
  const lines = text.split('\n');
  for (const line of lines) {
    const l = line.toLowerCase().trim();
    if (!l) continue;
    const n = extractNumber(l);
    if (n === null) continue;
    if (/heo|lợn/.test(l)) items.heo = n;
    else if (/gà|ga/.test(l)) items.ga = n;
    else if (/tôm|tom/.test(l)) items.tom = n;
    else if (/bò|bo/.test(l)) items.bo = n;
    else if (/mực|muc/.test(l)) items.muc = n;
    else if (/trứng|trung/.test(l)) items.trung = n;
  }
  return items;
}

/**
 * Parse doanh thu
 * VD: "Doanh thu: 3.500.000" hoặc "3.5tr"
 */
function parseRevenue(text) {
  const t = text.toLowerCase();
  
  // "X.XXXtr" or "X,XXXtr" 
  const trMatch = t.match(/(\d+(?:[.,]\d+)?)\s*tr/);
  if (trMatch) {
    return Math.round(parseFloat(trMatch[1].replace(',', '.')) * 1000000);
  }

  // Plain number with dots/commas
  const numMatch = t.match(/doanh thu[^\d]*(\d[\d.,]+)/);
  if (numMatch) {
    return parseInt(numMatch[1].replace(/[.,]/g, ''), 10);
  }

  return 0;
}

/**
 * Extract section từ text (nội dung sau keyword đến keyword tiếp theo)
 */
function extractSection(text, keywords) {
  for (const kw of keywords) {
    const regex = new RegExp(`(?:${kw})[:\\s]*([\\s\\S]*?)(?=\\n(?:Đã|Da|Giao|Bàn|Ban|Đóng|Dong|Nhập|Nhap|Xuất|Xuat|Huỷ|Huy|Đơn|Don|Doanh|$))`, 'i');
    const m = text.match(regex);
    if (m) return m[1].trim();
  }
  return '';
}

/**
 * Main parser: text tự do → structured object
 */
function parseShiftReport(text, senderName) {
  const type = detectReportType(text);
  const reporter = extractReporter(text) || senderName || 'unknown';
  const reportDate = extractDate(text);

  const result = {
    type,
    reporter,
    reportDate,
    raw: text,
    source: 'telegram_group',
  };

  if (type === 'open') {
    // Parse tồn kho đầu ca
    const invSection = text.replace(/mở bếp[^\n]*/i, '').replace(/tồn[^\n]*/i, '');
    result.inventoryOpen = parseInventory(invSection);
  }

  if (type === 'handover') {
    // Ra đông
    const thawedSection = extractSection(text, ['đã ra đông', 'da ra dong', 'ra đông', 'ra dong']);
    result.thawed = thawedSection;

    // Prep
    const prepSection = extractSection(text, ['đã prep', 'da prep', 'prep']);
    result.prepped = prepSection;

    // Fill thiếu / chưa fill
    const fillSection = extractSection(text, ['chưa fill', 'chua fill', 'đã fill', 'da fill']);
    result.fillNotes = fillSection;

    // Cơm / mì
    const comMiMatch = text.match(/(?:cơm|com)[^\n]*/i);
    if (comMiMatch) result.comNotes = comMiMatch[0].trim();
    const miMatch = text.match(/(?:mì|mi)[^\n]*/i);
    if (miMatch) result.miNotes = miMatch[0].trim();

    // Huỷ hàng
    const huySection = extractSection(text, ['huỷ hàng', 'huy hang', 'huỷ']);
    result.wasted = huySection;

    // Đơn sai sót
    const saiMatch = text.match(/(?:đơn sai sót|don sai sot|sai sót)[^\n]*/i);
    result.ordersWrong = saiMatch ? saiMatch[0] : '0';

    // Nhập hàng
    const nhapSection = extractSection(text, ['nhập hàng', 'nhap hang']);
    result.imported = nhapSection;

    // Xuất hàng
    const xuatSection = extractSection(text, ['xuất hàng', 'xuat hang']);
    result.exported = xuatSection;
  }

  if (type === 'close') {
    result.wasted = extractSection(text, ['huỷ hàng', 'huy hang']);
    result.ordersWrong = extractSection(text, ['đơn sai sót', 'sai sót', 'sao']);
    result.imported = extractSection(text, ['nhập hàng', 'nhap hang']);
    result.exported = extractSection(text, ['xuất hàng', 'xuat hang']);
    result.revenue = parseRevenue(text);

    // Cơm / mì tồn
    const comMiMatch = text.match(/cơm[^\n]*/i);
    if (comMiMatch) result.comNotes = comMiMatch[0].trim();
    const miMatch = text.match(/mì[^\n]*/i);
    if (miMatch) result.miNotes = miMatch[0].trim();
  }

  return result;
}

/**
 * Format parsed report thành summary message để push vào group
 */
function formatReportSummary(parsed) {
  const typeLabel = {
    open: '🌅 MỞ BẾP',
    handover: '🔄 BÀN GIAO CA',
    close: '🌙 ĐÓNG CA',
    general: '📋 BÁO CÁO',
  }[parsed.type] || '📋 BÁO CÁO';

  const d = parsed.reportDate.split('-').reverse().join('/');
  let msg = `${typeLabel} — ${d}\n👤 ${parsed.reporter}\n━━━━━━━━━━━━━`;

  if (parsed.type === 'open' && parsed.inventoryOpen) {
    const inv = parsed.inventoryOpen;
    const parts = [];
    if (inv.heo !== undefined) parts.push(`Heo: ${inv.heo}`);
    if (inv.ga !== undefined) parts.push(`Gà: ${inv.ga}`);
    if (inv.tom !== undefined) parts.push(`Tôm: ${inv.tom}`);
    if (inv.bo !== undefined) parts.push(`Bò: ${inv.bo}`);
    msg += `\n📦 Tồn: ${parts.join(', ') || '(chưa parse được)'}`;
  }

  if (parsed.type === 'handover') {
    if (parsed.thawed) msg += `\n❄️ Ra đông: ${parsed.thawed.slice(0, 80)}`;
    if (parsed.prepped) msg += `\n🍳 Prep: ${parsed.prepped.slice(0, 80)}`;
    if (parsed.wasted) msg += `\n🗑️ Huỷ: ${parsed.wasted.slice(0, 60)}`;
    if (parsed.ordersWrong) msg += `\n⚠️ Sai sót: ${parsed.ordersWrong.slice(0, 60)}`;
    if (parsed.imported) msg += `\n📦 Nhập: ${parsed.imported.slice(0, 60)}`;
    if (parsed.exported) msg += `\n📤 Xuất: ${parsed.exported.slice(0, 60)}`;
  }

  if (parsed.type === 'close') {
    if (parsed.revenue) msg += `\n💰 Doanh thu: ${Number(parsed.revenue).toLocaleString('vi-VN')}đ`;
    if (parsed.wasted) msg += `\n🗑️ Huỷ: ${parsed.wasted.slice(0, 60)}`;
    if (parsed.ordersWrong) msg += `\n⚠️ Sai sót: ${parsed.ordersWrong.slice(0, 80)}`;
    if (parsed.exported) msg += `\n📤 Xuất: ${parsed.exported.slice(0, 60)}`;
  }

  msg += `\n━━━━━━━━━━━━━\n✅ Đã lưu vào WillOS`;
  return msg;
}

/**
 * Save parsed report vào DB
 */
function saveReportToDB(db, parsed) {
  try {
    // Ensure table exists
    db.getDb().exec(`
      CREATE TABLE IF NOT EXISTS shift_report_raw (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_date TEXT,
        report_type TEXT,
        reporter TEXT,
        raw_text TEXT,
        parsed_json TEXT,
        source TEXT DEFAULT 'telegram_group',
        created_at TEXT DEFAULT (datetime('now','localtime'))
      )
    `);

    db.getDb().prepare(`
      INSERT INTO shift_report_raw (report_date, report_type, reporter, raw_text, parsed_json, source)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      parsed.reportDate,
      parsed.type,
      parsed.reporter,
      parsed.raw,
      JSON.stringify(parsed),
      'telegram_group'
    );

    return true;
  } catch (err) {
    console.error('[shift_report] DB save error:', err.message);
    return false;
  }
}

/**
 * Register handler vào bot
 * Lắng nghe message từ topic 172 (báo cáo ca) và 177 (standup)
 */
function registerGroupReportHandler(bot, db) {
  bot.on('message', (msg) => {
    // Chỉ xử lý message từ group DG
    if (!DG_GROUP_IDS.includes(msg.chat.id)) return;

    const topicId = msg.message_thread_id;
    // Chỉ xử lý topic báo cáo (172) và standup (177)
    if (topicId !== TOPIC.baocao && topicId !== TOPIC.standup) return;

    const text = msg.text || msg.caption || '';
    if (!text || text.length < 20) return; // quá ngắn, bỏ qua

    // Chỉ parse nếu có keyword báo cáo
    const t = text.toLowerCase();
    const hasKeyword = /mở bếp|mo bep|bàn giao|ban giao|giao ca|đóng ca|dong ca|prep|ra đông|ra dong|tồn|doanh thu/.test(t);
    if (!hasKeyword) return;

    const senderName = msg.from?.first_name || msg.from?.username || 'unknown';
    const parsed = parseShiftReport(text, senderName);

    // Save to DB
    const saved = saveReportToDB(db, parsed);

    // Push summary vào topic 172 để confirm
    if (saved) {
      const summary = formatReportSummary(parsed);
      bot.sendMessage(msg.chat.id, summary, {
        parse_mode: 'HTML',
        message_thread_id: TOPIC.baocao,
      }).catch(err => console.error('[shift_report] push error:', err.message));
    }

    console.log(`[shift_report] Parsed ${parsed.type} from ${parsed.reporter} on ${parsed.reportDate}`);
  });

  console.log('[shift_report] Group report handler registered — watching topics 172, 177');
}

module.exports = { parseShiftReport, formatReportSummary, saveReportToDB, registerGroupReportHandler };
