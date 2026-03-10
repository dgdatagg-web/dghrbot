/**
 * core/calculations.js — WillOS KPI Calculations
 *
 * Pure functions — no side effects, no DB access.
 * All return numbers (ratios / percentages as decimals).
 */

'use strict';

/**
 * Gross Margin = (Revenue - COGS) / Revenue
 * Returns 0 if revenue is zero to avoid division-by-zero.
 *
 * @param {number} revenue
 * @param {number} totalCogs
 * @returns {number}
 */
function calcGrossMargin(revenue, totalCogs) {
  if (!revenue || revenue === 0) return 0;
  return (revenue - totalCogs) / revenue;
}

/**
 * Labor Efficiency = Revenue / Labor Cost
 * Higher is better. Returns 0 if labor cost is zero.
 *
 * @param {number} revenue
 * @param {number} laborCost
 * @returns {number}
 */
function calcLaborEfficiency(revenue, laborCost) {
  if (!laborCost || laborCost === 0) return 0;
  return revenue / laborCost;
}

/**
 * Waste Ratio = Waste / Total COGS
 * Lower is better. Returns 0 if COGS is zero.
 *
 * @param {number} waste
 * @param {number} totalCogs
 * @returns {number}
 */
function calcWasteRatio(waste, totalCogs) {
  if (!totalCogs || totalCogs === 0) return 0;
  return waste / totalCogs;
}

/**
 * Cost Drift = (Current Price - Rolling 30-day Avg) / Rolling 30-day Avg
 * Positive = price increased vs average. Returns 0 if avg is zero.
 *
 * @param {number} currentPrice
 * @param {number} rolling30dAvg
 * @returns {number}
 */
function calcCostDrift(currentPrice, rolling30dAvg) {
  if (!rolling30dAvg || rolling30dAvg === 0) return 0;
  return (currentPrice - rolling30dAvg) / rolling30dAvg;
}

module.exports = {
  calcGrossMargin,
  calcLaborEfficiency,
  calcWasteRatio,
  calcCostDrift,
};
