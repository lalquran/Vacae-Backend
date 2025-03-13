const logger = require('./logger');

// Simple in-memory metrics collection
const metrics = {
  recommendations: {
    generated: 0,
    accepted: 0,
    rejected: 0,
    completed: 0
  },
  response_times: [],
  errors: {
    count: 0,
    types: {}
  }
};

// Increment a counter metric
const incrementCounter = (category, metric, value = 1) => {
  if (metrics[category] && typeof metrics[category][metric] === 'number') {
    metrics[category][metric] += value;
    return true;
  }
  return false;
};

// Record a response time
const recordResponseTime = (timeMs) => {
  metrics.response_times.push(timeMs);
  
  // Keep only the last 1000 response times
  if (metrics.response_times.length > 1000) {
    metrics.response_times.shift();
  }
};

// Record an error
const recordError = (errorType) => {
  metrics.errors.count++;
  metrics.errors.types[errorType] = (metrics.errors.types[errorType] || 0) + 1;
};

// Calculate average response time
const getAverageResponseTime = () => {
  if (metrics.response_times.length === 0) return 0;
  
  const sum = metrics.response_times.reduce((a, b) => a + b, 0);
  return sum / metrics.response_times.length;
};

// Get recommendation acceptance rate
const getRecommendationAcceptanceRate = () => {
  const total = metrics.recommendations.accepted + metrics.recommendations.rejected;
  if (total === 0) return 0;
  
  return (metrics.recommendations.accepted / total) * 100;
};

// Get all metrics
const getAllMetrics = () => {
  return {
    ...metrics,
    avg_response_time_ms: getAverageResponseTime(),
    recommendation_acceptance_rate: getRecommendationAcceptanceRate()
  };
};

// Reset metrics (e.g., for testing)
const resetMetrics = () => {
  metrics.recommendations.generated = 0;
  metrics.recommendations.accepted = 0;
  metrics.recommendations.rejected = 0;
  metrics.recommendations.completed = 0;
  metrics.response_times = [];
  metrics.errors.count = 0;
  metrics.errors.types = {};
};

module.exports = {
  incrementCounter,
  recordResponseTime,
  recordError,
  getAverageResponseTime,
  getRecommendationAcceptanceRate,
  getAllMetrics,
  resetMetrics
};