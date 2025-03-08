require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Preference = require('../models/Preference');
const { connectDatabase } = require('../config/database');

// Sample data to seed
const users = [
  {
    email: 'adventurer@example.com',
    password: 'Password123!',
    firstName: 'Alex',
    lastName: 'Adventure',
    profile: {
      travelerType: ['adventurer', 'nature'],
      pacePreference: 'busy',
      budgetLevel: 'moderate',
      activityLevel: 'high',
      travelCompanions: 'solo'
    },
    preferences: {
      categories: {
        museums: 2,
        outdoorActivities: 5,
        historicalSites: 3,
        food: 4,
        shopping: 1,
        nightlife: 2,
        relaxation: 1,
        tours: 4,
        localExperiences: 5
      },
      schedule: {
        morningStart: '06:00',
        eveningEnd: '22:00'
      },
      preferredTransportation: ['walking', 'public']
    }
  },
  {
    email: 'foodie@example.com',
    password: 'Password123!',
    firstName: 'Jamie',
    lastName: 'Foodie',
    profile: {
      travelerType: ['foodie', 'culture'],
      pacePreference: 'relaxed',
      budgetLevel: 'luxury',
      activityLevel: 'medium',
      travelCompanions: 'couple'
    },
    preferences: {
      categories: {
        museums: 3,
        outdoorActivities: 2,
        historicalSites: 3,
        food: 5,
        shopping: 3,
        nightlife: 4,
        relaxation: 3,
        tours: 2,
        localExperiences: 5
      },
      schedule: {
        morningStart: '09:00',
        eveningEnd: '23:00'
      },
      preferredTransportation: ['taxi', 'walking']
    }
  },
  {
    email: 'history@example.com',
    password: 'Password123!',
    firstName: 'Sam',
    lastName: 'Scholar',
    profile: {
      travelerType: ['history', 'culture'],
      pacePreference: 'moderate',
      budgetLevel: 'budget',
      activityLevel: 'medium',
      travelCompanions: 'family'
    },
    preferences: {
      categories: {
        museums: 5,
        outdoorActivities: 2,
        historicalSites: 5,
        food: 3,
        shopping: 2,
        nightlife: 1,
        relaxation: 2,
        tours: 5,
        localExperiences: 3
      },
      schedule: {
        morningStart: '08:00',
        eveningEnd: '21:00',
        restPeriods: true
      },
      preferredTransportation: ['public', 'walking']
    }
  }
];

// Connect to database and seed
const seedDatabase = async () => {
  try {
    await connectDatabase();
    console.log('Connected to database, starting seed...');
    
    // Clear existing data
    await User.deleteMany({});
    await Profile.deleteMany({});
    await Preference.deleteMany({});
    console.log('Cleared existing data');
    
    // Create users, profiles, and preferences
    for (const userData of users) {
      // Create user
      const user = new User({
        email: userData.email,
        password: userData.password, // Will be hashed by the model
        firstName: userData.firstName,
        lastName: userData.lastName
      });
      
      await user.save();
      console.log(`Created user: ${userData.email}`);
      
      // Create profile
      const profile = new Profile({
        user: user._id,
        ...userData.profile
      });
      
      await profile.save();
      console.log(`Created profile for: ${userData.email}`);
      
      // Create preferences
      const preferences = new Preference({
        user: user._id,
        ...userData.preferences
      });
      
      await preferences.save();
      console.log(`Created preferences for: ${userData.email}`);
    }
    
    console.log('Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();