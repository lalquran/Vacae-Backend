const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class Category extends Model {}

Category.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT
  },
  parentId: {
    type: DataTypes.UUID,
    references: {
      model: 'categories',
      key: 'id'
    },
    allowNull: true // Null means top-level category
  },
  icon: {
    type: DataTypes.STRING // Icon identifier or URL
  },
  displayOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0
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
  modelName: 'category',
  tableName: 'categories',
  indexes: [
    {
      unique: true,
      fields: ['slug']
    },
    {
      fields: ['parentId']
    }
  ]
});

module.exports = Category;