require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const { connectDatabase } = require('../config/database');
const setupAssociations = require('../models/associations');
const Destination = require('../models/destination');
const Category = require('../models/category');
const OperatingHours = require('../models/operatingHours');
const { latLngToPoint } = require('../utils/geoUtils');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');

// Function to import destinations from CSV
async function importFromCSV(filePath, options = {}) {
  try {
    // Connect to database
    await connectDatabase();
    
    // Set up model associations
    setupAssociations();
    
    // Get all categories for reference
    const categories = await Category.findAll();
    const categoryMap = categories.reduce((map, category) => {
      map[category.slug] = category.id;
      map[category.name.toLowerCase()] = category.id; // Also map by name for flexibility
      return map;
    }, {});
    
    // Create tracking for import stats
    const stats = {
      total: 0,
      created: 0,
      updated: 0,
      errors: 0,
      skipped: 0
    };
    
    // Store errors for reporting
    const errors = [];
    
    // Read CSV file line by line
    const results = [];
    
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });
    
    logger.info(`Read ${results.length} records from CSV file`);
    stats.total = results.length;
    
    // Process each record
    for (const record of results) {
      try {
        stats.total++;
        
        // Basic validation
        if (!record.name || !record.latitude || !record.longitude) {
          logger.warn(`Skipping record with missing required fields: ${JSON.stringify(record)}`);
          stats.skipped++;
          errors.push({
            record,
            error: 'Missing required fields (name, latitude, longitude)'
          });
          continue;
        }
        
        // Check if destination already exists by name and approximate location
        const existingDestination = await Destination.findOne({
          where: sequelize.literal(`
            name = '${record.name.replace(/'/g, "''")}'
            AND ST_DWithin(
              location::geography,
              ST_SetSRID(ST_MakePoint(${record.longitude}, ${record.latitude}), 4326)::geography,
              100 -- 100 meters
            )
          `)
        });
        
        let destination;
        
        // Prepare common data
        const latitude = parseFloat(record.latitude);
        const longitude = parseFloat(record.longitude);
        const location = latLngToPoint(latitude, longitude);
        
        // Build address object
        const address = {
          street: record.street || '',
          city: record.city || '',
          state: record.state || '',
          postalCode: record.postalCode || '',
          country: record.country || 'USA'  // Default country
        };
        
        // Build contact info
        const contactInfo = {
          phone: record.phone || '',
          email: record.email || '',
          website: record.website || ''
        };
        
        // Process categories
        let categoryIds = [];
        if (record.categories) {
          // Split categories and find matching IDs
          const categorySlugs = record.categories.split(',').map(c => c.trim().toLowerCase());
          categoryIds = categorySlugs
            .map(slug => categoryMap[slug])
            .filter(Boolean);
        }
        
        // If destination exists, update it
        if (existingDestination && options.update) {
          // Update destination
          await existingDestination.update({
            name: record.name,
            description: record.description || existingDestination.description,
            location,
            address: { ...existingDestination.address, ...address },
            contactInfo: { ...existingDestination.contactInfo, ...contactInfo },
            visitDuration: record.visitDuration ? parseInt(record.visitDuration) : existingDestination.visitDuration,
            costLevel: record.costLevel ? parseInt(record.costLevel) : existingDestination.costLevel,
            status: record.status || existingDestination.status
          });
          
          destination = existingDestination;
          stats.updated++;
        } else if (!existingDestination) {
          // Create new destination
          destination = await Destination.create({
            name: record.name,
            description: record.description || '',
            location,
            address,
            contactInfo,
            visitDuration: record.visitDuration ? parseInt(record.visitDuration) : 60,
            costLevel: record.costLevel ? parseInt(record.costLevel) : 3,
            status: 'active'
          });
          
          stats.created++;
        } else {
          // Skip if exists and update not enabled
          stats.skipped++;
          continue;
        }
        
        // Associate with categories if provided
        if (categoryIds.length > 0) {
          // Remove existing associations if updating
          if (existingDestination && options.update) {
            await sequelize.query(`
              DELETE FROM destination_categories
              WHERE "destinationId" = '${destination.id}'
            `);
          }
          
          // Create new associations
          for (const categoryId of categoryIds) {
            await sequelize.query(`
              INSERT INTO destination_categories ("destinationId", "categoryId", "createdAt", "updatedAt")
              VALUES ('${destination.id}', '${categoryId}', NOW(), NOW())
            `);
          }
        }
        
        // Add operating hours if provided
        // This requires specific columns in the CSV for each day's hours
        if (record.monday_open && record.monday_close) {
          // Just an example of how hours could be processed from the CSV
          // The actual implementation would depend on your CSV structure
          const hoursData = [];
          
          if (record.monday_open) {
            hoursData.push({
              destinationId: destination.id,
              dayOfWeek: 1,
              openTime: record.monday_open,
              closeTime: record.monday_close
            });
          }
          
          if (record.tuesday_open) {
            hoursData.push({
              destinationId: destination.id,
              dayOfWeek: 2,
              openTime: record.tuesday_open,
              closeTime: record.tuesday_close
            });
          }
          
          // Add similar blocks for other days
          
          if (hoursData.length > 0) {
            // Remove existing hours if updating
            if (existingDestination && options.update) {
              await OperatingHours.destroy({
                where: { destinationId: destination.id }
              });
            }
            
            // Add new hours
            await OperatingHours.bulkCreate(hoursData);
          }
        }
        
        logger.info(`Processed: ${destination.name}`);
      } catch (error) {
        logger.error(`Error processing record: ${JSON.stringify(record)}`, error);
        stats.errors++;
        errors.push({
          record,
          error: error.message
        });
      }
    }
    
    // Report results
    logger.info('Import completed with the following results:');
    logger.info(`Total records: ${stats.total}`);
    logger.info(`Created: ${stats.created}`);
    logger.info(`Updated: ${stats.updated}`);
    logger.info(`Skipped: ${stats.skipped}`);
    logger.info(`Errors: ${stats.errors}`);
    
    // Write errors to file if there are any
    if (errors.length > 0) {
      const errorFile = `import-errors-${new Date().toISOString().replace(/:/g, '-')}.json`;
      fs.writeFileSync(errorFile, JSON.stringify(errors, null, 2));
      logger.info(`Error details written to ${errorFile}`);
    }
    
    return stats;
  } catch (error) {
    logger.error('Import failed:', error);
    throw error;
  } finally {
    // Close database connection
    try {
      await sequelize.close();
    } catch (error) {
      // Ignore close errors
    }
  }
}

// Function to geocode addresses in CSV
async function geocodeAddresses(filePath, outputPath) {
  // This would call an external geocoding service like Google Maps, Mapbox, etc.
  // Example implementation left as a future enhancement
  logger.info('Geocoding functionality requires integration with external geocoding API');
  return filePath;
}

// Run import if executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const filePath = args[0];
  const update = args.includes('--update');
  
  if (!filePath) {
    console.error('Please provide a CSV file path');
    process.exit(1);
  }
  
  importFromCSV(filePath, { update })
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Import failed:', error);
      process.exit(1);
    });
}

module.exports = {
  importFromCSV,
  geocodeAddresses
};
