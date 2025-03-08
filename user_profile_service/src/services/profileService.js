const Profile = require('../models/Profile');
const Preference = require('../models/Preference');

/**
 * Get complete user profile with preferences
 * @param {string} userId - User ID
 * @returns {Object} Complete user profile data
 */
exports.getCompleteProfile = async (userId) => {
  try {
    // Get basic profile
    const profile = await Profile.findOne({ user: userId });
    if (!profile) {
      throw new Error('Profile not found');
    }
    
    // Get preferences
    const preferences = await Preference.findOne({ user: userId });
    
    // Combine and return
    return {
      profile,
      preferences: preferences || null
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Calculate traveler profile type based on preferences
 * @param {string} userId - User ID
 * @returns {Array} Traveler type categories
 */
exports.calculateTravelerType = async (userId) => {
  try {
    const preferences = await Preference.findOne({ user: userId });
    if (!preferences || !preferences.categories) {
      return ['general'];
    }
    
    // Get top 3 highest rated categories
    const categories = preferences.categories;
    const categoryRatings = [
      { type: 'foodie', value: categories.food || 3 },
      { type: 'adventurer', value: categories.outdoorActivities || 3 },
      { type: 'culture', value: (categories.museums + categories.historicalSites) / 2 || 3 },
      { type: 'nightlife', value: categories.nightlife || 3 },
      { type: 'shopping', value: categories.shopping || 3 },
      { type: 'relaxation', value: categories.relaxation || 3 },
      { type: 'local', value: categories.localExperiences || 3 }
    ];
    
    // Sort by value descending
    categoryRatings.sort((a, b) => b.value - a.value);
    
    // Return top 3 or fewer if they're tied
    const topValue = categoryRatings[0].value;
    const secondValue = categoryRatings[1]?.value;
    const thirdValue = categoryRatings[2]?.value;
    
    const topCategories = categoryRatings
      .filter(cat => cat.value >= thirdValue && cat.value > 3) // Only include preferences rated above neutral
      .map(cat => cat.type);
    
    return topCategories.length > 0 ? topCategories : ['general'];
  } catch (error) {
    throw error;
  }
};