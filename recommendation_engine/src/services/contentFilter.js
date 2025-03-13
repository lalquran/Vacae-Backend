const logger = require('../utils/logger');
const config = require('../config/settings');
const UserPreference = require('../models/userPreference');
const profileService = require('./profileService');
const { getCache, setCache } = require('../config/redis');

/**
 * Content-based filtering service
 * Matches destinations to user preferences based on attributes
 */
class ContentFilter {
  /**
   * Score destinations based on content matching with user preferences
   *
   * @param {string} userId - The user ID
   * @param {Array} destinations - Array of destination objects
   * @returns {Array} Scored destinations with preference scores
   */
  async scoreDestinations(userId, destinations) {
    try {
      // Get user preferences (either from local cache or profile service)
      const userPreferences = await this.getUserPreferences(userId);
      
      if (!userPreferences) {
        logger.warn(`No preferences found for user ${userId}, using defaults`);
        return this.scoreWithDefaultPreferences(destinations);
      }
      
      // Score each destination
      const scoredDestinations = destinations.map(destination => {
        const scores = {
          // Category match score
          categoryScore: this.calculateCategoryScore(destination, userPreferences),
          
          // Cost level match score
          costScore: this.calculateCostScore(destination, userPreferences),
          
          // Activity level match score
          activityScore: this.calculateActivityScore(destination, userPreferences),
          
          // Attributes match score
          attributesScore: this.calculateAttributesScore(destination, userPreferences)
        };
        
        // Calculate weighted final score
        const finalScore = this.calculateWeightedScore(scores, userPreferences);
        
        return {
          destinationId: destination.id,
          contentScore: finalScore,
          contentFactors: scores
        };
      });
      
      return scoredDestinations;
    } catch (error) {
      logger.error('Error in content filtering:', error);
      // Fallback to default scoring
      return this.scoreWithDefaultPreferences(destinations);
    }
  }
  
  /**
   * Get user preferences from cache or profile service
   */
  async getUserPreferences(userId) {
    try {
      // Check local database cache first
      let userPreferences = await UserPreference.findOne({
        where: { userId }
      });
      
      // If not in local cache, check Redis
      if (!userPreferences && config.REDIS_ENABLED) {
        const cacheKey = `user_preferences:${userId}`;
        const cachedPreferences = await getCache(cacheKey);
        
        if (cachedPreferences) {
          userPreferences = JSON.parse(cachedPreferences);
        }
      }
      
      // If still not found, fetch from profile service
      if (!userPreferences) {
        logger.debug(`Fetching preferences from profile service for user ${userId}`);
        
        // Get from profile service
        const profilePreferences = await profileService.getUserPreferences(userId);
        
        if (profilePreferences) {
          // Store in local database
          userPreferences = await UserPreference.create({
            userId,
            ...this.mapProfilePreferencesToLocal(profilePreferences),
            source: 'explicit'
          });
          
          // Cache in Redis if enabled
          if (config.REDIS_ENABLED) {
            const cacheKey = `user_preferences:${userId}`;
            await setCache(cacheKey, JSON.stringify(userPreferences), 3600); // 1 hour
          }
        }
      }
      
      return userPreferences;
    } catch (error) {
      logger.error(`Error getting user preferences for ${userId}:`, error);
      return null;
    }
  }
  
  /**
   * Map preferences from profile service format to local format
   */
  mapProfilePreferencesToLocal(profilePreferences) {
    // Default mapping - adjust based on actual profile service data structure
    return {
      categories: profilePreferences.categories || [],
      costLevel: profilePreferences.budgetLevel || 3,
      activityLevel: profilePreferences.pacePreference || 'moderate',
      timeOfDay: {
        morning: profilePreferences.earlyRiser ? 0.6 : 0.2,
        afternoon: 0.33,
        evening: profilePreferences.nightOwl ? 0.6 : 0.2
      },
      visitDurationPreference: profilePreferences.visitDurationPreference || 90,
      // Map other fields...
    };
  }
  
  /**
   * Score destinations using default preferences (for new users)
   */
  scoreWithDefaultPreferences(destinations) {
    // Default preferences favor popular attractions with moderate cost
    const defaultPreferences = {
      costLevel: 3,
      activityLevel: 'moderate',
      // Other defaults...
    };
    
    return destinations.map(destination => {
      const scores = {
        // For new users, we rely more on popularity than matching
        categoryScore: 0.5, // Neutral score for categories
        costScore: this.calculateCostScore(destination, defaultPreferences),
        activityScore: this.calculateActivityScore(destination, defaultPreferences),
        attributesScore: 0.5 // Neutral score for attributes
      };
      
      const finalScore = (
        // Weight popularity more heavily for new users
        (destination.popularity / 5 * 0.7) + 
        // And still consider some basic preferences
        (this.calculateWeightedScore(scores, defaultPreferences) * 0.3)
      );
      
      return {
        destinationId: destination.id,
        contentScore: finalScore,
        contentFactors: scores
      };
    });
  }
  
  /**
   * Calculate how well destination categories match user preferences
   */
  calculateCategoryScore(destination, userPreferences) {
    // Default score if no data
    if (!destination.categories || !destination.categories.length ||
        !userPreferences.categories || !userPreferences.categories.length) {
      return 0.5; // Neutral score
    }
    
    // Get category IDs from destination
    const destinationCategoryIds = destination.categories.map(cat => 
      typeof cat === 'object' ? cat.id : cat
    );
    
    // Count matches
    const userCategoryIds = userPreferences.categories;
    const matchCount = destinationCategoryIds.filter(id => 
      userCategoryIds.includes(id)
    ).length;
    
    // Calculate match percentage
    if (destinationCategoryIds.length === 0) return 0.5;
    
    const matchPercentage = matchCount / destinationCategoryIds.length;
    
    // Apply category weights if available
    if (userPreferences.categoryWeights && Object.keys(userPreferences.categoryWeights).length > 0) {
      let weightedScore = 0;
      let totalWeight = 0;
      
      destinationCategoryIds.forEach(categoryId => {
        const weight = userPreferences.categoryWeights[categoryId] || 1;
        totalWeight += weight;
        
        if (userCategoryIds.includes(categoryId)) {
          weightedScore += weight;
        }
      });
      
      if (totalWeight === 0) return 0.5;
      return weightedScore / totalWeight;
    }
    
    // Simple percentage match if no weights
    return matchPercentage > 0 ? 0.5 + (matchPercentage * 0.5) : 0.5;
  }
  
  /**
   * Calculate cost level match score
   */
  calculateCostScore(destination, userPreferences) {
    const destinationCost = destination.costLevel || 3;
    const preferredCost = userPreferences.costLevel || 3;
    
    // Perfect match
    if (destinationCost === preferredCost) return 1.0;
    
    // Calculate difference (0-4 range)
    const difference = Math.abs(destinationCost - preferredCost);
    
    // Convert to score (1.0 for perfect match, decreasing for larger differences)
    return Math.max(0, 1 - (difference * 0.2));
  }
  
  /**
   * Calculate activity level match score
   */
  calculateActivityScore(destination, userPreferences) {
    const visitDuration = destination.visitDuration || 60;
    const preferredLevel = userPreferences.activityLevel || 'moderate';
    
    // Map activity levels to duration ranges
    const activityRanges = {
      active: { min: 0, max: 90, ideal: 60 },
      moderate: { min: 60, max: 180, ideal: 120 },
      relaxed: { min: 120, max: 300, ideal: 180 }
    };
    
    const range = activityRanges[preferredLevel];
    
    // Perfect match - visit duration falls exactly at the ideal point
    if (visitDuration === range.ideal) return 1.0;
    
    // Outside range completely
    if (visitDuration < range.min || visitDuration > range.max) {
      // How far outside the range
      const distanceOutside = Math.min(
        Math.abs(visitDuration - range.min), 
        Math.abs(visitDuration - range.max)
      );
      // Penalty based on distance outside range
      return Math.max(0, 0.5 - (distanceOutside / 120) * 0.5);
    }
    
    // Within range but not ideal
    const distanceFromIdeal = Math.abs(visitDuration - range.ideal);
    const rangeSize = (range.max - range.min) / 2;
    
    // Score based on how close to ideal (1.0 at ideal, 0.5 at edge of range)
    return 1.0 - (distanceFromIdeal / rangeSize) * 0.5;
  }
  
  /**
   * Calculate attributes match score
   */
  calculateAttributesScore(destination, userPreferences) {
    // Default if no attributes
    if (!destination.attributes || Object.keys(destination.attributes).length === 0) {
      return 0.5;
    }
    
    // For MVP, we'll use a simple approach
    // This could be expanded to consider specific attributes the user prefers
    
    // Check for key attributes that might match preferences
    let score = 0.5; // Start neutral
    
    // Adjust based on weather preferences if available
    if (userPreferences.weatherPreferences) {
      // We'd need the current weather context to use this properly
      // For now, we'll just check if this destination matches any preferred attribute
      const allPreferredAttributes = [].concat(
        ...Object.values(userPreferences.weatherPreferences)
      );
      
      // Check if destination has any of these attributes
      const hasPreferredAttribute = allPreferredAttributes.some(attr => 
        destination.attributes[attr] === true
      );
      
      if (hasPreferredAttribute) {
        score += 0.1;
      }
    }
    
    // Consider indoor/outdoor preference based on time of day
    // Morning and afternoon might favor outdoor, evening might favor indoor
    const timeOfDayPreferences = userPreferences.timeOfDay || {};
    if (timeOfDayPreferences.morning > 0.4 && destination.attributes.outdoor) {
      score += 0.05;
    }
    if (timeOfDayPreferences.evening > 0.4 && destination.attributes.indoor) {
      score += 0.05;
    }
    
    return Math.min(1.0, score); // Cap at 1.0
  }
  
  /**
   * Calculate final weighted score from individual factors
   */
  calculateWeightedScore(scores, userPreferences) {
    // Default weights
    const weights = {
      categoryScore: 0.4,
      costScore: 0.3,
      activityScore: 0.2,
      attributesScore: 0.1
    };
    
    // Calculate weighted sum
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (const [key, score] of Object.entries(scores)) {
      weightedSum += score * weights[key];
      totalWeight += weights[key];
    }
    
    return weightedSum / totalWeight;
  }
}

module.exports = new ContentFilter();