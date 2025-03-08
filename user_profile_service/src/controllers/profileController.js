const Profile = require('../models/Profile');

// Get user profile
exports.getProfile = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ user: req.user._id });
    
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    res.status(200).json({ data: profile });
  } catch (error) {
    next(error);
  }
};

// Create or update profile
exports.updateProfile = async (req, res, next) => {
  try {
    const {
      travelerType,
      pacePreference,
      budgetLevel,
      activityLevel,
      dietaryRestrictions,
      mobilityConsiderations,
      preferredAccommodationType,
      travelCompanions
    } = req.body;

    // Find and update profile, create if doesn't exist
    let profile = await Profile.findOne({ user: req.user._id });
    
    if (profile) {
      profile = await Profile.findOneAndUpdate(
        { user: req.user._id },
        { 
          travelerType,
          pacePreference,
          budgetLevel,
          activityLevel,
          dietaryRestrictions,
          mobilityConsiderations,
          preferredAccommodationType,
          travelCompanions
        },
        { new: true }
      );
    } else {
      profile = await Profile.create({
        user: req.user._id,
        travelerType,
        pacePreference,
        budgetLevel,
        activityLevel,
        dietaryRestrictions,
        mobilityConsiderations,
        preferredAccommodationType,
        travelCompanions
      });
    }
    
    res.status(200).json({ 
      message: 'Profile updated successfully',
      data: profile 
    });
  } catch (error) {
    next(error);
  }
};