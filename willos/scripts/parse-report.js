/**
 * scripts/parse-report.js — Shift Report Parser
 *
 * Parses raw Vietnamese shift report text (Telegram template)
 * into structured data and inserts into shift_report table.
 *
 * Usage:
 *   const { parseReport, saveReport } = require('./scripts/parse-report');
 *   const parsed = parseReport(rawText);
 *   const id = saveReport(db, parsed, rawText, 'telegram');
 */

'use strict';

/**
 * Extract a number from text, stripping Vietnamese currency suffixes.
 * Handles: "2500000đ", "2,500,000đ", "2.500.000đ", "250k", "2500000"
 *
 * @param {string} str
 * @returns {number}
 */
function extractNumber(str) {
  if (!str) return 0;
  str = str.trim();

  // Handle "k" suffix (e.g. "250k" → 250000)
  const kMatch = str.match(/([\d.,]+)\s*k/i);
  if (kMatch) {
    const num = parseFloat(kMatch[1].replace(/[.,]/g, ''));
    return num * 1000;
  }

  // Strip "đ", commas, dots used as thousand separators
  // Vietnamese convention: dots as thousand separators (2.500.000)
  let cleaned = str.replace(/đ/gi, '').trim();

  // If there are multiple dots/commas, they are thousand separators
  // e.g. "2.500.000" or "2,500,000"
  const separatorCount = (cleaned.match(/[.,]/g) || []).length;
  if (separatorCount > 1) {
    cleaned = cleaned.replace(/[.,]/g, '');
  } else if (separatorCount === 1) {
    // Single separator: could be decimal or thousand
    // If 3 digits after separator, it's a thousand separator
    const parts = cleaned.split(/[.,]/);
    if (parts[1] && parts[1].length === 3) {
      cleaned = cleaned.replace(/[.,]/g, '');
    }
    // Otherwise leave as decimal (unlikely for VND)
  }

  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Extract integer quantity from a line like "• Cơm cà ri: 18"
 *
 * @param {string} text  Full report text
 * @param {RegExp} pattern  Pattern to match the label
 * @returns {number}
 */
function extractQty(text, pattern) {
  const match = text.match(pattern);
  if (!match) return 0;
  const num = parseInt(match[1], 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Extract a section's content between its header emoji and the next section emoji.
 *
 * @param {string} text
 * @param {string} sectionEmoji  e.g. "🗑️"
 * @param {string[]} nextEmojis  Possible next section emojis
 * @returns {string}
 */
function extractSection(text, sectionEmoji, nextEmojis) {
  const startIdx = text.indexOf(sectionEmoji);
  if (startIdx === -1) return '';

  // Find the header line end
  const headerEnd = text.indexOf('\n', startIdx);
  if (headerEnd === -1) return '';

  // Find next section
  let endIdx = text.length;
  for (const emoji of nextEmojis) {
    const idx = text.indexOf(emoji, headerEnd);
    if (idx !== -1 && idx < endIdx) {
      endIdx = idx;
    }
  }

  const content = text.substring(headerEnd + 1, endIdx).trim();

  // Clean up bullet points and return as single string
  return content
    .split('\n')
    .map(line => line.replace(/^[•\-\s]+/, '').trim())
    .filter(Boolean)
    .join('; ');
}

/**
 * Parse raw shift report text into structured object.
 *
 * @param {string} rawText
 * @returns {object} Parsed report fields
 */
function parseReport(rawText) {
  const text = rawText || '';

  // --- Date ---
  let reportDate = '';
  const dateMatch = text.match(/ĐÓNG\s*CA\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i);
  if (dateMatch) {
    const parts = dateMatch[1].split('/');
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2] || new Date().getFullYear().toString();
    if (year.length === 2) year = '20' + year;
    reportDate = `${year}-${month}-${day}`;
  }

  // --- Reporter ---
  let reporter = '';
  const reporterMatch = text.match(/👤\s*(.+)/);
  if (reporterMatch) {
    reporter = reporterMatch[1].trim();
  }

  // --- Revenue ---
  const grabMatch = text.match(/Grab\s*:\s*(.+?)(?:\n|$)/i);
  const grabRevenue = grabMatch ? extractNumber(grabMatch[1]) : 0;

  const fabiMatch = text.match(/Fabi\s*:\s*(.+?)(?:\n|$)/i);
  const fabiRevenue = fabiMatch ? extractNumber(fabiMatch[1]) : 0;

  const totalRevenue = grabRevenue + fabiRevenue;

  // --- Quantities ---
  const qtyCurry = extractQty(text, /Cơm\s*cà\s*ri\s*:\s*(\d+)/i);
  const qtyRice = extractQty(text, /Cơm\s*don\s*(?:\/\s*katsudon)?\s*:\s*(\d+)/i);
  const qtyNoodle = extractQty(text, /Mì\s*xào\s*:\s*(\d+)/i);
  const qtyTakoyaki = extractQty(text, /Takoyaki\s*:\s*(\d+)/i);
  const qtyOther = extractQty(text, /Món\s*phụ\s*(?:\/\s*khác)?\s*:\s*(\d+)/i);

  // --- Stock ---
  const stockRiceMatch = text.match(/📦[\s\S]*?Cơm\s*:\s*(.+?)(?:\n|$)/i);
  const stockRice = stockRiceMatch ? stockRiceMatch[1].trim() : '';

  const stockNoodleMatch = text.match(/📦[\s\S]*?Mì\s*:\s*(.+?)(?:\n|$)/i);
  const stockNoodle = stockNoodleMatch ? stockNoodleMatch[1].trim() : '';

  const stockMissingMatch = text.match(/Thiếu\s*:\s*(.+?)(?:\n|$)/i);
  const stockMissing = stockMissingMatch ? stockMissingMatch[1].trim() : '';

  // --- Waste ---
  const wasteNote = extractSection(text, '🗑️', ['⚠️', '🚚']);

  // --- Incident ---
  const incidentNote = extractSection(text, '⚠️', ['🚚']);

  // --- Import/Export ---
  const importMatch = text.match(/Nhập\s*:\s*(.+?)(?:\n|$)/i);
  const importNote = importMatch ? importMatch[1].trim() : '';

  const exportMatch = text.match(/Xuất\s*:\s*(.+?)(?:\n|$)/i);
  const exportNote = exportMatch ? exportMatch[1].trim() : '';

  return {
    report_date: reportDate,
    reporter,
    grab_revenue: grabRevenue,
    fabi_revenue: fabiRevenue,
    total_revenue: totalRevenue,
    qty_curry: qtyCurry,
    qty_rice: qtyRice,
    qty_noodle: qtyNoodle,
    qty_takoyaki: qtyTakoyaki,
    qty_other: qtyOther,
    stock_rice: stockRice,
    stock_noodle: stockNoodle,
    stock_missing: stockMissing,
    waste_note: wasteNote,
    incident_note: incidentNote,
    import_note: importNote,
    export_note: exportNote,
  };
}

/**
 * Save parsed report to database.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} parsed  Output of parseReport()
 * @param {string} rawText  Original raw text
 * @param {string} source   e.g. 'telegram'
 * @returns {number} Inserted row id
 */
function saveReport(db, parsed, rawText, source = 'telegram') {
  const stmt = db.prepare(`
    INSERT INTO shift_report (
      report_date, reporter,
      grab_revenue, fabi_revenue, total_revenue,
      qty_curry, qty_rice, qty_noodle, qty_takoyaki, qty_other,
      stock_rice, stock_noodle, stock_missing,
      waste_note, incident_note, import_note, export_note,
      raw_text, source
    ) VALUES (
      @report_date, @reporter,
      @grab_revenue, @fabi_revenue, @total_revenue,
      @qty_curry, @qty_rice, @qty_noodle, @qty_takoyaki, @qty_other,
      @stock_rice, @stock_noodle, @stock_missing,
      @waste_note, @incident_note, @import_note, @export_note,
      @raw_text, @source
    )
  `);

  const result = stmt.run({
    ...parsed,
    raw_text: rawText,
    source,
  });

  return result.lastInsertRowid;
}

module.exports = { parseReport, saveReport, extractNumber };
