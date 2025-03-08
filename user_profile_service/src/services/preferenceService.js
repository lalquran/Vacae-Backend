const Preference = require('../models/Preference');

/**
 * Initialize default preferences for a new user
 * @param {string} userId - User ID
 * @returns {Object} Created preferences
 */
exports.initializeDefaultPreferences = async (userId) => {
  try {
    // Check if preferences already exist
    const existingPreferences = await Preference.findOne({ user: userId });
    if (existingPreferences) {
      return existingPreferences;
    }
    
    // Create default preferences
    const defaultPreferences = new Preference({
      user: userId,
      // Default values are set in the schema
    });
    
    await defaultPreferences.save();
    return defaultPreferences;
  } catch (error) {
    throw error;
  }
};

/**
 * Process preference updates while maintaining valid ranges
 * @param {string} userId - User ID
 * @param {Object} updates - Preference updates
 * @returns {Object} Updated preferences
 */
exports.processPreferenceUpdates = async (userId, updates) => {
  try {
    // Get current preferences
    let preferences = await Preference.findOne({ user: userId });
    if (!preferences) {
      preferences = await this.initializeDefaultPreferences(userId);
    }
    
    // Process updates with validations
    const sanitizedUpdates = {};
    
    // Handle category ratings (ensure 1-5 range)
    if (updates.categories) {
      sanitizedUpdates.categories = {};
      for (const [key, value] of Object.entries(updates.categories)) {
        sanitizedUpdates.categories[key] = Math.max(1, Math.min(5, value));
      }
    }
    
    // Handle schedule updates
    if (updates.schedule) {
      sanitizedUpdates.schedule = {};
      
      // Validate time formats (HH:MM)
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      
      if (updates.schedule.morningStart && timeRegex.test(updates.schedule.morningStart)) {
        sanitizedUpdates.schedule.morningStart = updates.schedule.morningStart;
      }
      
      if (updates.schedule.eveningEnd && timeRegex.test(updates.schedule.eveningEnd)) {
        sanitizedUpdates.schedule.eveningEnd = updates.schedule.eveningEnd;
      }
      
      if (updates.schedule.mealTimes) {
        sanitizedUpdates.schedule.mealTimes = {};
        
        if (updates.schedule.mealTimes.breakfast && timeRegex.test(updates.schedule.mealTimes.breakfast)) {
          sanitizedUpdates.schedule.mealTimes.breakfast = updates.schedule.mealTimes.breakfast;
        }
        
        if (updates.schedule.mealTimes.lunch && timeRegex.test(updates.schedule.mealTimes.lunch)) {
          sanitizedUpdates.schedule.mealTimes.lunch = updates.schedule.mealTimes.lunch;
        }
        
        if (updates.schedule.mealTimes.dinner && timeRegex.test(updates.schedule.mealTimes.dinner)) {
          sanitizedUpdates.schedule.mealTimes.dinner = updates.schedule.mealTimes.dinner;
        }
      }
      
      if (typeof updates.schedule.restPeriods === 'boolean') {
        sanitizedUpdates.schedule.restPeriods = updates.schedule.restPeriods;
      }
    }
    
    // Handle array updates
    if (Array.isArray(updates.excludedActivities)) {
      sanitizedUpdates.excludedActivities = updates.excludedActivities;
    }
    
    if (Array.isArray(updates.preferredTransportation)) {
      const validOptions = ['walking', 'public', 'taxi', 'rental', 'tour'];
      sanitizedUpdates.preferredTransportation = updates.preferredTransportation.filter(
        option => validOptions.includes(option)
      );
    }
    
    // Update and return
    const updatedPreferences = await Preference.findOneAndUpdate(
      { user: userId },
      sanitizedUpdates,
      { new: true }
    );
    
    return updatedPreferences;
  } catch (error) {
    throw error;
  }
};