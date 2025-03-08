const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  travelerType: [{
    type: String,
    enum: ['general', 'foodie', 'adventurer', 'culture', 'relaxation', 'nightlife', 'shopping', 'history', 'nature'],
  }],
  pacePreference: {
    type: String,
    enum: ['relaxed', 'moderate', 'busy'],
    default: 'moderate'
  },
  budgetLevel: {
    type: String,
    enum: ['budget', 'moderate', 'luxury'],
    default: 'moderate'
  },
  activityLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  dietaryRestrictions: [{
    type: String
  }],
  mobilityConsiderations: {
    type: String
  },
  preferredAccommodationType: [{
    type: String,
    enum: ['hotel', 'hostel', 'resort', 'apartment', 'campsite']
  }],
  travelCompanions: {
    type: String,
    enum: ['solo', 'couple', 'family', 'friends', 'business'],
    default: 'solo'
  }
}, { timestamps: true });

module.exports = mongoose.model('Profile', ProfileSchema);