const logger = require('../utils/logger');
const scoringService = require('../services/scoringService');
const constraintSolver = require('../services/constraintSolver');
const destinationService = require('../services/destinationService');
const Recommendation = require('../models/recommendation');
const metrics = require('../utils/metrics');
const { v4: uuidv4 } = require('uuid');

/**
 * Background task to generate recommendations
 * This allows us to handle complex recommendation generation asynchronously
 */
const generateRecommendationsTask = async (data) => {
  try {
    const startTime = Date.now();
    logger.info(`Starting recommendation generation task for user ${data.userId}`);
    
    const { 
      userId, 
      location, 
      date, 
      startTime: tripStartTime, 
      endTime: tripEndTime, 
      preferences = {},
      transportMode = 'walking'
    } = data;
    
    // Get nearby destinations
    const nearbyDestinations = await destinationService.findNearbyDestinations(
      location.latitude,
      location.longitude,
      5, // 5km radius
      preferences.categories
    );
    
    if (!nearbyDestinations.length) {
      logger.warn(`No destinations found for location (${location.latitude}, ${location.longitude})`);
      return {
        success: false,
        message: 'No destinations found in this location',
        itineraryId: null
      };
    }
    
    // Collect destination IDs
    const destinationIds = nearbyDestinations.map(dest => dest.id);
    
    // Build context object
    const context = {
      date,
      timeOfDay: determineTimeOfDay(tripStartTime),
      weather: await getWeatherForLocation(location, date),
      availableTime: calculateAvailableTime(tripStartTime, tripEndTime)
    };
    
    // Score destinations
    const scoredDestinations = await scoringService.scoreDestinations(userId, destinationIds, context);
    
    // Create an optimized itinerary
    const itinerary = await constraintSolver.createOptimizedItinerary(
      scoredDestinations,
      {
        startTime: tripStartTime,
        endTime: tripEndTime,
        startLocation: location,
        transportMode
      }
    );
    
    // Generate a unique itineraryId
    const itineraryId = uuidv4();
    
    // Store recommendations
    for (const item of itinerary) {
      if (item.type === 'break') continue; // Skip breaks
      
      await Recommendation.create({
        userId,
        itineraryId,
        destinationId: item.destinationId,
        score: item.score,
        position: itinerary.indexOf(item),
        reasoning: scoredDestinations.find(d => d.destinationId === item.destinationId)?.reasoning || {},
        contextData: context,
        status: 'pending'
      });
    }
    
    // Record metrics
    metrics.incrementCounter('recommendations', 'generated', itinerary.filter(i => i.type !== 'break').length);
    metrics.recordResponseTime(Date.now() - startTime);
    
    logger.info(`Generated itinerary ${itineraryId} with ${itinerary.filter(i => i.type !== 'break').length} destinations for user ${userId}`);
    
    return {
      success: true,
      itineraryId,
      itemCount: itinerary.filter(i => i.type !== 'break').length
    };
  } catch (error) {
    logger.error('Error in recommendation generation task:', error);
    metrics.recordError('generation_task_error');
    
    throw error;
  }
};

/**
 * Helper to determine time of day from time string
 */
const determineTimeOfDay = (timeString) => {
  if (!timeString) return 'afternoon';
  
  const hour = parseInt(timeString.split(':')[0]);
  
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
};

/**
 * Helper to calculate available time in minutes
 */
const calculateAvailableTime = (startTime, endTime) => {
  if (!startTime || !endTime) return 480; // Default to 8 hours
  
  const start = startTime.split(':').map(Number);
  const end = endTime.split(':').map(Number);
  
  const startMinutes = start[0] * 60 + start[1];
  const endMinutes = end[0] * 60 + end[1];
  
  return endMinutes - startMinutes;
};

/**
 * Mock function to get weather - would be replaced with actual weather API
 */
const getWeatherForLocation = async (location, date) => {
  // In a real implementation, this would call a weather API
  return 'sunny'; // Default to sunny for MVP
};

// Register the task with Celery
const registerTasks = (celeryApp) => {
  celeryApp.register('tasks.generate_recommendations', generateRecommendationsTask);
  logger.info('Registered generate_recommendations task with Celery');
};

module.exports = {
  generateRecommendationsTask,
  registerTasks
};