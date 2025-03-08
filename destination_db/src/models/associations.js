function setupAssociations() {
    // Import models
    const Destination = require('./destination');
    const Category = require('./category');
    const OperatingHours = require('./operatingHours');
    const Review = require('./review');
    
    // Ensure all models are loaded
    if (!Destination || !Category || !OperatingHours || !Review) {
      throw new Error('One or more models failed to load for associations');
    }
    
    // Destination to Category (many-to-many)
    Destination.belongsToMany(Category, {
      through: 'destination_categories',
      foreignKey: 'destinationId',
      otherKey: 'categoryId'
    });
    
    Category.belongsToMany(Destination, {
      through: 'destination_categories',
      foreignKey: 'categoryId',
      otherKey: 'destinationId'
    });
    
    // Destination to OperatingHours (one-to-many)
    Destination.hasMany(OperatingHours, {
      foreignKey: 'destinationId',
      as: 'operatingHours'
    });
    
    OperatingHours.belongsTo(Destination, {
      foreignKey: 'destinationId'
    });
    
    // Destination to Review (one-to-many)
    Destination.hasMany(Review, {
      foreignKey: 'destinationId',
      as: 'reviews'
    });
    
    Review.belongsTo(Destination, {
      foreignKey: 'destinationId'
    });
    
    // Self-association for Category (parent-child hierarchy)
    // The error was because we defined this relationship twice - once in the model and once here
    // We'll define it only here for clarity
    Category.hasMany(Category, {
      foreignKey: 'parentId',
      as: 'childCategories'  // Changed from 'subcategories' to avoid conflict
    });
    
    Category.belongsTo(Category, {
      foreignKey: 'parentId',
      as: 'parentCategory'  // Changed from 'parent' for consistency
    });
    
    console.log("Associations set up successfully");
  }
  
  module.exports = setupAssociations;