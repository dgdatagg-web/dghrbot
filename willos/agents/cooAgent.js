/**
 * agents/cooAgent.js — WillOS COO Agent
 *
 * Placeholder for LLM-powered advisory.
 * Phase 1: Assembles context (KPIs + alerts) for future LLM calls.
 * Phase 2+: Will call LLM API to generate executive insights.
 */

'use strict';

const logger = require('../core/logger');

/**
 * Assemble COO advisory context from current data.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {object} — context object for LLM consumption
 */
function assembleContext(db) {
  const latestKpi = db.prepare('SELECT * FROM kpi_snapshot ORDER BY date DESC LIMIT 1').get();
  const recentKpis = db.prepare('SELECT * FROM kpi_snapshot ORDER BY date DESC LIMIT 7').all();
  const activeAlerts = db.prepare('SELECT * FROM alert_log WHERE resolved = 0 ORDER BY date DESC').all();
  const baseline = db.prepare('SELECT * FROM baseline_metrics').all();

  const context = {
    latest_kpi: latestKpi || null,
    kpi_trend_7d: recentKpis,
    active_alerts: activeAlerts,
    baseline,
    generated_at: new Date().toISOString(),
  };

  logger.info('COOAgent: context assembled');
  return context;
}

/**
 * Generate advisory (placeholder — returns structured context).
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {object}
 */
function generateAdvisory(db) {
  const context = assembleContext(db);

  return {
    status: 'placeholder',
    message: 'LLM integration pending. Context ready for Phase 2.',
    context,
  };
}

module.exports = { assembleContext, generateAdvisory };
