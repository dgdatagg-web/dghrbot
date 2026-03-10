# WillOS — Internal Operations Intelligence System

> Phase 1: Data Foundation + KPI Engine

## Overview

WillOS is an internal tool for DG Group that ingests operational data, calculates key performance indicators (KPIs), monitors thresholds, and generates executive reports. Built for the Kansai/Osaka environment.

## Quick Start

```bash
# Install dependencies
npm install

# Start the server (default port 3000)
npm start

# Or with custom port
PORT=4000 npm start
```

## Import Data from Grab CSV

Grab exports CSV files with this format:

```
Date,Country,City,Merchant,Grab Service,Item,Units Sold,Item Gross Sales (₫)
```

To import:

```bash
node scripts/import-csv.js /path/to/grab-export.csv
```

The script will:
- Parse and normalize the CSV
- Auto-generate SKU IDs from item names
- Insert into `daily_operations` and `sku_master` tables
- COGS, waste, labor_cost default to 0 (enrich later)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check / system info |
| POST | `/api/ingest` | Ingest daily operation records (JSON) |
| GET | `/api/metrics` | Latest KPI snapshot |
| GET | `/api/metrics?date=YYYY-MM-DD` | KPI for specific date |
| GET | `/api/metrics?days=7` | KPI trend (last N days) |
| GET | `/api/alerts` | Active (unresolved) alerts |
| GET | `/api/alerts?all=true` | All alerts |
| GET | `/api/coo` | COO advisory (placeholder) |
| GET | `/api/report` | Weekly executive brief |
| GET | `/api/report?days=14` | Custom period report |

## Ingest Format (JSON)

```json
{
  "date": "2026-01-15",
  "sku_id": "bun_bo",
  "quantity_sold": 45,
  "revenue": 2250000,
  "total_cogs": 900000,
  "waste": 50000,
  "labor_cost": 300000,
  "supplier_price_change": 0.02
}
```

Supports single object or array of objects.

## Database

Uses SQLite via `better-sqlite3` (synchronous, file-based). Database file: `data/willos.db`.

### Tables

- **daily_operations** — per-SKU daily operational data
- **kpi_snapshot** — aggregated daily KPIs
- **alert_log** — triggered alerts with resolution status
- **baseline_metrics** — frozen reference values for comparison
- **sku_master** — SKU catalog

## KPI Definitions

| KPI | Formula | Meaning |
|-----|---------|---------|
| Gross Margin | (Revenue - COGS) / Revenue | Profitability per dollar |
| Labor Efficiency | Revenue / Labor Cost | Revenue generated per labor dollar |
| Waste Ratio | Waste / COGS | Proportion of COGS lost to waste |
| Cost Drift | (Current - 30d Avg) / 30d Avg | Supplier price movement |

## Alert Thresholds

See `config/thresholds.json`:

- Gross margin drop > 5%
- Waste ratio > 10%
- Labor efficiency drop > 8%
- Supplier price spike > 7%
- SKU zero sales > 7 days

## Project Structure

```
willos/
├── api/            # Express route handlers
├── agents/         # Business logic agents
├── config/         # Thresholds, baseline, system config
├── core/           # Schema, calculations, validation, logging
├── data/           # SQLite DB + logs
├── scripts/        # Import utilities
├── index.js        # Server entry point
└── package.json
```

## Tech Stack

- **Runtime:** Node.js
- **Database:** SQLite (better-sqlite3)
- **HTTP:** Express
- **CSV:** csv-parse

## License

UNLICENSED — Internal use only (DG Group)
