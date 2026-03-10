/**
 * venue.js — Venue config + GPS distance helpers
 */

const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.resolve(__dirname, '../../config/sheets_config.json');

function getVenueConfig() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  return config.venue;
}

// Haversine formula — returns distance in meters
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isWithinVenue(lat, lng) {
  const venue = getVenueConfig();
  const dist = getDistanceMeters(lat, lng, venue.lat, venue.lng);
  return { ok: dist <= venue.radius_meters, distance: Math.round(dist), radius: venue.radius_meters };
}

module.exports = { getVenueConfig, getDistanceMeters, isWithinVenue };
