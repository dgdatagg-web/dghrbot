#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'willos.db');
const DATA_DIR = '/Users/dongocminh/.openclaw/workspace/data/grab-2026-02';

const db = new Database(DB_PATH);

// Create tables
console.log('Creating tables...');

db.exec(`
CREATE TABLE IF NOT EXISTS grab_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  gross_sales REAL,
  net_sales REAL,
  orders INTEGER,
  avg_order_value REAL,
  grab_fee REAL,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(date)
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
  source TEXT DEFAULT 'grab',
  UNIQUE(date, offer_name)
);

CREATE TABLE IF NOT EXISTS grab_peak_hours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  hour INTEGER,
  orders INTEGER,
  gross_sales REAL,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(date, hour)
);

CREATE TABLE IF NOT EXISTS grab_combos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  combo_description TEXT NOT NULL,
  source TEXT DEFAULT 'grab',
  import_date TEXT,
  UNIQUE(combo_description)
);
`);

console.log('✓ Tables created\n');

// Helper: parse CSV
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ? values[idx].trim() : null;
    });
    rows.push(row);
  }
  return rows;
}

// Helper: convert DD/MM/YYYY to YYYY-MM-DD
function convertDate(ddmmyyyy) {
  if (!ddmmyyyy) return null;
  const parts = ddmmyyyy.split('/');
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

// Helper: parse Vietnamese currency
function parseCurrency(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/[₫,]/g, '')) || 0;
}

// 1. Import Daily Sales
console.log('Importing daily sales...');
const dailyRows = parseCSV(path.join(DATA_DIR, 'Sales_28Nov25_25Feb26.csv'));
const insertDaily = db.prepare(`
  INSERT OR IGNORE INTO grab_daily (date, gross_sales, net_sales, orders, avg_order_value, grab_fee)
  VALUES (?, ?, ?, ?, ?, ?)
`);

let dailyCount = 0;
for (const row of dailyRows) {
  const date = convertDate(row['Date']);
  const gross = parseCurrency(row['Gross Sales (₫)']);
  const net = parseCurrency(row['Net Sales (₫)']);
  const orders = parseInt(row['Number of Transactions']) || 0;
  const avgOrder = parseCurrency(row['Average Transaction Amount  (₫)']);
  const grabFee = gross - net;
  
  const result = insertDaily.run(date, gross, net, orders, avgOrder, grabFee);
  if (result.changes > 0) dailyCount++;
}
console.log(`✓ Imported ${dailyCount} rows into grab_daily\n`);

// 2. Import Menu Sales
console.log('Importing menu sales...');
const menuRows = parseCSV(path.join(DATA_DIR, 'Menu_Sales_28Nov25_25Feb26.csv'));
const insertMenu = db.prepare(`
  INSERT OR IGNORE INTO grab_menu_sales (date, sku_name, category, quantity, gross_revenue, net_revenue, avg_price)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

let menuCount = 0;
for (const row of menuRows) {
  const date = convertDate(row['Date']);
  const sku = row['Item'];
  const qty = parseInt(row['Units Sold']) || 0;
  const gross = parseCurrency(row['Item Gross Sales (₫)']);
  const net = gross * 0.85; // estimate net = 85% of gross
  const avgPrice = qty > 0 ? gross / qty : 0;
  
  const result = insertMenu.run(date, sku, null, qty, gross, net, avgPrice);
  if (result.changes > 0) menuCount++;
}
console.log(`✓ Imported ${menuCount} rows into grab_menu_sales\n`);

// 3. Import Offers
console.log('Importing offers...');
const offerRows = parseCSV(path.join(DATA_DIR, 'Offers_28Nov25_25Feb26.csv'));
const insertOffer = db.prepare(`
  INSERT OR IGNORE INTO grab_offers (date, offer_name, gross_sales, net_sales, num_transactions, spend, source)
  VALUES (?, ?, ?, ?, ?, ?, 'grab')
`);

let offerCount = 0;
for (const row of offerRows) {
  const date = convertDate(row['Date']);
  const offer = row['Offers'];
  const gross = parseCurrency(row['Gross Sales (₫)']);
  const net = parseCurrency(row['Net Sales (₫)']);
  const orders = parseInt(row['Number of Transactions']) || 0;
  const spend = parseCurrency(row['Spend (₫)']);
  
  const result = insertOffer.run(date, offer, gross, net, orders, spend);
  if (result.changes > 0) offerCount++;
}
console.log(`✓ Imported ${offerCount} rows into grab_offers\n`);

// 4. Import Peak Hours
console.log('Importing peak hours...');
const peakRows = parseCSV(path.join(DATA_DIR, 'Peak_Hour_28Nov25_25Feb26.csv'));
const insertPeak = db.prepare(`
  INSERT OR IGNORE INTO grab_peak_hours (date, hour, orders, gross_sales)
  VALUES (?, ?, ?, ?)
`);

let peakCount = 0;
for (const row of peakRows) {
  const date = convertDate(row['Date']);
  
  // Each row has columns 01-00 (24 hours)
  for (let h = 0; h <= 23; h++) {
    const hourCol = h.toString().padStart(2, '0');
    const orders = parseInt(row[hourCol]) || 0;
    
    if (orders > 0) {
      const result = insertPeak.run(date, h, orders, null);
      if (result.changes > 0) peakCount++;
    }
  }
}
console.log(`✓ Imported ${peakCount} rows into grab_peak_hours\n`);

// 5. Import Combos
console.log('Importing combos...');
const comboRows = parseCSV(path.join(DATA_DIR, 'Combo_Sales_26Feb26.csv'));
const insertCombo = db.prepare(`
  INSERT OR IGNORE INTO grab_combos (combo_description, source, import_date)
  VALUES (?, 'grab', date('now'))
`);

let comboCount = 0;
for (const row of comboRows) {
  const combo = row['Combo'];
  
  if (combo) {
    const result = insertCombo.run(combo);
    if (result.changes > 0) comboCount++;
  }
}
console.log(`✓ Imported ${comboCount} rows into grab_combos\n`);

console.log('✅ Import complete!');
db.close();
