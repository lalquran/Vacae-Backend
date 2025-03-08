const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const Category = require('./category');
const OperatingHours = require('./operatingHours');

class Destination extends Model {}

Destination.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  // Location stored as PostGIS point
  location: {
    type: DataTypes.GEOMETRY('POINT', 4326), // 4326 is the SRID for WGS84 (GPS coordinates)
    allowNull: false
  },
  address: {
    type: DataTypes.JSONB, // Structured address data
    defaultValue: {}
  },
  contactInfo: {
    type: DataTypes.JSONB, // Contact information (phone, email, website)
    defaultValue: {}
  },
  visitDuration: {
    type: DataTypes.INTEGER, // Average visit duration in minutes
    defaultValue: 60
  },
  costLevel: {
    type: DataTypes.INTEGER, // 1-5 scale representing price level
    defaultValue: 3
  },
  popularity: {
    type: DataTypes.FLOAT, // 0-5 scale representing popularity
    defaultValue: 3.0
  },
  image: {
    type: DataTypes.STRING // URL to main image
  },
  imageGallery: {
    type: DataTypes.JSONB, // Array of image URLs
    defaultValue: []
  },
  externalIds: {
    type: DataTypes.JSONB, // IDs from external services (Google Places, Yelp, etc.)
    defaultValue: {}
  },
  attributes: {
    type: DataTypes.JSONB, // Flexible attributes (kid-friendly, accessible, etc.)
    defaultValue: {}
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'pending'),
    defaultValue: 'active'
  },
  seasonality: {
    type: DataTypes.JSONB, // Seasonal information (best time to visit)
    defaultValue: {}
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
  modelName: 'destination',
  tableName: 'destinations',
  indexes: [
    // GiST index for geospatial queries
    {
      using: 'GIST',
      fields: ['location']
    },
    // B-tree indexes for common queries
    {
      fields: ['status']
    },
    {
      fields: ['costLevel']
    }
  ]
});

// Associations will be set up after all models are defined

module.exports = Destination;