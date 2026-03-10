#!/usr/bin/env node
/**
 * import-grab-2026-02.js
 * Import Grab data (Nov 2025 → Feb 2026) into WillOS SQLite database.
 * Fixes: proper CSV parsing (handles quoted fields with commas).
 * Safe: uses INSERT OR IGNORE + transactions, never overwrites existing data.
 */

const Database = require('better-sqlite3');
const { parse: parseSync } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');

const DB_PATH  = path.join(__dirname, '..', 'data', 'willos.db');
const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'grab-2026-02');

const db = new Database(DB_PATH);

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Parse CSV with proper quoting support */
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return parseSync(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  });
}

/** Convert DD/MM/YYYY → YYYY-MM-DD */
function toISO(ddmmyyyy) {
  if (!ddmmyyyy) return null;
  const p = ddmmyyyy.trim().split('/');
  if (p.length !== 3) return null;
  return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
}

/** Strip ₫ and commas, return float */
function money(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace(/[₫,\s]/g, '')) || 0;
}

// ─── ensure tables exist ──────────────────────────────────────────────────────

db.exec(`
CREATE TABLE IF NOT EXISTS grab_sales_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  gross_sales REAL,
  net_sales REAL,
  num_transactions INTEGER,
  avg_transaction REAL,
  avg_rating REAL,
  source TEXT DEFAULT 'grab'
);

CREATE TABLE IF NOT EXISTS grab_menu_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  sku_name TEXT,
  category TEXT,
  quantity INTEGER,
  gross_revenue REAL,
  net_revenue REAL,
  avg_price REAL,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(date, sku_name)
);

CREATE TABLE IF NOT EXISTS grab_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  offer_name TEXT,
  gross_sales REAL,
  net_sales REAL,
  num_transactions INTEGER,
  spend REAL,
  source TEXT DEFAULT 'grab'
);

CREATE TABLE IF NOT EXISTS grab_peak_hour (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  hour_01 INTEGER DEFAULT 0, hour_02 INTEGER DEFAULT 0,
  hour_03 INTEGER DEFAULT 0, hour_04 INTEGER DEFAULT 0,
  hour_05 INTEGER DEFAULT 0, hour_06 INTEGER DEFAULT 0,
  hour_07 INTEGER DEFAULT 0, hour_08 INTEGER DEFAULT 0,
  hour_09 INTEGER DEFAULT 0, hour_10 INTEGER DEFAULT 0,
  hour_11 INTEGER DEFAULT 0, hour_12 INTEGER DEFAULT 0,
  hour_13 INTEGER DEFAULT 0, hour_14 INTEGER DEFAULT 0,
  hour_15 INTEGER DEFAULT 0, hour_16 INTEGER DEFAULT 0,
  hour_17 INTEGER DEFAULT 0, hour_18 INTEGER DEFAULT 0,
  hour_19 INTEGER DEFAULT 0, hour_20 INTEGER DEFAULT 0,
  hour_21 INTEGER DEFAULT 0, hour_22 INTEGER DEFAULT 0,
  hour_23 INTEGER DEFAULT 0, hour_00 INTEGER DEFAULT 0,
  source TEXT DEFAULT 'grab'
);

CREATE TABLE IF NOT EXISTS grab_combos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  combo_description TEXT NOT NULL,
  source TEXT DEFAULT 'grab',
  import_date TEXT,
  UNIQUE(combo_description)
);
`);

console.log('✓ Tables ensured\n');

// ─── STEP 0: Clean up malformed data from previous bad imports ─────────────

console.log('🔧 Cleaning up malformed rows from previous imports...');

// grab_offers: malformed rows start with a double-quote (truncated field from bad CSV split)
const offersBefore = db.prepare('SELECT count(*) as n FROM grab_offers').get().n;
db.exec(`DELETE FROM grab_offers WHERE offer_name LIKE '"%'`);
const offersAfterClean = db.prepare('SELECT count(*) as n FROM grab_offers').get().n;
console.log(`  grab_offers: ${offersBefore} → ${offersAfterClean} rows (removed ${offersBefore - offersAfterClean} malformed)`);

// grab_combos: malformed rows start with a double-quote, then dedup by keeping lowest id
const combosBefore = db.prepare('SELECT count(*) as n FROM grab_combos').get().n;
db.exec(`DELETE FROM grab_combos WHERE combo_description LIKE '"%'`);
db.exec(`DELETE FROM grab_combos WHERE id NOT IN (SELECT MIN(id) FROM grab_combos GROUP BY combo_description)`);
const combosAfterClean = db.prepare('SELECT count(*) as n FROM grab_combos').get().n;
console.log(`  grab_combos: ${combosBefore} → ${combosAfterClean} rows (removed ${combosBefore - combosAfterClean} malformed/dupes)`);

console.log('');

// ─── 1. Daily Sales → grab_sales_daily ──────────────────────────────────────

console.log('1️⃣  Importing daily sales (Sales_28Nov25_25Feb26.csv)...');
const salesRows = parseCSV(path.join(DATA_DIR, 'Sales_28Nov25_25Feb26.csv'));

const upsertSales = db.prepare(`
  INSERT OR IGNORE INTO grab_sales_daily
    (date, gross_sales, net_sales, num_transactions, avg_transaction, avg_rating, source)
  VALUES (?, ?, ?, ?, ?, ?, 'grab')
`);

let salesCount = 0;
const txSales = db.transaction(() => {
  for (const row of salesRows) {
    const r = upsertSales.run(
      toISO(row['Date']),
      money(row['Gross Sales (₫)']),
      money(row['Net Sales (₫)']),
      parseInt(row['Number of Transactions']) || 0,
      money(row['Average Transaction Amount  (₫)'] || row['Average Transaction Amount (₫)']),
      parseFloat(row['Average Rating']) || null,
    );
    if (r.changes > 0) salesCount++;
  }
});
txSales();
console.log(`  ✓ ${salesCount} new rows → grab_sales_daily (${salesRows.length} in CSV)\n`);

// ─── 2. Menu Sales → grab_menu_sales ────────────────────────────────────────

console.log('2️⃣  Importing menu sales (Menu_Sales_28Nov25_25Feb26.csv)...');
const menuRows = parseCSV(path.join(DATA_DIR, 'Menu_Sales_28Nov25_25Feb26.csv'));

const upsertMenu = db.prepare(`
  INSERT OR IGNORE INTO grab_menu_sales
    (date, sku_name, category, quantity, gross_revenue, net_revenue, avg_price)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

let menuCount = 0;
const txMenu = db.transaction(() => {
  for (const row of menuRows) {
    const qty   = parseInt(row['Units Sold']) || 0;
    const gross = money(row['Item Gross Sales (₫)']);
    const r = upsertMenu.run(
      toISO(row['Date']),
      row['Item'],
      null,
      qty,
      gross,
      gross * 0.85,       // net estimated (no net column in this CSV)
      qty > 0 ? gross / qty : 0,
    );
    if (r.changes > 0) menuCount++;
  }
});
txMenu();
console.log(`  ✓ ${menuCount} new rows → grab_menu_sales (${menuRows.length} in CSV)\n`);

// ─── 3. Offers → grab_offers ─────────────────────────────────────────────────

console.log('3️⃣  Importing offers (Offers_28Nov25_25Feb26.csv)...');
const offerRows = parseCSV(path.join(DATA_DIR, 'Offers_28Nov25_25Feb26.csv'));

const insertOffer = db.prepare(`
  INSERT INTO grab_offers
    (date, offer_name, gross_sales, net_sales, num_transactions, spend, source)
  VALUES (?, ?, ?, ?, ?, ?, 'grab')
`);

let offersCount = 0;
const txOffers = db.transaction(() => {
  // Build set of existing (date, offer_name) to avoid duplication
  const existing = new Set(
    db.prepare('SELECT date, offer_name FROM grab_offers').all().map(r => `${r.date}|${r.offer_name}`)
  );

  for (const row of offerRows) {
    const date  = toISO(row['Date']);
    const offer = row['Offers'];
    const key   = `${date}|${offer}`;
    if (existing.has(key)) continue;

    insertOffer.run(
      date,
      offer,
      money(row['Gross Sales (₫)']),
      money(row['Net Sales (₫)']),
      parseInt(row['Number of Transactions']) || 0,
      money(row['Spend (₫)']),
    );
    offersCount++;
    existing.add(key);
  }
});
txOffers();
console.log(`  ✓ ${offersCount} new rows → grab_offers (${offerRows.length} in CSV)\n`);

// ─── 4. Peak Hour → grab_peak_hour ──────────────────────────────────────────

console.log('4️⃣  Importing peak hours (Peak_Hour_28Nov25_25Feb26.csv)...');
const peakRows = parseCSV(path.join(DATA_DIR, 'Peak_Hour_28Nov25_25Feb26.csv'));

// Aggregate rows by date in JS (handle multiple rows per same date in CSV)
const peakByDate = {};
for (const row of peakRows) {
  const date = toISO(row['Date']);
  if (!peakByDate[date]) {
    peakByDate[date] = Array(24).fill(0); // 24 hours: 01-23 + 00
  }
  const hrs = ['01','02','03','04','05','06','07','08','09','10','11','12',
                '13','14','15','16','17','18','19','20','21','22','23','00'];
  hrs.forEach((h, i) => {
    peakByDate[date][i] += parseInt(row[h]) || 0;
  });
}

const upsertPeak = db.prepare(`
  INSERT INTO grab_peak_hour
    (date, hour_01, hour_02, hour_03, hour_04, hour_05, hour_06,
     hour_07, hour_08, hour_09, hour_10, hour_11, hour_12,
     hour_13, hour_14, hour_15, hour_16, hour_17, hour_18,
     hour_19, hour_20, hour_21, hour_22, hour_23, hour_00, source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'grab')
`);

let peakCount = 0;
const txPeak = db.transaction(() => {
  // Build set of existing dates to avoid duplicates (no UNIQUE constraint on table)
  const existingDates = new Set(
    db.prepare('SELECT date FROM grab_peak_hour').all().map(r => r.date)
  );

  for (const [date, hrs] of Object.entries(peakByDate)) {
    if (existingDates.has(date)) continue;
    upsertPeak.run(date, ...hrs);
    peakCount++;
    existingDates.add(date);
  }
});
txPeak();
console.log(`  ✓ ${peakCount} rows → grab_peak_hour (${peakRows.length} CSV rows, ${Object.keys(peakByDate).length} unique dates)\n`);

// ─── 5. Combos → grab_combos ────────────────────────────────────────────────

console.log('5️⃣  Importing combos (Combo_Sales_26Feb26.csv)...');
const comboRows = parseCSV(path.join(DATA_DIR, 'Combo_Sales_26Feb26.csv'));

const insertCombo = db.prepare(`
  INSERT INTO grab_combos (combo_description, source, import_date)
  VALUES (?, 'grab', date('now'))
`);

let comboCount = 0;
const txCombos = db.transaction(() => {
  // Build set of existing combos to avoid duplicates (no UNIQUE constraint on table)
  const existingCombos = new Set(
    db.prepare('SELECT combo_description FROM grab_combos').all().map(r => r.combo_description)
  );

  for (const row of comboRows) {
    const desc = row['Combo'];
    if (!desc || existingCombos.has(desc)) continue;
    insertCombo.run(desc);
    comboCount++;
    existingCombos.add(desc);
  }
});
txCombos();
console.log(`  ✓ ${comboCount} new rows → grab_combos (${comboRows.length} in CSV)\n`);

// ─── 6. Final verification ────────────────────────────────────────────────────

console.log('📊 Final verification:');
const tables = [
  { name: 'grab_sales_daily', expected: 88,   dateCol: 'date' },
  { name: 'grab_menu_sales',  expected: 2336,  dateCol: 'date' },
  { name: 'grab_offers',      expected: 458,   dateCol: 'date' },
  { name: 'grab_peak_hour',   expected: 78,    dateCol: 'date' },  // 79 CSV rows but 2026-02-19 appears twice → 78 unique dates
  { name: 'grab_combos',      expected: 15,    dateCol: null   },
];

for (const t of tables) {
  const { n } = db.prepare(`SELECT count(*) as n FROM ${t.name}`).get();
  let rangeStr = 'n/a';
  if (t.dateCol) {
    const dr = db.prepare(`SELECT MIN(${t.dateCol}) as mn, MAX(${t.dateCol}) as mx FROM ${t.name} WHERE ${t.dateCol} IS NOT NULL`).get();
    if (dr?.mn) rangeStr = `${dr.mn} → ${dr.mx}`;
  }
  const status = n >= t.expected ? '✅' : '⚠️ ';
  console.log(`  ${status} ${t.name}: ${n} rows (expected ≥${t.expected}) | ${rangeStr}`);
}

// Sanity queries
console.log('\n💰 Sanity checks:');
const totalGross = db.prepare('SELECT sum(gross_sales) as total FROM grab_sales_daily').get().total;
const totalNet   = db.prepare('SELECT sum(net_sales) as total FROM grab_sales_daily').get().total;
const uniqueSKU  = db.prepare('SELECT count(DISTINCT sku_name) as n FROM grab_menu_sales').get().n;
const dateRange  = db.prepare('SELECT MIN(date) as mn, MAX(date) as mx FROM grab_sales_daily').get();

console.log(`  Total gross sales: ${(totalGross/1e6).toFixed(2)}M ₫`);
console.log(`  Total net sales:   ${(totalNet/1e6).toFixed(2)}M ₫`);
console.log(`  Unique SKUs:       ${uniqueSKU}`);
console.log(`  Date range:        ${dateRange.mn} → ${dateRange.mx}`);

console.log('\n✅ Import complete!');
db.close();
