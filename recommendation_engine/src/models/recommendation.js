const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Recommendation extends Model {}

Recommendation.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  itineraryId: {
    type: DataTypes.UUID,
    allowNull: true // Null until itinerary is created
  },
  destinationId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  score: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  reasoning: {
    type: DataTypes.JSONB, // Store factors that influenced the recommendation
    defaultValue: {}
  },
  position: {
    type: DataTypes.INTEGER, // Position in the recommended sequence
    allowNull: true
  },
  feedback: {
    type: DataTypes.JSONB, // User feedback on this recommendation
    defaultValue: {}
  },
  contextData: {
    type: DataTypes.JSONB, // Context at time of recommendation (weather, etc.)
    defaultValue: {}
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'completed'),
    defaultValue: 'pending'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'recommendation',
  tableName: 'recommendations',
  indexes: [
    {
      fields: ['userId']
    },
    {
      fields: ['itineraryId']
    },
    {
      fields: ['destinationId']
    },
    {
      fields: ['status']
    }
  ]
});

module.exports = Recommendation;