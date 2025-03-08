const Preference = require('../models/Preference');

// Get user preferences
exports.getPreferences = async (req, res, next) => {
  try {
    const preferences = await Preference.findOne({ user: req.user._id });
    
    if (!preferences) {
      return res.status(404).json({ message: 'Preferences not found' });
    }
    
    res.status(200).json({ data: preferences });
  } catch (error) {
    next(error);
  }
};

// Update user preferences
exports.updatePreferences = async (req, res, next) => {
  try {
    const { categories, schedule, excludedActivities, preferredTransportation } = req.body;

    // Find and update preferences, create if doesn't exist
    let preferences = await Preference.findOne({ user: req.user._id });
    
    if (preferences) {
      preferences = await Preference.findOneAndUpdate(
        { user: req.user._id },
        { 
          categories,
          schedule,
          excludedActivities,
          preferredTransportation
        },
        { new: true }
      );
    } else {
      preferences = await Preference.create({
        user: req.user._id,
        categories,
        schedule,
        excludedActivities,
        preferredTransportation
      });
    }
    
    res.status(200).json({ 
      message: 'Preferences updated successfully',
      data: preferences 
    });
  } catch (error) {
    next(error);
  }
};

// Update specific preference category
exports.updatePreferenceCategory = async (req, res, next) => {
  try {
    const { category } = req.params;
    const updateData = req.body;
    
    // Ensure the category is valid
    const validCategories = ['categories', 'schedule', 'excludedActivities', 'preferredTransportation'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ message: 'Invalid preference category' });
    }
    
    // Prepare update object with proper nesting if needed
    const updateObject = {};
    updateObject[category] = updateData;
    
    // Find and update specific category
    let preferences = await Preference.findOne({ user: req.user._id });
    
    if (preferences) {
      preferences = await Preference.findOneAndUpdate(
        { user: req.user._id },
        { $set: updateObject },
        { new: true }
      );
    } else {
      // Create new preferences with just this category
      const newPreferences = { user: req.user._id };
      newPreferences[category] = updateData;
      preferences = await Preference.create(newPreferences);
    }
    
    res.status(200).json({
      message: `${category} preferences updated successfully`,
      data: preferences
    });
  } catch (error) {
    next(error);
  }
};