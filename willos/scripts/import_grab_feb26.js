#!/usr/bin/env node
/**
 * import_grab_feb26.js
 * Imports Grab Feb 2026 CSV exports into WillOS SQLite DB
 * Tables: grab_raw, daily_operations, grab_offers, grab_peak_hour, grab_combos
 *
 * Run: node willos/scripts/import_grab_feb26.js
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '../data/willos.db');
const CSV_DIR = path.join(__dirname, '../../data/grab-2026-02');

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h.trim()] = (vals[i] || '').trim(); });
    return row;
  }).filter(r => Object.values(r).some(v => v)); // skip empty rows
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// Convert DD/MM/YYYY → YYYY-MM-DD
function parseDate(d) {
  if (!d) return null;
  if (d.includes('/')) {
    const [day, month, year] = d.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return d; // already ISO
}

function cleanNum(s) {
  if (!s) return 0;
  return parseFloat(s.replace(/[^\d.-]/g, '')) || 0;
}

function cleanInt(s) {
  if (!s) return 0;
  return parseInt(s.replace(/[^\d-]/g, '')) || 0;
}

// ─── DB Setup ────────────────────────────────────────────────────────────────

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ─── 1. grab_raw — Menu_Sales ────────────────────────────────────────────────
console.log('\n=== Importing Menu_Sales → grab_raw ===');

const menuRows = parseCSV(path.join(CSV_DIR, 'Menu_Sales_28Nov25_25Feb26.csv'));
const insertGrabRaw = db.prepare(`
  INSERT OR IGNORE INTO grab_raw (date, item_name, units_sold, gross_sales, source)
  VALUES (?, ?, ?, ?, 'grab')
`);

// grab_raw has no UNIQUE constraint by default — use a check to avoid dupes
// We check existing (date, item_name) pairs first
const existingGrabRaw = new Set(
  db.prepare("SELECT date || '|' || item_name AS key FROM grab_raw").all().map(r => r.key)
);

let grabRawInserted = 0;
let grabRawSkipped = 0;

const insertManyGrabRaw = db.transaction((rows) => {
  for (const row of rows) {
    const date = parseDate(row['Date']);
    const itemName = row['Item'];
    const unitsSold = cleanInt(row['Units Sold']);
    const grossSales = cleanNum(row['Item Gross Sales (₫)']);
    if (!date || !itemName) continue;
    const key = `${date}|${itemName}`;
    if (existingGrabRaw.has(key)) {
      grabRawSkipped++;
      continue;
    }
    insertGrabRaw.run(date, itemName, unitsSold, grossSales);
    existingGrabRaw.add(key);
    grabRawInserted++;
  }
});

insertManyGrabRaw(menuRows);
console.log(`  ✓ Inserted: ${grabRawInserted}, Skipped (dupe): ${grabRawSkipped}`);

// ─── 2. daily_operations — Sales ─────────────────────────────────────────────
console.log('\n=== Importing Sales → daily_operations ===');

const salesRows = parseCSV(path.join(CSV_DIR, 'Sales_28Nov25_25Feb26.csv'));
const insertDailyOps = db.prepare(`
  INSERT OR IGNORE INTO daily_operations
    (date, sku_id, quantity_sold, revenue, total_cogs, waste, labor_cost, supplier_price_change, source)
  VALUES
    (?, 'GRAB_DAILY', ?, ?, 0, 0, 0, 0, 'grab')
`);

let dailyInserted = 0;
let dailySkipped = 0;

const insertManyDaily = db.transaction((rows) => {
  for (const row of rows) {
    const date = parseDate(row['Date']);
    const numTx = cleanInt(row['Number of Transactions']);
    const netSales = cleanNum(row['Net Sales (₫)']);
    if (!date) continue;
    const result = insertDailyOps.run(date, numTx, netSales);
    if (result.changes > 0) dailyInserted++;
    else dailySkipped++;
  }
});

insertManyDaily(salesRows);
console.log(`  ✓ Inserted: ${dailyInserted}, Skipped (dupe): ${dailySkipped}`);

// ─── 3. grab_offers — Offers ──────────────────────────────────────────────────
console.log('\n=== Importing Offers → grab_offers ===');

const offersRows = parseCSV(path.join(CSV_DIR, 'Offers_28Nov25_25Feb26.csv'));

// Check existing (date, offer_name) pairs
const existingOffers = new Set(
  db.prepare("SELECT date || '|' || COALESCE(offer_name,'') AS key FROM grab_offers").all().map(r => r.key)
);

const insertOffer = db.prepare(`
  INSERT INTO grab_offers (date, offer_name, gross_sales, net_sales, num_transactions, spend, source)
  VALUES (?, ?, ?, ?, ?, ?, 'grab')
`);

let offersInserted = 0;
let offersSkipped = 0;

const insertManyOffers = db.transaction((rows) => {
  for (const row of rows) {
    const date = parseDate(row['Date']);
    const offerName = row['Offers'];
    const grossSales = cleanNum(row['Gross Sales (₫)']);
    const netSales = cleanNum(row['Net Sales (₫)']);
    const numTx = cleanInt(row['Number of Transactions']);
    const spend = cleanNum(row['Spend (₫)']);
    if (!date) continue;
    const key = `${date}|${offerName || ''}`;
    if (existingOffers.has(key)) {
      offersSkipped++;
      continue;
    }
    insertOffer.run(date, offerName, grossSales, netSales, numTx, spend);
    existingOffers.add(key);
    offersInserted++;
  }
});

insertManyOffers(offersRows);
console.log(`  ✓ Inserted: ${offersInserted}, Skipped (dupe): ${offersSkipped}`);

// ─── 4. grab_peak_hour — Peak_Hour ───────────────────────────────────────────
console.log('\n=== Importing Peak_Hour → grab_peak_hour ===');

const peakRows = parseCSV(path.join(CSV_DIR, 'Peak_Hour_28Nov25_25Feb26.csv'));

const existingPeakDates = new Set(
  db.prepare("SELECT date FROM grab_peak_hour").all().map(r => r.date)
);

const insertPeak = db.prepare(`
  INSERT INTO grab_peak_hour
    (date, hour_01, hour_02, hour_03, hour_04, hour_05, hour_06,
     hour_07, hour_08, hour_09, hour_10, hour_11, hour_12,
     hour_13, hour_14, hour_15, hour_16, hour_17, hour_18,
     hour_19, hour_20, hour_21, hour_22, hour_23, hour_00, source)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'grab')
`);

let peakInserted = 0;
let peakSkipped = 0;

const insertManyPeak = db.transaction((rows) => {
  for (const row of rows) {
    const date = parseDate(row['Date']);
    if (!date) continue;
    if (existingPeakDates.has(date)) {
      peakSkipped++;
      continue;
    }
    insertPeak.run(
      date,
      cleanInt(row['01']), cleanInt(row['02']), cleanInt(row['03']),
      cleanInt(row['04']), cleanInt(row['05']), cleanInt(row['06']),
      cleanInt(row['07']), cleanInt(row['08']), cleanInt(row['09']),
      cleanInt(row['10']), cleanInt(row['11']), cleanInt(row['12']),
      cleanInt(row['13']), cleanInt(row['14']), cleanInt(row['15']),
      cleanInt(row['16']), cleanInt(row['17']), cleanInt(row['18']),
      cleanInt(row['19']), cleanInt(row['20']), cleanInt(row['21']),
      cleanInt(row['22']), cleanInt(row['23']), cleanInt(row['00'])
    );
    existingPeakDates.add(date);
    peakInserted++;
  }
});

insertManyPeak(peakRows);
console.log(`  ✓ Inserted: ${peakInserted}, Skipped (dupe): ${peakSkipped}`);

// ─── 5. grab_combos — Combo_Sales ────────────────────────────────────────────
console.log('\n=== Importing Combo_Sales → grab_combos ===');

const comboRows = parseCSV(path.join(CSV_DIR, 'Combo_Sales_26Feb26.csv'));

// Combos have no date; skip if same combo_description already exists
const existingCombos = new Set(
  db.prepare("SELECT combo_description FROM grab_combos").all().map(r => r.combo_description)
);

const insertCombo = db.prepare(`
  INSERT INTO grab_combos (combo_description, source, import_date)
  VALUES (?, 'grab', '2026-02-26')
`);

let combosInserted = 0;
let combosSkipped = 0;

const insertManyCombos = db.transaction((rows) => {
  for (const row of rows) {
    const combo = row['Combo'];
    if (!combo) continue;
    if (existingCombos.has(combo)) {
      combosSkipped++;
      continue;
    }
    insertCombo.run(combo);
    existingCombos.add(combo);
    combosInserted++;
  }
});

insertManyCombos(comboRows);
console.log(`  ✓ Inserted: ${combosInserted}, Skipped (dupe): ${combosSkipped}`);

// ─── Summary ──────────────────────────────────────────────────────────────────
const totalInserted = grabRawInserted + dailyInserted + offersInserted + peakInserted + combosInserted;
console.log(`\n✅ Import complete — ${totalInserted} new records total`);
console.log(`   grab_raw:          +${grabRawInserted}`);
console.log(`   daily_operations:  +${dailyInserted}`);
console.log(`   grab_offers:       +${offersInserted}`);
console.log(`   grab_peak_hour:    +${peakInserted}`);
console.log(`   grab_combos:       +${combosInserted}`);

db.close();
