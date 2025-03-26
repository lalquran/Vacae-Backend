const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class UserToken extends Model {}

UserToken.init({
  userId: {
    type: DataTypes.UUID,
    primaryKey: true
  },
  token: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'userToken',
  tableName: 'user_tokens',
  indexes: [
    {
      fields: ['expiresAt']
    }
  ]
});

module.exports = UserToken;