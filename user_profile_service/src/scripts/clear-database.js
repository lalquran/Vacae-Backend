require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Preference = require('../models/Preference');
const { connectDatabase } = require('../config/database');

const clearDatabase = async () => {
  try {
    await connectDatabase();
    console.log('Connected to database, clearing data...');
    
    // Clear collections
    await User.deleteMany({});
    await Profile.deleteMany({});
    await Preference.deleteMany({});
    
    console.log('Database cleared successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing database:', error);
    process.exit(1);
  }
};

clearDatabase();