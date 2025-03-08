require('dotenv').config();
const { connectDatabase } = require('../config/database');
const setupAssociations = require('../models/associations');
const Destination = require('../models/destination');
const Category = require('../models/category');
const OperatingHours = require('../models/operatingHours');
const { latLngToPoint } = require('../utils/geoUtils');
const logger = require('../utils/logger');

// Category seed data
const categories = [
  {
    name: 'Attractions',
    slug: 'attractions',
    description: 'Tourist attractions and points of interest',
    icon: 'landmark',
    displayOrder: 1,
    subcategories: [
      {
        name: 'Museums',
        slug: 'museums',
        description: 'Art, history, and science museums',
        icon: 'museum',
        displayOrder: 1
      },
      {
        name: 'Historical Sites',
        slug: 'historical-sites',
        description: 'Historic landmarks and sites',
        icon: 'monument',
        displayOrder: 2
      },
      {
        name: 'Parks & Nature',
        slug: 'parks-nature',
        description: 'Parks, gardens, and natural attractions',
        icon: 'tree',
        displayOrder: 3
      },
      {
        name: 'Architecture',
        slug: 'architecture',
        description: 'Notable buildings and architectural sites',
        icon: 'building',
        displayOrder: 4
      }
    ]
  },
  {
    name: 'Food & Drink',
    slug: 'food-drink',
    description: 'Restaurants, cafes, and bars',
    icon: 'utensils',
    displayOrder: 2,
    subcategories: [
      {
        name: 'Restaurants',
        slug: 'restaurants',
        description: 'Dining establishments',
        icon: 'restaurant',
        displayOrder: 1
      },
      {
        name: 'Cafes',
        slug: 'cafes',
        description: 'Coffee shops and cafes',
        icon: 'coffee',
        displayOrder: 2
      },
      {
        name: 'Bars & Nightlife',
        slug: 'bars-nightlife',
        description: 'Bars, pubs, and nightclubs',
        icon: 'glass-martini',
        displayOrder: 3
      },
      {
        name: 'Local Cuisine',
        slug: 'local-cuisine',
        description: 'Regional and traditional food',
        icon: 'globe-utensils',
        displayOrder: 4
      }
    ]
  },
  {
    name: 'Activities',
    slug: 'activities',
    description: 'Things to do and experiences',
    icon: 'hiking',
    displayOrder: 3,
    subcategories: [
      {
        name: 'Outdoor Activities',
        slug: 'outdoor-activities',
        description: 'Hiking, biking, and outdoor adventures',
        icon: 'mountain',
        displayOrder: 1
      },
      {
        name: 'Tours',
        slug: 'tours',
        description: 'Guided tours and sightseeing',
        icon: 'map-marked',
        displayOrder: 2
      },
      {
        name: 'Entertainment',
        slug: 'entertainment',
        description: 'Shows, performances, and entertainment',
        icon: 'ticket',
        displayOrder: 3
      },
      {
        name: 'Shopping',
        slug: 'shopping',
        description: 'Markets, malls, and shopping districts',
        icon: 'shopping-bag',
        displayOrder: 4
      }
    ]
  }
];

// Destination seed data
const destinations = [
  {
    name: 'Central Park',
    description: 'An urban park in Manhattan, New York City. It is the most visited urban park in the United States.',
    latitude: 40.7812,
    longitude: -73.9665,
    address: {
      city: 'New York',
      state: 'NY',
      postalCode: '10022',
      country: 'USA'
    },
    contactInfo: {
      phone: '+1-212-310-6600',
      website: 'https://www.centralparknyc.org/'
    },
    visitDuration: 180, // 3 hours
    costLevel: 1, // Free
    categories: ['parks-nature', 'outdoor-activities'],
    operatingHours: [
      { dayOfWeek: 0, openTime: '06:00:00', closeTime: '01:00:00', is24Hours: false },
      { dayOfWeek: 1, openTime: '06:00:00', closeTime: '01:00:00', is24Hours: false },
      { dayOfWeek: 2, openTime: '06:00:00', closeTime: '01:00:00', is24Hours: false },
      { dayOfWeek: 3, openTime: '06:00:00', closeTime: '01:00:00', is24Hours: false },
      { dayOfWeek: 4, openTime: '06:00:00', closeTime: '01:00:00', is24Hours: false },
      { dayOfWeek: 5, openTime: '06:00:00', closeTime: '01:00:00', is24Hours: false },
      { dayOfWeek: 6, openTime: '06:00:00', closeTime: '01:00:00', is24Hours: false }
    ]
  },
  {
    name: 'Metropolitan Museum of Art',
    description: 'The largest art museum in the United States and among the most visited art museums in the world.',
    latitude: 40.7794,
    longitude: -73.9632,
    address: {
      street: '1000 5th Ave',
      city: 'New York',
      state: 'NY',
      postalCode: '10028',
      country: 'USA'
    },
    contactInfo: {
      phone: '+1-212-535-7710',
      website: 'https://www.metmuseum.org/'
    },
    visitDuration: 240, // 4 hours
    costLevel: 3, // Moderate
    categories: ['museums', 'attractions'],
    operatingHours: [
      { dayOfWeek: 0, openTime: '10:00:00', closeTime: '17:00:00', is24Hours: false },
      { dayOfWeek: 1, openTime: '10:00:00', closeTime: '17:00:00', is24Hours: false },
      { dayOfWeek: 2, openTime: '10:00:00', closeTime: '17:00:00', is24Hours: false },
      { dayOfWeek: 3, openTime: '10:00:00', closeTime: '17:00:00', is24Hours: false },
      { dayOfWeek: 4, openTime: '10:00:00', closeTime: '21:00:00', is24Hours: false },
      { dayOfWeek: 5, openTime: '10:00:00', closeTime: '21:00:00', is24Hours: false },
      { dayOfWeek: 6, openTime: '10:00:00', closeTime: '17:00:00', is24Hours: false }
    ]
  },
  {
    name: 'Le Bernardin',
    description: 'A French seafood restaurant in Midtown Manhattan, New York City that has been awarded three Michelin stars.',
    latitude: 40.7614,
    longitude: -73.9819,
    address: {
      street: '155 W 51st St',
      city: 'New York',
      state: 'NY',
      postalCode: '10019',
      country: 'USA'
    },
    contactInfo: {
      phone: '+1-212-554-1515',
      website: 'https://www.le-bernardin.com/'
    },
    visitDuration: 120, // 2 hours
    costLevel: 5, // Luxury
    categories: ['restaurants', 'food-drink'],
    operatingHours: [
      { dayOfWeek: 0, openTime: null, closeTime: null, is24Hours: false }, // Closed
      { dayOfWeek: 1, openTime: '17:00:00', closeTime: '22:00:00', is24Hours: false },
      { dayOfWeek: 2, openTime: '12:00:00', closeTime: '22:00:00', is24Hours: false },
      { dayOfWeek: 3, openTime: '12:00:00', closeTime: '22:00:00', is24Hours: false },
      { dayOfWeek: 4, openTime: '12:00:00', closeTime: '22:30:00', is24Hours: false },
      { dayOfWeek: 5, openTime: '12:00:00', closeTime: '22:30:00', is24Hours: false },
      { dayOfWeek: 6, openTime: '17:00:00', closeTime: '22:30:00', is24Hours: false }
    ]
  },
  {
    name: 'Empire State Building',
    description: 'A 102-story Art Deco skyscraper in Midtown Manhattan. It stood as the world\'s tallest building for nearly 40 years.',
    latitude: 40.7484,
    longitude: -73.9857,
    address: {
      street: '20 W 34th St',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'USA'
    },
    contactInfo: {
      phone: '+1-212-736-3100',
      website: 'https://www.esbnyc.com/'
    },
    visitDuration: 120, // 2 hours
    costLevel: 4, // Expensive
    categories: ['attractions', 'architecture'],
    operatingHours: [
      { dayOfWeek: 0, openTime: '08:00:00', closeTime: '02:00:00', is24Hours: false },
      { dayOfWeek: 1, openTime: '08:00:00', closeTime: '02:00:00', is24Hours: false },
      { dayOfWeek: 2, openTime: '08:00:00', closeTime: '02:00:00', is24Hours: false },
      { dayOfWeek: 3, openTime: '08:00:00', closeTime: '02:00:00', is24Hours: false },
      { dayOfWeek: 4, openTime: '08:00:00', closeTime: '02:00:00', is24Hours: false },
      { dayOfWeek: 5, openTime: '08:00:00', closeTime: '02:00:00', is24Hours: false },
      { dayOfWeek: 6, openTime: '08:00:00', closeTime: '02:00:00', is24Hours: false }
    ]
  }
];

// Seed database function
async function seedDatabase() {
  try {
    // Connect to database
    const sequelize = await connectDatabase();
    
    // Set up model associations
    setupAssociations();
    
    // Sync models (force: true will drop tables first)
    await sequelize.sync({ force: true });
    logger.info('Database tables created');
    
    // Create categories
    for (const categoryData of categories) {
      const { subcategories, ...mainCategory } = categoryData;
      const category = await Category.create(mainCategory);
      
      // Create subcategories
      if (subcategories) {
        for (const subData of subcategories) {
          await Category.create({
            ...subData,
            parentId: category.id
          });
        }
      }
    }
    logger.info('Categories created');
    
    // Get all categories for reference
    const allCategories = await Category.findAll();
    const categoryMap = allCategories.reduce((map, category) => {
      map[category.slug] = category.id;
      return map;
    }, {});
    
    // Create destinations
    for (const destData of destinations) {
      const { latitude, longitude, categories: categorySlugs, operatingHours: hours, ...destinationData } = destData;
      
      // Create location point
      const location = latLngToPoint(latitude, longitude);
      
      // Create destination
      const destination = await Destination.create({
        ...destinationData,
        location
      });
      
      // Associate with categories
      if (categorySlugs && categorySlugs.length > 0) {
        const categoryIds = categorySlugs.map(slug => categoryMap[slug]).filter(Boolean);
        await destination.setCategories(categoryIds);
      }
      
      // Add operating hours
      if (hours && hours.length > 0) {
        const hoursRecords = hours.map(hour => ({
          ...hour,
          destinationId: destination.id
        }));
        
        await OperatingHours.bulkCreate(hoursRecords);
      }
    }
    logger.info('Destinations created');
    
    logger.info('Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding database:', error);
    process.exit(1);
  }
}

// Run seed function if script is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;