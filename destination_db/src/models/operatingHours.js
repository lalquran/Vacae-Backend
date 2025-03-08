const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class OperatingHours extends Model {}

OperatingHours.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  destinationId: {
    type: DataTypes.UUID,
    references: {
      model: 'destinations',
      key: 'id'
    },
    allowNull: false,
    onDelete: 'CASCADE'
  },
  dayOfWeek: {
    type: DataTypes.INTEGER, // 0 (Sunday) to 6 (Saturday)
    allowNull: false
  },
  openTime: {
    type: DataTypes.TIME, // Opening time (e.g., "09:00:00")
    allowNull: true // null means closed on this day
  },
  closeTime: {
    type: DataTypes.TIME, // Closing time (e.g., "17:00:00")
    allowNull: true
  },
  is24Hours: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  seasonStart: {
    type: DataTypes.DATEONLY, // Season start date (for seasonal hours)
    allowNull: true
  },
  seasonEnd: {
    type: DataTypes.DATEONLY, // Season end date
    allowNull: true
  },
  notes: {
    type: DataTypes.STRING // Any special notes about hours
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
  modelName: 'operatingHours',
  tableName: 'operating_hours',
  indexes: [
    {
      fields: ['destinationId']
    },
    {
      fields: ['dayOfWeek']
    }
  ]
});

module.exports = OperatingHours;
