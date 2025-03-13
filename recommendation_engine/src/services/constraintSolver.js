const logger = require('../utils/logger');
const config = require('../config/settings');

/**
 * Create a time-optimized itinerary from scored destinations
 * This is a simplified version for MVP - we'll start with a greedy algorithm
 * In v2, we can implement a more sophisticated constraint solver
 */
const createOptimizedItinerary = async (scoredDestinations, context) => {
  try {
    const { startTime, endTime, startLocation, transportMode = 'walking' } = context;
    
    // Convert times to minutes since start of day for easier calculation
    const startMinutes = timeToMinutes(startTime || '09:00');
    const endMinutes = timeToMinutes(endTime || '17:00');
    const totalAvailableTime = endMinutes - startMinutes;
    
    const itinerary = [];
    let currentTime = startMinutes;
    let currentLocation = startLocation;
    
    // Sort destinations by score (already done, but ensuring it's sorted)
    const sortedDestinations = [...scoredDestinations].sort((a, b) => b.score - a.score);
    
    // Create a copy of destinations that we can modify
    const remainingDestinations = [...sortedDestinations];
    
    // Keep adding destinations until we run out of time or destinations
    while (remainingDestinations.length > 0) {
      // Find the best next destination considering both score and travel time
      const nextDestIndex = findBestNextDestination(
        remainingDestinations, 
        currentLocation, 
        currentTime, 
        endMinutes,
        transportMode
      );
      
      // If no suitable destination found, break
      if (nextDestIndex === -1) break;
      
      const nextDest = remainingDestinations[nextDestIndex];
      
      // Calculate travel time to this destination
      const travelTime = estimateTravelTime(currentLocation, nextDest.location, transportMode);
      
      // Update current time and location
      currentTime += travelTime;
      
      // Check if we still have time to visit
      if (currentTime + nextDest.visitDuration > endMinutes) {
        // Not enough time to visit this destination
        remainingDestinations.splice(nextDestIndex, 1);
        continue;
      }
      
      // Add to itinerary
      itinerary.push({
        destinationId: nextDest.destinationId,
        startTime: minutesToTime(currentTime),
        endTime: minutesToTime(currentTime + nextDest.visitDuration),
        travelTimeFromPrevious: travelTime,
        score: nextDest.score
      });
      
      // Update current time and location
      currentTime += nextDest.visitDuration;
      currentLocation = nextDest.location;
      
      // Remove this destination from remaining
      remainingDestinations.splice(nextDestIndex, 1);
      
      // Add a break if needed and if there's time
      if (remainingDestinations.length > 0 && shouldAddBreak(currentTime)) {
        const breakDuration = 60; // 1 hour break
        if (currentTime + breakDuration <= endMinutes) {
          itinerary.push({
            type: 'break',
            startTime: minutesToTime(currentTime),
            endTime: minutesToTime(currentTime + breakDuration),
            duration: breakDuration
          });
          currentTime += breakDuration;
        }
      }
    }
    
    return itinerary;
  } catch (error) {
    logger.error('Error creating optimized itinerary:', error);
    throw error;
  }
};

/**
 * Find the best next destination considering score and travel time
 */
const findBestNextDestination = (destinations, currentLocation, currentTime, endTime, transportMode) => {
  let bestIndex = -1;
  let bestCombinedScore = -1;
  
  for (let i = 0; i < destinations.length; i++) {
    const dest = destinations[i];
    
    // Calculate travel time
    const travelTime = estimateTravelTime(currentLocation, dest.location, transportMode);
    
    // Check if we can reach and visit this destination
    if (currentTime + travelTime + dest.visitDuration > endTime) {
      continue; // Skip if not enough time
    }
    
    // Calculate a combined score that considers both the destination score and travel time
    const travelPenalty = travelTime * config.DISTANCE_PENALTY_FACTOR;
    const combinedScore = dest.score - travelPenalty;
    
    if (combinedScore > bestCombinedScore) {
      bestCombinedScore = combinedScore;
      bestIndex = i;
    }
  }
  
  return bestIndex;
};

/**
 * Estimate travel time between locations
 * This is a simplified version - in production we would use a maps API
 */
const estimateTravelTime = (fromLocation, toLocation, mode) => {
  if (!fromLocation || !toLocation) {
    return 30; // Default 30 minutes if locations not provided
  }
  
  // Calculate rough distance in km (using haversine formula)
  const distance = calculateDistance(
    fromLocation.latitude, 
    fromLocation.longitude, 
    toLocation.latitude, 
    toLocation.longitude
  );
  
  // Estimate travel time based on mode and distance
  let speedKmPerHour;
  switch (mode) {
    case 'walking':
      speedKmPerHour = 5;
      break;
    case 'transit':
      speedKmPerHour = 15;
      break;
    case 'driving':
      speedKmPerHour = 30;
      break;
    default:
      speedKmPerHour = 10;
  }
  
  const travelTimeHours = distance / speedKmPerHour;
  const travelTimeMinutes = Math.ceil(travelTimeHours * 60);
  
  // Add a small buffer
  return travelTimeMinutes + 5;
};

/**
 * Calculate distance between two coordinates using Haversine formula
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c;
  return distance;
};

const deg2rad = (deg) => {
  return deg * (Math.PI/180);
};

/**
 * Determine if we should add a break (e.g., for lunch)
 */
const shouldAddBreak = (currentTimeMinutes) => {
  // Add a lunch break if it's around lunch time
  const hour = Math.floor(currentTimeMinutes / 60);
  return hour >= 11 && hour <= 13;
};

/**
 * Convert time string (HH:MM) to minutes since start of day
 */
const timeToMinutes = (timeString) => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Convert minutes since start of day to time string (HH:MM)
 */
const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

module.exports = {
  createOptimizedItinerary
};