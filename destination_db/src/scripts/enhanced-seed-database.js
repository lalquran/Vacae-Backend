// src/scripts/enhanced-seed-database.js
require('dotenv').config();
const { connectDatabase } = require('../config/database');
const setupAssociations = require('../models/associations');
const Destination = require('../models/destination');
const Category = require('../models/category');
const OperatingHours = require('../models/operatingHours');
const Review = require('../models/review');
const { latLngToPoint } = require('../utils/geoUtils');
const logger = require('../utils/logger');
const sequelize = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Comprehensive category taxonomy - with parent/child relationships
const categoryData = [
  // Top level categories
  {
    name: 'Attractions',
    slug: 'attractions',
    description: 'Places of interest for tourists and visitors',
    icon: 'landmark',
    displayOrder: 1,
    children: [
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
        description: 'Historical landmarks and places of significance',
        icon: 'monument',
        displayOrder: 2
      },
      {
        name: 'Cultural Venues',
        slug: 'cultural-venues',
        description: 'Theaters, galleries, and cultural institutions',
        icon: 'theater-masks',
        displayOrder: 3
      },
      {
        name: 'Observation Decks',
        slug: 'observation-decks',
        description: 'Places offering panoramic views',
        icon: 'eye',
        displayOrder: 4
      },
      {
        name: 'Architectural Landmarks',
        slug: 'architectural-landmarks',
        description: 'Notable buildings and structures',
        icon: 'building',
        displayOrder: 5
      }
    ]
  },
  {
    name: 'Nature & Outdoors',
    slug: 'nature-outdoors',
    description: 'Natural spaces and outdoor activities',
    icon: 'tree',
    displayOrder: 2,
    children: [
      {
        name: 'Parks',
        slug: 'parks',
        description: 'Urban and national parks',
        icon: 'tree',
        displayOrder: 1
      },
      {
        name: 'Gardens',
        slug: 'gardens',
        description: 'Botanical gardens and landscaped spaces',
        icon: 'leaf',
        displayOrder: 2
      },
      {
        name: 'Beaches',
        slug: 'beaches',
        description: 'Coastal beaches and swimming areas',
        icon: 'umbrella-beach',
        displayOrder: 3
      },
      {
        name: 'Hiking Trails',
        slug: 'hiking-trails',
        description: 'Walking and hiking routes',
        icon: 'hiking',
        displayOrder: 4
      },
      {
        name: 'Wildlife & Zoos',
        slug: 'wildlife-zoos',
        description: 'Animal watching and zoological gardens',
        icon: 'paw',
        displayOrder: 5
      }
    ]
  },
  {
    name: 'Food & Drink',
    slug: 'food-drink',
    description: 'Dining and drinking establishments',
    icon: 'utensils',
    displayOrder: 3,
    children: [
      {
        name: 'Restaurants',
        slug: 'restaurants',
        description: 'Dining establishments of all types',
        icon: 'utensils',
        displayOrder: 1
      },
      {
        name: 'Cafes',
        slug: 'cafes',
        description: 'Coffee shops and casual cafes',
        icon: 'coffee',
        displayOrder: 2
      },
      {
        name: 'Bars & Pubs',
        slug: 'bars-pubs',
        description: 'Drinking establishments',
        icon: 'glass-martini',
        displayOrder: 3
      },
      {
        name: 'Food Markets',
        slug: 'food-markets',
        description: 'Markets selling food and ingredients',
        icon: 'shopping-basket',
        displayOrder: 4
      },
      {
        name: 'Bakeries',
        slug: 'bakeries',
        description: 'Establishments selling baked goods',
        icon: 'bread-slice',
        displayOrder: 5
      }
    ]
  },
  {
    name: 'Shopping',
    slug: 'shopping',
    description: 'Retail and shopping experiences',
    icon: 'shopping-bag',
    displayOrder: 4,
    children: [
      {
        name: 'Malls & Shopping Centers',
        slug: 'malls-shopping-centers',
        description: 'Shopping malls and retail complexes',
        icon: 'store',
        displayOrder: 1
      },
      {
        name: 'Markets',
        slug: 'markets',
        description: 'Street markets and vendor areas',
        icon: 'store-alt',
        displayOrder: 2
      },
      {
        name: 'Boutiques',
        slug: 'boutiques',
        description: 'Small retail shops and specialty stores',
        icon: 'tshirt',
        displayOrder: 3
      },
      {
        name: 'Souvenir Shops',
        slug: 'souvenir-shops',
        description: 'Stores selling mementos and souvenirs',
        icon: 'gift',
        displayOrder: 4
      }
    ]
  },
  {
    name: 'Entertainment',
    slug: 'entertainment',
    description: 'Entertainment venues and activities',
    icon: 'music',
    displayOrder: 5,
    children: [
      {
        name: 'Theaters & Shows',
        slug: 'theaters-shows',
        description: 'Venues for performances and shows',
        icon: 'theater-masks',
        displayOrder: 1
      },
      {
        name: 'Nightlife',
        slug: 'nightlife',
        description: 'Nightclubs and evening entertainment',
        icon: 'moon',
        displayOrder: 2
      },
      {
        name: 'Cinemas',
        slug: 'cinemas',
        description: 'Movie theaters',
        icon: 'film',
        displayOrder: 3
      },
      {
        name: 'Casinos',
        slug: 'casinos',
        description: 'Gambling establishments',
        icon: 'dice',
        displayOrder: 4
      },
      {
        name: 'Amusement Parks',
        slug: 'amusement-parks',
        description: 'Theme parks and fairgrounds',
        icon: 'ferris-wheel',
        displayOrder: 5
      }
    ]
  }
];

// Sample destinations data - New York City focused
const destinationData = [
  // Attractions
  {
    name: 'Empire State Building',
    description: 'Iconic 102-story skyscraper completed in 1931, offering panoramic observatories on the 86th and 102nd floors with spectacular views of New York City.',
    latitude: 40.7484,
    longitude: -73.9857,
    address: {
      street: '350 5th Ave',
      city: 'New York',
      state: 'NY',
      postalCode: '10118',
      country: 'USA'
    },
    contactInfo: {
      phone: '+1-212-736-3100',
      website: 'https://www.esbnyc.com/'
    },
    visitDuration: 120, // 2 hours
    costLevel: 4, // Expensive
    categories: ['attractions', 'observation-decks', 'architectural-landmarks'],
    operatingHours: [
      { dayOfWeek: 0, openTime: '08:00:00', closeTime: '02:00:00' }, // Sunday
      { dayOfWeek: 1, openTime: '08:00:00', closeTime: '02:00:00' }, // Monday
      { dayOfWeek: 2, openTime: '08:00:00', closeTime: '02:00:00' }, // Tuesday
      { dayOfWeek: 3, openTime: '08:00:00', closeTime: '02:00:00' }, // Wednesday
      { dayOfWeek: 4, openTime: '08:00:00', closeTime: '02:00:00' }, // Thursday
      { dayOfWeek: 5, openTime: '08:00:00', closeTime: '02:00:00' }, // Friday
      { dayOfWeek: 6, openTime: '08:00:00', closeTime: '02:00:00' }  // Saturday
    ],
    popularity: 4.8
  },
  {
    name: 'Metropolitan Museum of Art',
    description: 'One of the world\'s largest and most prestigious art museums, housing over 2 million works spanning 5,000 years of world culture.',
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
    categories: ['attractions', 'museums', 'cultural-venues'],
    operatingHours: [
      { dayOfWeek: 0, openTime: '10:00:00', closeTime: '17:00:00' }, // Sunday
      { dayOfWeek: 1, openTime: '10:00:00', closeTime: '17:00:00' }, // Monday
      { dayOfWeek: 2, openTime: '10:00:00', closeTime: '17:00:00' }, // Tuesday
      { dayOfWeek: 3, openTime: '10:00:00', closeTime: '17:00:00' }, // Wednesday
      { dayOfWeek: 4, openTime: '10:00:00', closeTime: '21:00:00' }, // Thursday
      { dayOfWeek: 5, openTime: '10:00:00', closeTime: '21:00:00' }, // Friday
      { dayOfWeek: 6, openTime: '10:00:00', closeTime: '21:00:00' }  // Saturday
    ],
    popularity: 4.7
  },
  {
    name: 'Statue of Liberty',
    description: 'Iconic copper statue on Liberty Island in New York Harbor, dedicated in 1886 as a gift from France to the United States.',
    latitude: 40.6892,
    longitude: -74.0445,
    address: {
      street: 'Liberty Island',
      city: 'New York',
      state: 'NY',
      postalCode: '10004',
      country: 'USA'
    },
    contactInfo: {
      phone: '+1-212-363-3200',
      website: 'https://www.nps.gov/stli/'
    },
    visitDuration: 180, // 3 hours
    costLevel: 3, // Moderate
    categories: ['attractions', 'historical-sites'],
    operatingHours: [
      { dayOfWeek: 0, openTime: '09:30:00', closeTime: '16:00:00' }, // Sunday
      { dayOfWeek: 1, openTime: '09:30:00', closeTime: '16:00:00' }, // Monday
      { dayOfWeek: 2, openTime: '09:30:00', closeTime: '16:00:00' }, // Tuesday
      { dayOfWeek: 3, openTime: '09:30:00', closeTime: '16:00:00' }, // Wednesday
      { dayOfWeek: 4, openTime: '09:30:00', closeTime: '16:00:00' }, // Thursday
      { dayOfWeek: 5, openTime: '09:30:00', closeTime: '16:00:00' }, // Friday
      { dayOfWeek: 6, openTime: '09:30:00', closeTime: '16:00:00' }  // Saturday
    ],
    popularity: 4.6
  },
  
  // Nature & Outdoors
  {
    name: 'Central Park',
    description: 'Urban park spanning 843 acres in the heart of Manhattan, featuring walking paths, lakes, gardens, and recreational spaces.',
    latitude: 40.7812,
    longitude: -73.9665,
    address: {
      street: 'Central Park',
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
    categories: ['nature-outdoors', 'parks'],
    operatingHours: [
      { dayOfWeek: 0, is24Hours: true }, // Sunday
      { dayOfWeek: 1, is24Hours: true }, // Monday
      { dayOfWeek: 2, is24Hours: true }, // Tuesday
      { dayOfWeek: 3, is24Hours: true }, // Wednesday
      { dayOfWeek: 4, is24Hours: true }, // Thursday
      { dayOfWeek: 5, is24Hours: true }, // Friday
      { dayOfWeek: 6, is24Hours: true }  // Saturday
    ],
    popularity: 4.9
  },
  {
    name: 'Brooklyn Botanic Garden',
    description: '52-acre garden in the heart of Brooklyn featuring specialized plant collections and distinctive gardens.',
    latitude: 40.6699,
    longitude: -73.9629,
    address: {
      street: '990 Washington Ave',
      city: 'Brooklyn',
      state: 'NY',
      postalCode: '11225',
      country: 'USA'
    },
    contactInfo: {
      phone: '+1-718-623-7200',
      website: 'https://www.bbg.org/'
    },
    visitDuration: 120, // 2 hours
    costLevel: 2, // Inexpensive
    categories: ['nature-outdoors', 'gardens'],
    operatingHours: [
      { dayOfWeek: 0, openTime: '10:00:00', closeTime: '18:00:00' }, // Sunday
      { dayOfWeek: 1, openTime: '10:00:00', closeTime: '18:00:00' }, // Monday
      { dayOfWeek: 2, openTime: '10:00:00', closeTime: '18:00:00' }, // Tuesday
      { dayOfWeek: 3, openTime: '10:00:00', closeTime: '18:00:00' }, // Wednesday
      { dayOfWeek: 4, openTime: '10:00:00', closeTime: '18:00:00' }, // Thursday
      { dayOfWeek: 5, openTime: '10:00:00', closeTime: '18:00:00' }, // Friday
      { dayOfWeek: 6, openTime: '10:00:00', closeTime: '18:00:00' }  // Saturday
    ],
    popularity: 4.5
  },
  {
    name: 'Coney Island Beach',
    description: 'Popular beach destination featuring a boardwalk, amusement parks, and entertainment venues along the Atlantic Ocean.',
    latitude: 40.5755,
    longitude: -73.9707,
    address: {
      street: 'Boardwalk',
      city: 'Brooklyn',
      state: 'NY',
      postalCode: '11224',
      country: 'USA'
    },
    contactInfo: {
      website: 'https://www.nycgovparks.org/parks/coney-island-beach-and-boardwalk'
    },
    visitDuration: 240, // 4 hours
    costLevel: 1, // Free
    categories: ['nature-outdoors', 'beaches', 'amusement-parks'],
    operatingHours: [
      { dayOfWeek: 0, is24Hours: true }, // Sunday
      { dayOfWeek: 1, is24Hours: true }, // Monday
      { dayOfWeek: 2, is24Hours: true }, // Tuesday
      { dayOfWeek: 3, is24Hours: true }, // Wednesday
      { dayOfWeek: 4, is24Hours: true }, // Thursday
      { dayOfWeek: 5, is24Hours: true }, // Friday
      { dayOfWeek: 6, is24Hours: true }  // Saturday
    ],
    popularity: 4.4,
    seasonality: {
      peakMonths: [6, 7, 8], // June, July, August
      offPeakMonths: [11, 12, 1, 2] // November through February
    }
  },
  
  // Food & Drink
  {
    name: 'Katz\'s Delicatessen',
    description: 'Iconic Jewish delicatessen serving pastrami, corned beef, and other traditional deli foods since 1888.',
    latitude: 40.7223,
    longitude: -73.9874,
    address: {
      street: '205 E Houston St',
      city: 'New York',
      state: 'NY',
      postalCode: '10002',
      country: 'USA'
    },
    contactInfo: {
      phone: '+1-212-254-2246',
      website: 'https://www.katzsdelicatessen.com/'
    },
    visitDuration: 60, // 1 hour
    costLevel: 3, // Moderate
    categories: ['food-drink', 'restaurants'],
    operatingHours: [
      { dayOfWeek: 0, openTime: '08:00:00', closeTime: '22:45:00' }, // Sunday
      { dayOfWeek: 1, openTime: '08:00:00', closeTime: '22:45:00' }, // Monday
      { dayOfWeek: 2, openTime: '08:00:00', closeTime: '22:45:00' }, // Tuesday
      { dayOfWeek: 3, openTime: '08:00:00', closeTime: '22:45:00' }, // Wednesday
      { dayOfWeek: 4, openTime: '08:00:00', closeTime: '22:45:00' }, // Thursday
      { dayOfWeek: 5, openTime: '08:00:00', closeTime: '00:00:00' }, // Friday
      { dayOfWeek: 6, openTime: '08:00:00', closeTime: '00:00:00' }  // Saturday
    ],
    popularity: 4.6
  },
  {
    name: 'Le Bernardin',
    description: 'Upscale French seafood restaurant led by chef Eric Ripert, consistently rated among the best restaurants in the world.',
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
    costLevel: 5, // Very expensive
    categories: ['food-drink', 'restaurants'],
    operatingHours: [
      { dayOfWeek: 0, openTime: null, closeTime: null }, // Closed on Sunday
      { dayOfWeek: 1, openTime: '17:00:00', closeTime: '22:00:00' }, // Monday
      { dayOfWeek: 2, openTime: '12:00:00', closeTime: '22:00:00' }, // Tuesday
      { dayOfWeek: 3, openTime: '12:00:00', closeTime: '22:00:00' }, // Wednesday
      { dayOfWeek: 4, openTime: '12:00:00', closeTime: '22:30:00' }, // Thursday
      { dayOfWeek: 5, openTime: '12:00:00', closeTime: '22:30:00' }, // Friday
      { dayOfWeek: 6, openTime: '17:00:00', closeTime: '22:30:00' }  // Saturday
    ],
    popularity: 4.8
  },
  {
    name: 'Stumptown Coffee Roasters',
    description: 'Trendy café chain known for its high-quality, direct-trade coffee and modern aesthetic.',
    latitude: 40.7397,
    longitude: -73.9894,
    address: {
      street: '18 W 29th St',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      country: 'USA'
    },
    contactInfo: {
      phone: '+1-212-679-2222',
      website: 'https://www.stumptowncoffee.com/'
    },
    visitDuration: 30, // 30 minutes
    costLevel: 2, // Inexpensive
    categories: ['food-drink', 'cafes'],
    operatingHours: [
      { dayOfWeek: 0, openTime: '06:30:00', closeTime: '20:00:00' }, // Sunday
      { dayOfWeek: 1, openTime: '06:30:00', closeTime: '20:00:00' }, // Monday
      { dayOfWeek: 2, openTime: '06:30:00', closeTime: '20:00:00' }, // Tuesday
      { dayOfWeek: 3, openTime: '06:30:00', closeTime: '20:00:00' }, // Wednesday
      { dayOfWeek: 4, openTime: '06:30:00', closeTime: '20:00:00' }, // Thursday
      { dayOfWeek: 5, openTime: '06:30:00', closeTime: '20:00:00' }, // Friday
      { dayOfWeek: 6, openTime: '06:30:00', closeTime: '20:00:00' }  // Saturday
    ],
    popularity: 4.5
  },
  
  // Additional destinations for other categories...
];

// Sample reviews data
const reviewsData = [
  {
    destinationName: 'Empire State Building',
    reviews: [
      {
        userId: 'user1',
        rating: 5,
        comment: 'Amazing views of the city! Definitely worth the wait.',
        visitDate: '2023-06-15',
        visitContext: 'family'
      },
      {
        userId: 'user2',
        rating: 4,
        comment: 'Great experience but very crowded. Come early if you can.',
        visitDate: '2023-07-22',
        visitContext: 'couple'
      },
      {
        userId: 'user3',
        rating: 5,
        comment: 'A must-see in NYC. The views are unbelievable, especially at sunset.',
        visitDate: '2023-05-10',
        visitContext: 'solo'
      }
    ]
  },
  {
    destinationName: 'Central Park',
    reviews: [
      {
        userId: 'user4',
        rating: 5,
        comment: 'Beautiful oasis in the middle of the city. Perfect for a long walk or picnic.',
        visitDate: '2023-08-05',
        visitContext: 'friends'
      },
      {
        userId: 'user5',
        rating: 5,
        comment: 'So much to explore! The Bethesda Fountain area was my favorite.',
        visitDate: '2023-07-18',
        visitContext: 'family'
      },
      {
        userId: 'user6',
        rating: 4,
        comment: 'Lovely park but can get quite crowded on weekends. Weekday mornings are best.',
        visitDate: '2023-06-30',
        visitContext: 'solo'
      }
    ]
  },
  {
    destinationName: 'Metropolitan Museum of Art',
    reviews: [
      {
        userId: 'user7',
        rating: 5,
        comment: 'Could spend days here and not see everything. Amazing collections.',
        visitDate: '2023-05-22',
        visitContext: 'solo'
      },
      {
        userId: 'user8',
        rating: 4,
        comment: 'Incredible art but overwhelming for young children. Plan your visit by gallery.',
        visitDate: '2023-06-12',
        visitContext: 'family'
      },
      {
        userId: 'user9',
        rating: 5,
        comment: 'The Egyptian and European painting collections are outstanding.',
        visitDate: '2023-07-05',
        visitContext: 'friends'
      }
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
    
    // Create categories with hierarchy
    const categoryMap = {};
    
    // First create top-level categories
    for (const category of categoryData) {
      const { children, ...mainCategory } = category;
      // Use UUID for category ID
      const mainCategoryId = uuidv4();
      const createdCategory = await Category.create({
        ...mainCategory,
        id: mainCategoryId
      });
      
      categoryMap[createdCategory.slug] = createdCategory.id;
      
      // Create subcategories
      if (children && children.length > 0) {
        for (const childData of children) {
          // Use UUID for subcategory ID
          const childCategoryId = uuidv4();
          const childCategory = await Category.create({
            ...childData,
            id: childCategoryId,
            parentId: createdCategory.id
          });
          categoryMap[childCategory.slug] = childCategory.id;
        }
      }
    }
    logger.info('Categories created');
    
    // Create destinations
    const destinationMap = {};
    
    for (const destData of destinationData) {
      const { latitude, longitude, categories: categorySlugs, operatingHours: hours, ...destinationInfo } = destData;
      
      // Create location point
      const location = latLngToPoint(latitude, longitude);
      
      // Use UUID for destination ID
      const destinationId = uuidv4();
      
      // Create destination
      const destination = await Destination.create({
        ...destinationInfo,
        id: destinationId,
        location
      });
      
      destinationMap[destination.name] = destination.id;
      
      // Associate with categories
      if (categorySlugs && categorySlugs.length > 0) {
        const categoryIds = categorySlugs.map(slug => categoryMap[slug]).filter(Boolean);
        if (categoryIds.length > 0) {
          // Create destination_categories entries directly
          for (const categoryId of categoryIds) {
            await sequelize.query(`
              INSERT INTO "destination_categories" ("destinationId", "categoryId", "createdAt", "updatedAt")
              VALUES ('${destination.id}', '${categoryId}', NOW(), NOW())
            `);
          }
        }
      }
      
      // Add operating hours
      if (hours && hours.length > 0) {
        const hoursRecords = hours.map(hour => ({
          ...hour,
          id: uuidv4(), // Use UUID for each operating hours record
          destinationId: destination.id
        }));
        
        await OperatingHours.bulkCreate(hoursRecords);
      }
    }
    logger.info('Destinations created');
    
    // Add reviews
    for (const reviewData of reviewsData) {
      const destinationId = destinationMap[reviewData.destinationName];
      if (destinationId && reviewData.reviews) {
        const reviews = reviewData.reviews.map(review => ({
          ...review,
          id: uuidv4(), // Use UUID for each review
          destinationId
        }));
        
        await Review.bulkCreate(reviews);
      }
    }
    logger.info('Reviews created');
    
    logger.info('Database seeding completed successfully!');
    
    // Close connection
    await sequelize.close();
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