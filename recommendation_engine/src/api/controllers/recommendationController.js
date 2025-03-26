const { v4: uuidv4, v5: uuidv5 } = require('uuid');
const scoringService = require('../../services/scoringService');
const constraintSolver = require('../../services/constraintSolver');
const destinationService = require('../../services/destinationService');
const logger = require('../../utils/logger');
const jwt = require('jsonwebtoken');
const Recommendation = require('../../models/recommendation');
const UserToken = require('../../models/userToken');

/**
 * Storing user tokens
 * @param {string} userId 
 * @param {object} authHeader 
 * @returns 
 */
const storeUserToken = async (userId, authHeader) => {
  try {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.split(' ')[1];
    
    // Decode token to get expiration
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      return false;
    }
    
    const expiresAt = new Date(decoded.exp * 1000);
    
    // Only store if token has at least 1 hour of validity left
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
    if (expiresAt < oneHourFromNow) {
      return false;
    }
    
    await UserToken.upsert({
      userId,
      token: authHeader, // Store full header
      expiresAt
    });
    
    return true;
  } catch (error) {
    logger.error('Error storing user token:', error);
    return false;
  }
};

/**
 * Generate recommendations based on user profile
 */
exports.generateRecommendations = async (req, res, next) => {
  try {
    const { userId } = req.user; // From auth middleware
    const { 
      location, 
      date, 
      startTime, 
      endTime, 
      preferences = {},
      transportMode = 'walking'
    } = req.body;

    const authToken = req.headers.authorization;

    await storeUserToken(userId, authToken);
    
    // Validate required parameters
    if (!location || !location.latitude || !location.longitude) {
      return res.status(400).json({ 
        error: true, 
        message: 'Location is required with latitude and longitude' 
      });
    }
    
    // Get nearby destinations within a reasonable radius
    const nearbyDestinations = await destinationService.findNearbyDestinations(
      location.latitude,
      location.longitude,
      5, // 5km radius
      preferences.categories // Optional category filter
    );
    
    if (!nearbyDestinations.length) {
      return res.status(404).json({ 
        error: true, 
        message: 'No destinations found in this location' 
      });
    }
    
    // Collect destination IDs
    const destinationIds = nearbyDestinations.map(dest => dest.id);
    
    // Build context object
    const context = {
      date,
      timeOfDay: determineTimeOfDay(startTime),
      weather: await getWeatherForLocation(location, date),
      availableTime: calculateAvailableTime(startTime, endTime)
    };

    // Convert UserID (string) to UUID
    const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // This is a standard namespace UUID
    const convertedUserId = uuidv5(userId.toString(), NAMESPACE);
    
    // Score destinations
    const scoredDestinations = await scoringService.scoreDestinations(convertedUserId, destinationIds, context, authToken);
    
    // Create an optimized itinerary
    const itinerary = await constraintSolver.createOptimizedItinerary(
      scoredDestinations,
      {
        startTime,
        endTime,
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
        userId: convertedUserId,
        itineraryId,
        destinationId: item.destinationId,
        score: item.score,
        position: itinerary.indexOf(item),
        reasoning: scoredDestinations.find(d => d.destinationId === item.destinationId)?.reasoning || {},
        contextData: context,
        status: 'pending'
      });
    }
    
    // Return the itinerary to the client
    res.status(200).json({
      success: true,
      data: {
        itineraryId,
        date,
        startTime,
        endTime,
        items: itinerary
      }
    });
} catch (error) {
    logger.error('Error generating recommendations:', error);
    next(error);
  }
};

/**
 * Refine an existing itinerary based on feedback
 */
exports.refineItinerary = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { itineraryId } = req.params;
    const { 
      removedDestinations = [], 
      addedConstraints = {},
      transportMode
    } = req.body;

    await storeUserToken(userId, req.headers.authorization);

    // Convert UserID (string) to UUID
    const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // This is a standard namespace UUID
    const convertedUserId = uuidv5(userId.toString(), NAMESPACE);
    
    // Get the original itinerary
    const recommendations = await Recommendation.findAll({
      where: { userId: convertedUserId, itineraryId },
      order: [['position', 'ASC']]
    });
    
    if (!recommendations.length) {
      return res.status(404).json({
        error: true,
        message: 'Itinerary not found'
      });
    }
    
    // Get destination details
    const destinationIds = recommendations.map(rec => rec.destinationId)
      .filter(id => !removedDestinations.includes(id));
    
    // If no destinations left after removal, return error
    if (destinationIds.length === 0) {
      return res.status(400).json({
        error: true,
        message: 'Cannot refine itinerary with all destinations removed'
      });
    }
    
    // Get destination details
    const destinations = await destinationService.getDestinationDetails(destinationIds);
    
    // Reconstruct context from first recommendation
    const context = recommendations[0].contextData || {};
    
    // Apply new constraints if provided
    if (addedConstraints.startTime) context.startTime = addedConstraints.startTime;
    if (addedConstraints.endTime) context.endTime = addedConstraints.endTime;
    
    // Create a new optimized itinerary
    const scoredDestinations = destinations.map(dest => ({
      destinationId: dest.id,
      score: recommendations.find(r => r.destinationId === dest.id)?.score || 0.5,
      location: {
        latitude: dest.location.coordinates[1],
        longitude: dest.location.coordinates[0]
      },
      visitDuration: dest.visitDuration
    }));
    
    const newItinerary = await constraintSolver.createOptimizedItinerary(
      scoredDestinations,
      {
        startTime: context.startTime || '09:00',
        endTime: context.endTime || '17:00',
        startLocation: addedConstraints.startLocation || null,
        transportMode: transportMode || 'walking'
      }
    );
    
    // Update recommendation positions
    for (const item of newItinerary) {
      if (item.type === 'break') continue;
      
      await Recommendation.update(
        { position: newItinerary.indexOf(item) },
        { where: { itineraryId, destinationId: item.destinationId } }
      );
    }
    
    // Return the refined itinerary
    res.status(200).json({
      success: true,
      data: {
        itineraryId,
        items: newItinerary
      }
    });
  } catch (error) {
    logger.error('Error refining itinerary:', error);
    next(error);
  }
};

/**
 * Save feedback on a recommendation
 */
exports.saveFeedback = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { recommendationId } = req.params;
    const { rating, comments, status } = req.body;
    const userToken = req.headers.authorization;

    // Convert UserID (string) to UUID
    const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // This is a standard namespace UUID
    const convertedUserId = uuidv5(userId.toString(), NAMESPACE);
    
    // Find the recommendation
    const recommendation = await Recommendation.findOne({
      where: { id: recommendationId, userId: convertedUserId }
    });
    
    if (!recommendation) {
      return res.status(404).json({
        error: true,
        message: 'Recommendation not found'
      });
    }
    
    // Update with feedback
    const updatedFeedback = {
      ...recommendation.feedback,
      rating: rating !== undefined ? rating : recommendation.feedback.rating,
      comments: comments || recommendation.feedback.comments,
      updatedAt: new Date().toISOString()
    };
    
    await recommendation.update({
      feedback: updatedFeedback,
      status: status || recommendation.status
    });
    
    res.status(200).json({
      success: true,
      data: {
        id: recommendation.id,
        feedback: updatedFeedback,
        status: recommendation.status
      }
    });
  } catch (error) {
    logger.error('Error saving feedback:', error);
    next(error);
  }
};

/**
 * Get an existing itinerary
 */
exports.getItinerary = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { itineraryId } = req.params;

    // Convert UserID (string) to UUID
    const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // This is a standard namespace UUID
    const convertedUserId = uuidv5(userId.toString(), NAMESPACE);
    
    // Get recommendations for this itinerary
    const recommendations = await Recommendation.findAll({
      where: { userId: convertedUserId, itineraryId },
      order: [['position', 'ASC']]
    });
    
    if (!recommendations.length) {
      return res.status(404).json({
        error: true,
        message: 'Itinerary not found'
      });
    }
    
    // Get full destination details
    const destinationIds = recommendations.map(rec => rec.destinationId);
    const destinations = await destinationService.getDestinationDetails(destinationIds);
    
    // Build the itinerary with full details
    const itineraryItems = recommendations.map(rec => {
      const destination = destinations.find(d => d.id === rec.destinationId);
      
      return {
        recommendationId: rec.id,
        destinationId: rec.destinationId,
        position: rec.position,
        score: rec.score,
        status: rec.status,
        feedback: rec.feedback,
        destination: destination || null
      };
    }).sort((a, b) => a.position - b.position);
    
    res.status(200).json({
      success: true,
      data: {
        itineraryId,
        items: itineraryItems,
        createdAt: recommendations[0].createdAt
      }
    });
  } catch (error) {
    logger.error('Error getting itinerary:', error);
    next(error);
  }
};

exports.updateUserPreferences = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const authToken = req.headers.authorization;
    
    logger.info(`Manually triggering preference update for user ${userId}`);
    
    // Store the current token
    await storeUserToken(userId, authToken);
    
    // Queue the update task
    const result = await rabbitmq.sendTask('tasks.update_user_features', [{ userId }]);
    
    res.status(200).json({
      success: true,
      message: 'User preference update has been queued',
      taskId: result?.taskId
    });
  } catch (error) {
    logger.error('Error queueing preference update:', error);
    next(error);
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