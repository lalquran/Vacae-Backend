const mongoose = require('mongoose');

const PreferenceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  categories: {
    museums: { type: Number, min: 1, max: 5, default: 3 },
    outdoorActivities: { type: Number, min: 1, max: 5, default: 3 },
    historicalSites: { type: Number, min: 1, max: 5, default: 3 },
    food: { type: Number, min: 1, max: 5, default: 3 },
    shopping: { type: Number, min: 1, max: 5, default: 3 },
    nightlife: { type: Number, min: 1, max: 5, default: 3 },
    relaxation: { type: Number, min: 1, max: 5, default: 3 },
    tours: { type: Number, min: 1, max: 5, default: 3 },
    localExperiences: { type: Number, min: 1, max: 5, default: 3 }
  },
  schedule: {
    morningStart: { type: String, default: '08:00' }, // When to start the day
    eveningEnd: { type: String, default: '22:00' },   // When to end the day
    mealTimes: {
      breakfast: { type: String, default: '08:00' },
      lunch: { type: String, default: '13:00' },
      dinner: { type: String, default: '19:00' }
    },
    restPeriods: { type: Boolean, default: false }    // Include afternoon breaks
  },
  excludedActivities: [{
    type: String
  }],
  preferredTransportation: [{
    type: String,
    enum: ['walking', 'public', 'taxi', 'rental', 'tour']
  }]
}, { timestamps: true });

module.exports = mongoose.model('Preference', PreferenceSchema);