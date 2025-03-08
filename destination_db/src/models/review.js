const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Review extends Model {}

Review.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  destinationId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  rating: {
    type: DataTypes.FLOAT, // 1-5 scale
    allowNull: false,
    validate: {
      min: 1,
      max: 5
    }
  },
  comment: {
    type: DataTypes.TEXT
  },
  visitDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  visitContext: {
    type: DataTypes.STRING, // e.g., "solo", "family", "couple"
    allowNull: true
  },
  attributes: {
    type: DataTypes.JSONB, // Structured feedback on specific attributes
    defaultValue: {}
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'approved'
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
  modelName: 'review',
  tableName: 'reviews',
  indexes: [
    {
      fields: ['destinationId']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['rating']
    }
  ]
});

module.exports = Review;