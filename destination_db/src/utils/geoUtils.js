const sequelize = require('../config/database');
/**
 * Utility functions for geospatial operations
 */

/**
 * Convert lat/lng pair to PostGIS point
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Object} PostGIS geometry object
 */
function latLngToPoint(lat, lng) {
  if (!lat || !lng) return null;
  
  return {
    type: 'Point',
    coordinates: [lng, lat], // Note: PostGIS uses [lng, lat] order
    crs: { type: 'name', properties: { name: 'EPSG:4326' } }
  };
}

/**
 * Calculate distance between two points
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  // Haversine formula implementation
  const R = 6371; // Earth radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return distance;
}

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
function toRad(degrees) {
  return degrees * Math.PI / 180;
}

/**
 * Build a simpler PostGIS search radius query that's more reliable
 * @param {number} lat - Latitude of center point
 * @param {number} lng - Longitude of center point
 * @param {number} radiusKm - Radius in kilometers
 * @returns {Object} Sequelize where clause object
 */
function buildRadiusQuery(lat, lng, radiusKm) {
  // Use a simpler ST_DWithin query format that's less likely to cause issues
  const distanceCondition = sequelize.fn(
    'ST_DWithin',
    sequelize.col('location'),
    sequelize.fn(
      'ST_SetSRID', 
      sequelize.fn('ST_MakePoint', lng, lat), 
      4326
    ),
    radiusKm * 1000 // Convert km to meters
  );
  
  return {
    [distanceCondition]: true
  };
}

module.exports = {
  latLngToPoint,
  calculateDistance,
  buildRadiusQuery
};