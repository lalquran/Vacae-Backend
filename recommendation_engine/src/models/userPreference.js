const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class UserPreference extends Model {}

UserPreference.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true
  },
  // Basic preferences
  categories: {
    type: DataTypes.JSONB, // Array of category IDs
    defaultValue: []
  },
  costLevel: {
    type: DataTypes.INTEGER, // 1-5 scale
    defaultValue: 3
  },
  activityLevel: {
    type: DataTypes.ENUM('relaxed', 'moderate', 'active'),
    defaultValue: 'moderate'
  },
  // Advanced preferences
  timeOfDay: {
    type: DataTypes.JSONB, // Preference scores for morning, afternoon, evening
    defaultValue: {
      morning: 0.33,
      afternoon: 0.33,
      evening: 0.33
    }
  },
  visitDurationPreference: {
    type: DataTypes.INTEGER, // Preferred visit duration in minutes
    defaultValue: 90
  },
  popularityPreference: {
    type: DataTypes.FLOAT, // How much user values popularity (0-1)
    defaultValue: 0.5
  },
  // Learned category weights based on feedback
  categoryWeights: {
    type: DataTypes.JSONB, // Mapping of category IDs to weights
    defaultValue: {}
  },
  // Additional context preferences
  weatherPreferences: {
    type: DataTypes.JSONB,
    defaultValue: {
      sunny: ['outdoor', 'beach', 'park'],
      rainy: ['indoor', 'museum', 'shopping'],
      cold: ['indoor', 'museum', 'restaurant'],
      hot: ['water', 'beach', 'park']
    }
  },
  // Pace preferences
  startTimePreference: {
    type: DataTypes.STRING, // HH:MM format
    defaultValue: '09:00'
  },
  endTimePreference: {
    type: DataTypes.STRING, // HH:MM format
    defaultValue: '17:00'
  },
  breakFrequency: {
    type: DataTypes.ENUM('minimal', 'moderate', 'frequent'),
    defaultValue: 'moderate'
  },
  transportModePreference: {
    type: DataTypes.ENUM('walking', 'transit', 'driving'),
    defaultValue: 'walking'
  },
  // Metadata
  lastUpdated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  source: {
    type: DataTypes.ENUM('explicit', 'derived', 'default'),
    defaultValue: 'default',
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'userPreference',
  tableName: 'user_preferences',
  indexes: [
    {
      unique: true,
      fields: ['userId']
    }
  ]
});

module.exports = UserPreference;