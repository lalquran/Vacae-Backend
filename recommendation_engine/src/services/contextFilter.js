const logger = require('../utils/logger');
const config = require('../config/settings');
const { getCache, setCache } = require('../config/redis');
const axios = require('axios');

/**
 * Context filtering service
 * Adjusts recommendations based on contextual factors like weather, time, etc.
 */
class ContextFilter {
  /**
   * Apply contextual adjustments to scored destinations
   *
   * @param {Array} scoredDestinations - Array of destinations with initial scores
   * @param {Object} context - Contextual information (weather, time, etc.)
   * @returns {Array} - Destinations with adjusted scores
   */
  async applyContextualAdjustments(scoredDestinations, context) {
    try {
      // Skip if no context provided
      if (!context || Object.keys(context).length === 0) {
        logger.debug('No context provided, skipping contextual adjustments');
        return scoredDestinations;
      }
      
      // Apply each contextual factor
      let adjustedDestinations = [...scoredDestinations];
      
      // Weather adjustment
      if (context.weather) {
        adjustedDestinations = this.applyWeatherAdjustments(adjustedDestinations, context.weather);
      }
      
      // Time of day adjustment
      if (context.timeOfDay) {
        adjustedDestinations = this.applyTimeOfDayAdjustments(adjustedDestinations, context.timeOfDay);
      }
      
      // Day of week adjustment
      if (context.dayOfWeek !== undefined) {
        adjustedDestinations = this.applyDayOfWeekAdjustments(adjustedDestinations, context.dayOfWeek);
      }
      
      // Season adjustment
      if (context.season) {
        adjustedDestinations = this.applySeasonAdjustments(adjustedDestinations, context.season);
      }
      
      // Special events adjustment
      if (context.events && context.events.length > 0) {
        adjustedDestinations = this.applySpecialEventsAdjustments(adjustedDestinations, context.events);
      }
      
      // Available time adjustment
      if (context.availableTime) {
        adjustedDestinations = this.applyTimeConstraintAdjustments(adjustedDestinations, context.availableTime);
      }
      
      return adjustedDestinations;
    } catch (error) {
      logger.error('Error applying contextual adjustments:', error);
      // Return original scores if adjustments fail
      return scoredDestinations;
    }
  }
  
  /**
   * Adjust scores based on weather conditions
   */
  applyWeatherAdjustments(destinations, weather) {
    logger.debug(`Applying weather adjustments for ${weather}`);
    
    // Weather adjustment factors
    const weatherFactors = {
      sunny: {
        outdoor: 1.3,
        beach: 1.5,
        park: 1.4,
        hiking: 1.4,
        indoor: 0.8,
        museum: 0.9
      },
      rainy: {
        indoor: 1.4,
        museum: 1.3,
        shopping: 1.2,
        outdoor: 0.7,
        beach: 0.4,
        hiking: 0.5
      },
      cold: {
        indoor: 1.3,
        museum: 1.2,
        restaurant: 1.2,
        outdoor: 0.8,
        beach: 0.5
      },
      hot: {
        water: 1.5,
        beach: 1.4,
        park: 1.2,
        indoor: 1.1,
        museum: 0.9
      },
      cloudy: {
        outdoor: 1.0,
        indoor: 1.0,
        museum: 1.1
      },
      snow: {
        indoor: 1.3,
        winter_sports: 1.5,
        outdoor: 0.7
      }
    };
    
    // Get adjustment factors for current weather
    const factors = weatherFactors[weather.toLowerCase()] || {};
    
    // Apply adjustments
    return destinations.map(dest => {
      const destination = { ...dest };
      let scoreAdjustment = 1.0; // Default no change
      
      // Check each attribute against weather factors
      if (destination.attributes) {
        Object.entries(destination.attributes).forEach(([attr, value]) => {
          if (value === true && factors[attr]) {
            scoreAdjustment *= factors[attr];
          }
        });
      }
      
      // Apply the adjustment
      destination.score = destination.score * scoreAdjustment;
      
      // Add reasoning if adjustment was significant
      if (Math.abs(scoreAdjustment - 1.0) > 0.1) {
        destination.reasoning = destination.reasoning || {};
        destination.reasoning.contextFactors = destination.reasoning.contextFactors || [];
        
        const impact = scoreAdjustment > 1.0 ? 'positive' : 'negative';
        const magnitude = Math.abs(scoreAdjustment - 1.0) > 0.3 ? 'strong' : 'moderate';
        
        destination.reasoning.contextFactors.push({
          type: 'weather',
          weather: weather,
          impact: impact,
          magnitude: magnitude,
          description: `${magnitude} ${impact} adjustment due to ${weather} weather`
        });
      }
      
      return destination;
    });
  }
  
  /**
   * Adjust scores based on time of day
   */
  applyTimeOfDayAdjustments(destinations, timeOfDay) {
    logger.debug(`Applying time of day adjustments for ${timeOfDay}`);
    
    // Time of day adjustment factors
    const timeFactors = {
      morning: {
        breakfast: 1.5,
        cafe: 1.3,
        park: 1.2,
        museum: 0.9,
        bar: 0.6,
        nightclub: 0.3
      },
      afternoon: {
        restaurant: 1.2,
        museum: 1.2,
        park: 1.2,
        shopping: 1.3,
        cafe: 1.0,
        bar: 0.8
      },
      evening: {
        restaurant: 1.4,
        bar: 1.5,
        entertainment: 1.4,
        nightclub: 1.5,
        museum: 0.7,
        shopping: 0.8
      }
    };
    
    // Get adjustment factors for current time
    const factors = timeFactors[timeOfDay.toLowerCase()] || {};
    
    // Apply adjustments
    return destinations.map(dest => {
      const destination = { ...dest };
      let scoreAdjustment = 1.0; // Default no change
      
      // Apply based on attributes
      if (destination.attributes) {
        Object.entries(destination.attributes).forEach(([attr, value]) => {
          if (value === true && factors[attr]) {
            scoreAdjustment *= factors[attr];
          }
        });
      }
      
      // Apply based on destination type
      if (destination.type && factors[destination.type.toLowerCase()]) {
        scoreAdjustment *= factors[destination.type.toLowerCase()];
      }
      
      // Check for specific time-related attributes
      if (destination.bestTimeOfDay && 
          destination.bestTimeOfDay.toLowerCase() === timeOfDay.toLowerCase()) {
        scoreAdjustment *= 1.3; // Boost if this is explicitly the best time
      }
      
      // Apply the adjustment
      destination.score = destination.score * scoreAdjustment;
      
      // Add reasoning if adjustment was significant
      if (Math.abs(scoreAdjustment - 1.0) > 0.1) {
        destination.reasoning = destination.reasoning || {};
        destination.reasoning.contextFactors = destination.reasoning.contextFactors || [];
        
        destination.reasoning.contextFactors.push({
          type: 'timeOfDay',
          timeOfDay: timeOfDay,
          impact: scoreAdjustment > 1.0 ? 'positive' : 'negative',
          description: `Adjusted based on ${timeOfDay} timing`
        });
      }
      
      return destination;
    });
  }
  
  /**
   * Adjust scores based on day of week
   */
  applyDayOfWeekAdjustments(destinations, dayOfWeek) {
    logger.debug(`Applying day of week adjustments for day ${dayOfWeek}`);
    
    // Is it a weekend?
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Day of week adjustment factors
    const weekendFactors = {
      shopping_mall: 1.3,
      park: 1.3,
      museum: 1.2,
      entertainment: 1.3,
      restaurant: 1.2,
      market: isWeekend ? 1.4 : 0.8 // Markets are often weekend-only or better on weekends
    };
    
    const weekdayFactors = {
      business: 1.2,
      museum: 1.1, // Less crowded on weekdays
      shopping: 1.1,
      tourist_attraction: 1.1 // Less crowded on weekdays
    };
    
    // Get appropriate factors
    const factors = isWeekend ? weekendFactors : weekdayFactors;
    
    // Apply adjustments
    return destinations.map(dest => {
      const destination = { ...dest };
      let scoreAdjustment = 1.0; // Default no change
      
      // Apply based on destination type
      if (destination.type && factors[destination.type.toLowerCase()]) {
        scoreAdjustment *= factors[destination.type.toLowerCase()];
      }
      
      // Apply based on attributes
      if (destination.attributes) {
        Object.entries(destination.attributes).forEach(([attr, value]) => {
          if (value === true && factors[attr]) {
            scoreAdjustment *= factors[attr];
          }
        });
      }
      
      // Special case: check if popular on weekends
      if (isWeekend && destination.attributes && destination.attributes.popularOnWeekends) {
        scoreAdjustment *= 1.3;
      }
      
      // Special case: check if less crowded on weekdays
      if (!isWeekend && destination.attributes && destination.attributes.lessCrowdedWeekdays) {
        scoreAdjustment *= 1.2;
      }
      
      // Apply the adjustment
      destination.score = destination.score * scoreAdjustment;
      
      // Add reasoning if adjustment was significant
      if (Math.abs(scoreAdjustment - 1.0) > 0.1) {
        destination.reasoning = destination.reasoning || {};
        destination.reasoning.contextFactors = destination.reasoning.contextFactors || [];
        
        destination.reasoning.contextFactors.push({
          type: 'dayOfWeek',
          isWeekend: isWeekend,
          impact: scoreAdjustment > 1.0 ? 'positive' : 'negative',
          description: `Adjusted for ${isWeekend ? 'weekend' : 'weekday'}`
        });
      }
      
      return destination;
    });
  }
  
  /**
   * Adjust scores based on season
   */
  applySeasonAdjustments(destinations, season) {
    logger.debug(`Applying seasonal adjustments for ${season}`);
    
    // Season adjustment factors
    const seasonFactors = {
      spring: {
        park: 1.4,
        garden: 1.5,
        outdoor: 1.3,
        hiking: 1.3
      },
      summer: {
        beach: 1.5,
        water: 1.4,
        outdoor: 1.3,
        park: 1.2,
        hiking: 1.1
      },
      fall: {
        park: 1.3,
        hiking: 1.4,
        scenic_view: 1.3,
        outdoor: 1.1
      },
      winter: {
        indoor: 1.2,
        museum: 1.2,
        winter_sports: 1.5,
        shopping: 1.2
      }
    };
    
    // Get adjustment factors for current season
    const factors = seasonFactors[season.toLowerCase()] || {};
    
    // Apply adjustments
    return destinations.map(dest => {
      const destination = { ...dest };
      let scoreAdjustment = 1.0; // Default no change
      
      // Apply based on attributes
      if (destination.attributes) {
        Object.entries(destination.attributes).forEach(([attr, value]) => {
          if (value === true && factors[attr]) {
            scoreAdjustment *= factors[attr];
          }
        });
      }
      
      // Check for seasonality info in destination
      if (destination.seasonality) {
        // If destination has specific seasonality data
        const seasonInfo = destination.seasonality[season.toLowerCase()];
        if (seasonInfo) {
          // If rating is provided (1-5 scale)
          if (seasonInfo.rating !== undefined) {
            // Convert 1-5 rating to adjustment factor (0.8-1.4)
            const ratingAdjustment = 0.8 + (seasonInfo.rating / 5) * 0.6;
            scoreAdjustment *= ratingAdjustment;
          }
          
          // If this is explicitly marked as peak season
          if (seasonInfo.isPeak) {
            scoreAdjustment *= 1.3;
          }
          
          // If this is explicitly marked as off season
          if (seasonInfo.isOff) {
            scoreAdjustment *= 0.7;
          }
        }
      }
      
      // Apply the adjustment
      destination.score = destination.score * scoreAdjustment;
      
      // Add reasoning if adjustment was significant
      if (Math.abs(scoreAdjustment - 1.0) > 0.1) {
        destination.reasoning = destination.reasoning || {};
        destination.reasoning.contextFactors = destination.reasoning.contextFactors || [];
        
        destination.reasoning.contextFactors.push({
          type: 'season',
          season: season,
          impact: scoreAdjustment > 1.0 ? 'positive' : 'negative',
          description: `Adjusted for ${season} season`
        });
      }
      
      return destination;
    });
  }
  
  /**
   * Adjust scores based on special events
   */
  applySpecialEventsAdjustments(destinations, events) {
    logger.debug(`Applying special event adjustments for ${events.length} events`);
    
    // Apply adjustments
    return destinations.map(dest => {
      const destination = { ...dest };
      let scoreAdjustment = 1.0; // Default no change
      let eventImpact = null;
      
      // Check if any events affect this destination
      for (const event of events) {
        // Direct match - event is at this destination
        if (event.destinationId === destination.destinationId) {
          scoreAdjustment *= 1.5; // Strong boost for destinations with events
          eventImpact = {
            event: event.name,
            type: 'direct',
            description: `This place is hosting ${event.name}`
          };
          break;
        }
        
        // Nearby match - event is near this destination
        if (event.location && destination.location) {
          const distance = this.calculateDistance(
            event.location.latitude, 
            event.location.longitude,
            destination.location.latitude,
            destination.location.longitude
          );
          
          // If event is within 1km
          if (distance < 1) {
            scoreAdjustment *= 1.2; // Moderate boost for nearby events
            eventImpact = {
              event: event.name,
              type: 'nearby',
              description: `${event.name} is happening nearby (${Math.round(distance * 1000)}m away)`
            };
          }
        }
        
        // Category match - event is related to destination's categories
        if (event.categories && destination.categories) {
          const eventCategories = Array.isArray(event.categories) 
            ? event.categories 
            : [event.categories];
            const destinationCategoryIds = destination.categories.map(c => 
                typeof c === 'object' ? c.id : c
              );
              
              // Check for category overlap
              const hasMatchingCategory = eventCategories.some(c => 
                destinationCategoryIds.includes(c)
              );
              
              if (hasMatchingCategory) {
                scoreAdjustment *= 1.1; // Small boost for thematically related
                eventImpact = {
                  event: event.name,
                  type: 'thematic',
                  description: `${event.name} is related to this destination's theme`
                };
              }
            }
          }
          
          // Apply the adjustment
          destination.score = destination.score * scoreAdjustment;
          
          // Add reasoning if an event had impact
          if (eventImpact) {
            destination.reasoning = destination.reasoning || {};
            destination.reasoning.contextFactors = destination.reasoning.contextFactors || [];
            
            destination.reasoning.contextFactors.push({
              type: 'event',
              impact: 'positive',
              ...eventImpact
            });
          }
          
          return destination;
        });
      }
      
      /**
       * Adjust scores based on available time constraints
       */
      applyTimeConstraintAdjustments(destinations, availableTime) {
        logger.debug(`Applying time constraint adjustments for ${availableTime} minutes`);
        
        // Apply adjustments
        return destinations.map(dest => {
          const destination = { ...dest };
          let scoreAdjustment = 1.0; // Default no change
          
          // Get visit duration
          const visitDuration = destination.visitDuration || 60; // Default 1 hour
          
          // Penalize destinations that take too long
          if (visitDuration > availableTime) {
            // Calculate how much it exceeds available time
            const excessTime = visitDuration - availableTime;
            
            // Apply penalty based on how much it exceeds
            // Slight penalty if it's just a bit over
            if (excessTime <= 30) {
              scoreAdjustment = 0.8;
            } 
            // Moderate penalty if it's significantly over
            else if (excessTime <= 60) {
              scoreAdjustment = 0.6;
            }
            // Strong penalty if it's way over the available time
            else {
              scoreAdjustment = 0.3;
            }
          }
          
          // Slightly boost destinations that fit well in the available time
          // Ideal duration is 70-90% of available time
          const percentOfAvailable = (visitDuration / availableTime) * 100;
          if (percentOfAvailable >= 70 && percentOfAvailable <= 90) {
            scoreAdjustment *= 1.2;
          }
          
          // Apply the adjustment
          destination.score = destination.score * scoreAdjustment;
          
          // Add reasoning if adjustment was significant
          if (Math.abs(scoreAdjustment - 1.0) > 0.1) {
            destination.reasoning = destination.reasoning || {};
            destination.reasoning.contextFactors = destination.reasoning.contextFactors || [];
            
            let message;
            if (scoreAdjustment < 1.0) {
              message = `Visit time (${visitDuration} min) exceeds available time (${availableTime} min)`;
            } else {
              message = `Fits well within available time of ${availableTime} minutes`;
            }
            
            destination.reasoning.contextFactors.push({
              type: 'timeConstraint',
              impact: scoreAdjustment > 1.0 ? 'positive' : 'negative',
              description: message
            });
          }
          
          return destination;
        });
      }
      
      /**
       * Helper function to calculate distance between two points
       */
      calculateDistance(lat1, lon1, lat2, lon2) {
        // Simple haversine formula implementation for distance in km
        const R = 6371; // Earth's radius in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
          Math.sin(dLon/2) * Math.sin(dLon/2); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        const distance = R * c;
        return distance;
      }
      
      /**
       * Helper to convert degrees to radians
       */
      deg2rad(deg) {
        return deg * (Math.PI/180);
      }
      
      /**
       * Get current weather for a location
       * This is a placeholder - in production, you would call a weather API
       */
      async getWeather(location, date) {
        try {
          // Check cache first
          if (config.REDIS_ENABLED) {
            const cacheKey = `weather:${location.latitude},${location.longitude}:${date}`;
            const cachedWeather = await getCache(cacheKey);
            if (cachedWeather) {
              return JSON.parse(cachedWeather);
            }
          }
          
          // In a real implementation, you would call a weather API here
          // For MVP, we'll use a placeholder that returns random weather
          const weatherTypes = ['sunny', 'rainy', 'cloudy', 'cold', 'hot'];
          const randomWeather = weatherTypes[Math.floor(Math.random() * weatherTypes.length)];
          
          const weatherData = {
            type: randomWeather,
            temperature: 20 + Math.floor(Math.random() * 15), // 20-35°C
            date: date
          };
          
          // Cache the result
          if (config.REDIS_ENABLED) {
            const cacheKey = `weather:${location.latitude},${location.longitude}:${date}`;
            await setCache(cacheKey, JSON.stringify(weatherData), 3600); // 1 hour
          }
          
          return weatherData;
        } catch (error) {
          logger.error('Error getting weather:', error);
          
          // Return a default if weather API fails
          return {
            type: 'sunny',
            temperature: 25,
            date: date
          };
        }
      }
      
      /**
       * Get current season based on date and hemisphere
       */
      getSeason(date, latitude) {
        // Default to northern hemisphere if latitude not provided
        const isNorthernHemisphere = latitude === undefined || latitude >= 0;
        
        // Get month from date
        const month = date ? new Date(date).getMonth() : new Date().getMonth();
        
        // Define seasons for northern hemisphere
        let season;
        if (month >= 2 && month <= 4) {
          season = 'spring';
        } else if (month >= 5 && month <= 7) {
          season = 'summer';
        } else if (month >= 8 && month <= 10) {
          season = 'fall';
        } else {
          season = 'winter';
        }
        
        // Invert for southern hemisphere
        if (!isNorthernHemisphere) {
          switch (season) {
            case 'spring': season = 'fall'; break;
            case 'summer': season = 'winter'; break;
            case 'fall': season = 'spring'; break;
            case 'winter': season = 'summer'; break;
          }
        }
        
        return season;
      }
      
      /**
       * Find events occurring at the location and date
       * This is a placeholder - in production, would integrate with an events API
       */
      async getLocalEvents(location, date) {
        try {
          // Check cache first
          if (config.REDIS_ENABLED) {
            const cacheKey = `events:${location.latitude},${location.longitude}:${date}`;
            const cachedEvents = await getCache(cacheKey);
            if (cachedEvents) {
              return JSON.parse(cachedEvents);
            }
          }
          
          // In a real implementation, you would call an events API
          // For MVP, we'll return an empty array
          const events = [];
          
          // Cache the result
          if (config.REDIS_ENABLED) {
            const cacheKey = `events:${location.latitude},${location.longitude}:${date}`;
            await setCache(cacheKey, JSON.stringify(events), 3600); // 1 hour
          }
          
          return events;
        } catch (error) {
          logger.error('Error getting local events:', error);
          return []; // Return empty array if events API fails
        }
      }
    }
    
    module.exports = new ContextFilter();