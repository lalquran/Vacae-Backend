require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const { connectDatabase } = require('../config/database');
const setupAssociations = require('../models/associations');
const Destination = require('../models/destination');
const Category = require('../models/category');
const OperatingHours = require('../models/operatingHours');
const { latLngToPoint } = require('../utils/geoUtils');
const logger = require('../utils/logger');

// Function to import data from CSV file
async function importFromCSV(filePath) {
  try {
    const data = [];
    
    // Create a readable stream from the CSV file
    const parser = fs
      .createReadStream(filePath)
      .pipe(parse({
        columns: true,
        skip_empty_lines: true,
        trim: true
      }));
    
    // Parse CSV data
    for await (const record of parser) {
      data.push(record);
    }
    
    return data;
  } catch (error) {
    logger.error('Error reading CSV file:', error);
    throw error;
  }
}

// Process destination data
function processDestinationData(data) {
  return data.map(record => {
    // Extract categories as array
    const categories = record.categories ? record.categories.split(',').map(c => c.trim()) : [];
    
    // Parse operating hours
    const operatingHours = [];
    for (let i = 0; i < 7; i++) {
      const openKey = `openTime_${i}`;
      const closeKey = `closeTime_${i}`;
      
      if (record[openKey] || record[closeKey]) {
        operatingHours.push({
          dayOfWeek: i,
          openTime: record[openKey] || null,
          closeTime: record[closeKey] || null,
          is24Hours: record[openKey] === '24hours'
        });
      }
    }
    
    return {
      name: record.name,
      description: record.description,
      latitude: parseFloat(record.latitude),
      longitude: parseFloat(record.longitude),
      address: {
        street: record.street,
        city: record.city,
        state: record.state,
        postalCode: record.postalCode,
        country: record.country
      },
      contactInfo: {
        phone: record.phone,
        email: record.email,
        website: record.website
      },
      visitDuration: parseInt(record.visitDuration) || 60,
      costLevel: parseInt(record.costLevel) || 3,
      categories,
      operatingHours
    };
  });
}

// Import data from CSV file
async function importData(filePath) {
  try {
    // Connect to database
    const sequelize = await connectDatabase();
    
    // Set up model associations
    setupAssociations();
    
    // Import data from CSV file
    logger.info(`Importing data from ${filePath}...`);
    const rawData = await importFromCSV(filePath);
    logger.info(`Found ${rawData.length} records in CSV file`);
    
    // Process data
    const destinationData = processDestinationData(rawData);
    
    // Get all categories for reference
    const allCategories = await Category.findAll();
    const categoryMap = allCategories.reduce((map, category) => {
      map[category.slug] = category.id;
      return map;
    }, {});
    
    // Import destinations
    let created = 0;
    let errors = 0;
    
    for (const destData of destinationData) {
      try {
        const { latitude, longitude, categories: categorySlugs, operatingHours: hours, ...destinationData } = destData;
        
        // Create location point
        const location = latLngToPoint(latitude, longitude);
        if (!location) {
          logger.warn(`Invalid location coordinates for ${destData.name}, skipping`);
          errors++;
          continue;
        }
        
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
        
        created++;
      } catch (error) {
        logger.error(`Error importing destination ${destData.name}:`, error);
        errors++;
      }
    }
    
    logger.info(`Import completed: Created ${created} destinations, encountered ${errors} errors`);
    process.exit(0);
  } catch (error) {
    logger.error('Error during import:', error);
    process.exit(1);
  }
}

// Run import function if script is executed directly
if (require.main === module) {
  const filePath = process.argv[2];
  
  if (!filePath) {
    logger.error('Please provide a CSV file path');
    process.exit(1);
  }
  
  importData(filePath);
}

module.exports = importData;
