const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Geocode an address to coordinates using OpenStreetMap Nominatim API
 * Note: For production use, consider a commercial geocoding service with better rate limits
 */
exports.geocodeAddress = async (address) => {
  try {
    // Format address for URL
    const addressString = typeof address === 'string' 
      ? address 
      : [address.street, address.city, address.state, address.postalCode, address.country]
          .filter(Boolean)
          .join(', ');
    
    const encodedAddress = encodeURIComponent(addressString);
    
    // Use OpenStreetMap Nominatim API (free but with strict usage policy)
    const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`, {
      headers: {
        'User-Agent': 'TravelApp/1.0' // Required by Nominatim
      }
    });
    
    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        displayName: result.display_name,
        type: result.type,
        confidence: parseInt(result.importance * 10)
      };
    }
    
    return null;
  } catch (error) {
    logger.error('Geocoding error:', error);
    throw new Error('Failed to geocode address');
  }
};

/**
 * Reverse geocode coordinates to an address
 */
exports.reverseGeocode = async (latitude, longitude) => {
  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      {
        headers: {
          'User-Agent': 'TravelApp/1.0'
        }
      }
    );
    
    if (response.data) {
      const { address } = response.data;
      
      return {
        street: [address.road, address.house_number].filter(Boolean).join(' '),
        city: address.city || address.town || address.village,
        state: address.state,
        postalCode: address.postcode,
        country: address.country,
        displayName: response.data.display_name
      };
    }
    
    return null;
  } catch (error) {
    logger.error('Reverse geocoding error:', error);
    throw new Error('Failed to reverse geocode coordinates');
  }
};
