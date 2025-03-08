  /**
   * Format date to ISO string without milliseconds
   * @param {Date} date - Date to format
   * @returns {string} Formatted date string
   */
  exports.formatDate = (date) => {
    return date.toISOString().split('.')[0] + 'Z';
  };
  
  /**
   * Calculate time difference in minutes between two time strings
   * @param {string} time1 - First time in format "HH:MM"
   * @param {string} time2 - Second time in format "HH:MM"
   * @returns {number} Difference in minutes
   */
  exports.calculateTimeDifference = (time1, time2) => {
    const [hours1, minutes1] = time1.split(':').map(Number);
    const [hours2, minutes2] = time2.split(':').map(Number);
    
    const totalMinutes1 = hours1 * 60 + minutes1;
    const totalMinutes2 = hours2 * 60 + minutes2;
    
    return Math.abs(totalMinutes2 - totalMinutes1);
  };
  
  /**
   * Generate a random password of specified length
   * @param {number} length - Length of password
   * @returns {string} Random password
   */
  exports.generateRandomPassword = (length = 12) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };
  
  /**
   * Mask email for privacy
   * @param {string} email - Email to mask
   * @returns {string} Masked email
   */
  exports.maskEmail = (email) => {
    const [username, domain] = email.split('@');
    const maskedUsername = username.charAt(0) + 
      '*'.repeat(Math.max(1, username.length - 2)) + 
      username.charAt(username.length - 1);
    return `${maskedUsername}@${domain}`;
  };
  
  /**
   * Paginate array results
   * @param {Array} items - Items to paginate
   * @param {number} page - Page number (1-based)
   * @param {number} perPage - Items per page
   * @returns {Object} Paginated results
   */
  exports.paginateResults = (items, page = 1, perPage = 10) => {
    const offset = (page - 1) * perPage;
    const paginatedItems = items.slice(offset, offset + perPage);
    
    return {
      page,
      perPage,
      total: items.length,
      totalPages: Math.ceil(items.length / perPage),
      data: paginatedItems
    };
  };
  