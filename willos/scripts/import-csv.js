/**
 * scripts/import-csv.js — WillOS Grab CSV Importer
 *
 * Reads Grab-format CSV and inserts into daily_operations + grab_raw.
 *
 * Grab CSV columns:
 *   Date, Country, City, Merchant, Grab Service, Item, Units Sold, Item Gross Sales (₫)
 *
 * Usage:
 *   node scripts/import-csv.js /path/to/grab-export.csv
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const Database = require('better-sqlite3');
const { initSchema } = require('../core/schema');
const logger = require('../core/logger');

// ------- Config -------
const DB_PATH = path.join(__dirname, '..', 'data', 'willos.db');
const csvPath = process.argv[2];

if (!csvPath) {
  console.error('Usage: node scripts/import-csv.js <path-to-csv>');
  process.exit(1);
}

if (!fs.existsSync(csvPath)) {
  console.error(`File not found: ${csvPath}`);
  process.exit(1);
}

// ------- SKU Master Mapping -------
// Map item name prefix (before " - " Vietnamese description) to sku_id
const SKU_MAP = {
  'Kare Tonkatsu': 'KO_CURRY_001',
  'Kare Chicken Katsu': 'KO_CURRY_002',
  'Kare Beef Yakiniku': 'KO_CURRY_003',
  'Cơm Cà Ri Rau Củ': 'KO_CURRY_004',
  'Beef Yakiniku Don': 'KO_RICE_001',
  'Chicken Katsudon': 'KO_RICE_002',
  'Pork Katsudon': 'KO_RICE_003',
  'Súp Bò Hầm': 'KO_RICE_004',
  'Chicken Katsu Stir fry Noodles': 'KO_NOODLE_001',
  'Tonkatsu Stir fry Noodles': 'KO_NOODLE_002',
  'Udon Xào Bò': 'KO_NOODLE_003',
  'Chicken Fillet Stir fry Noodles': 'KO_NOODLE_004',
  'Ebi Tempura Stir fry Noodles': 'KO_NOODLE_005',
  'Beef Yakiniku Stir fry Noodles': 'KO_NOODLE_006',
  'Tornado Omelette': 'KO_SIDE_001',
  'Miso Soup': 'KO_SIDE_002',
  'Trứng Cuộn': 'KO_SIDE_003',
  'Tempura': 'KO_SIDE_004',
  'Beef Yakiniku': 'KO_SIDE_005',
  'Tonkatsu': 'KO_SIDE_006',
  'Chicken Katsu': 'KO_SIDE_007',
  'Poached Egg': 'KO_SIDE_008',
  'Takoyaki - 10': 'KO_SNACK_001',
  'Takoyaki - 5': 'KO_SNACK_002',
  'Takoyaki - 20': 'KO_SNACK_003',
};

// Items that are clearly NOT the shorter side-dish version
// (used for disambiguation: "Beef Yakiniku Don" should NOT match "Beef Yakiniku")
// We sort keys by length DESC so longer matches take priority
const SKU_KEYS_SORTED = Object.keys(SKU_MAP).sort((a, b) => b.length - a.length);

// Drink counter for auto-assigning KO_DRINK_XXX
let drinkCounter = 0;
const drinkSkuCache = {};

/**
 * Resolve item name to SKU ID.
 * Items have format: "English Name - Vietnamese Name" or just "Vietnamese Name"
 * Strategy: match against SKU_MAP keys using the full item string prefix.
 */
function resolveSkuId(itemName) {
  const trimmed = itemName.trim();

  // Try exact prefix match (longest first to avoid "Beef Yakiniku" matching before "Beef Yakiniku Don")
  for (const key of SKU_KEYS_SORTED) {
    // Check if item starts with the key, and next char is either end, space, dash, pipe, or comma
    if (trimmed.startsWith(key)) {
      const nextChar = trimmed[key.length];
      if (!nextChar || nextChar === ' ' || nextChar === '-' || nextChar === '|' || nextChar === ',') {
        return { skuId: SKU_MAP[key], category: getCategoryFromSku(SKU_MAP[key]), isDrink: false };
      }
    }
  }

  // Also try: "Cơm Cà Ri Rau Củ Phủ Trứng | Veggies Curry with Omelette" → match "Cơm Cà Ri Rau Củ"
  for (const key of SKU_KEYS_SORTED) {
    if (trimmed.includes(key)) {
      return { skuId: SKU_MAP[key], category: getCategoryFromSku(SKU_MAP[key]), isDrink: false };
    }
  }

  // If not in map → likely a drink
  return resolveDrink(trimmed);
}

function resolveDrink(itemName) {
  if (!drinkSkuCache[itemName]) {
    drinkCounter++;
    drinkSkuCache[itemName] = `KO_DRINK_${String(drinkCounter).padStart(3, '0')}`;
  }
  return { skuId: drinkSkuCache[itemName], category: 'DRINK', isDrink: true };
}

function getCategoryFromSku(skuId) {
  if (skuId.startsWith('KO_CURRY')) return 'CURRY';
  if (skuId.startsWith('KO_RICE')) return 'RICE';
  if (skuId.startsWith('KO_NOODLE')) return 'NOODLE';
  if (skuId.startsWith('KO_SIDE')) return 'SIDE';
  if (skuId.startsWith('KO_SNACK')) return 'SNACK';
  if (skuId.startsWith('KO_DRINK')) return 'DRINK';
  return 'OTHER';
}

/**
 * Parse date from DD/MM/YYYY → YYYY-MM-DD
 */
function parseDate(rawDate) {
  const m = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return rawDate; // fallback
}

// ------- Init DB -------
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Drop old tables if schema changed (safe for fresh import)
db.exec('DROP TABLE IF EXISTS grab_raw');
db.exec('DROP TABLE IF EXISTS daily_operations');

initSchema(db);

// ------- Read & Parse CSV -------
const raw = fs.readFileSync(csvPath, 'utf-8');
const records = parse(raw, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  bom: true,
});

logger.info(`CSV import: ${records.length} rows from ${path.basename(csvPath)}`);

// ------- Prepared Statements -------
const insertRaw = db.prepare(`
  INSERT INTO grab_raw (date, item_name, units_sold, gross_sales, source)
  VALUES (@date, @item_name, @units_sold, @gross_sales, 'grab')
`);

const upsertOps = db.prepare(`
  INSERT INTO daily_operations
    (date, sku_id, quantity_sold, revenue, total_cogs, waste, labor_cost, supplier_price_change, source)
  VALUES
    (@date, @sku_id, @quantity_sold, @revenue, 0, 0, 0, 0, 'grab')
  ON CONFLICT(date, sku_id, source) DO UPDATE SET
    quantity_sold = quantity_sold + excluded.quantity_sold,
    revenue = revenue + excluded.revenue
`);

const upsertSku = db.prepare(`
  INSERT OR IGNORE INTO sku_master (sku_id, name_vi, category)
  VALUES (@sku_id, @name_vi, @category)
`);

let imported = 0;
let skipped = 0;
let rawInserted = 0;
const unmapped = {};

const importAll = db.transaction((rows) => {
  for (const row of rows) {
    try {
      const rawDate = row['Date'] || '';
      if (!rawDate || rawDate === 'Date') continue; // skip header-like rows

      const date = parseDate(rawDate);
      const itemFull = row['Item'] || '';
      const unitsSold = parseInt(row['Units Sold'] || '0', 10);
      const grossSalesStr = (row['Item Gross Sales (₫)'] || '0').toString().replace(/[,\s]/g, '');
      const grossSales = parseFloat(grossSalesStr);

      if (!itemFull || isNaN(unitsSold) || isNaN(grossSales)) {
        skipped++;
        continue;
      }

      // 1. Insert into grab_raw (verbatim)
      insertRaw.run({
        date,
        item_name: itemFull,
        units_sold: unitsSold,
        gross_sales: grossSales,
      });
      rawInserted++;

      // 2. Resolve SKU
      const { skuId, category, isDrink } = resolveSkuId(itemFull);

      // 3. Upsert SKU master
      upsertSku.run({
        sku_id: skuId,
        name_vi: itemFull.split(' - ')[0].split(' | ')[0].trim(),
        category,
      });

      // 4. Upsert daily_operations (aggregate same date+sku)
      upsertOps.run({
        date,
        sku_id: skuId,
        quantity_sold: unitsSold,
        revenue: grossSales,
      });

      imported++;

      if (isDrink) {
        unmapped[itemFull] = skuId;
      }
    } catch (err) {
      logger.warn(`Skipping row: ${err.message}`);
      skipped++;
    }
  }
});

importAll(records);

// ------- Report -------
logger.info(`CSV import complete: ${imported} imported, ${skipped} skipped, ${rawInserted} raw rows`);
console.log(`\n✅ Import complete:`);
console.log(`   Rows imported to daily_operations: ${imported}`);
console.log(`   Rows inserted to grab_raw: ${rawInserted}`);
console.log(`   Rows skipped: ${skipped}`);
console.log(`   Database: ${DB_PATH}`);

if (Object.keys(unmapped).length > 0) {
  console.log(`\n📝 Drinks auto-mapped:`);
  for (const [name, sku] of Object.entries(unmapped)) {
    console.log(`   ${name} → ${sku}`);
  }
}

// Quick summary
const totalOps = db.prepare('SELECT COUNT(*) as cnt FROM daily_operations').get();
const totalRaw = db.prepare('SELECT COUNT(*) as cnt FROM grab_raw').get();
const totalRev = db.prepare('SELECT SUM(revenue) as total FROM daily_operations').get();
const dateRange = db.prepare('SELECT MIN(date) as start, MAX(date) as end FROM daily_operations').get();

console.log(`\n📊 Summary:`);
console.log(`   daily_operations: ${totalOps.cnt} rows`);
console.log(`   grab_raw: ${totalRaw.cnt} rows`);
console.log(`   Total revenue: ${totalRev.total?.toLocaleString()} VND`);
console.log(`   Date range: ${dateRange.start} → ${dateRange.end}`);

db.close();
