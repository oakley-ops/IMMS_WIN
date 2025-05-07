const { pool } = require('../db');
const { logger } = require('../middleware/logger');

// Helper function to get a client with timeout
const getClientWithTimeout = async (timeout = 5000) => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, timeout);
  });

  try {
    const client = await Promise.race([pool.connect(), timeoutPromise]);
    return client;
  } catch (error) {
    logger.error('Error getting database client', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

// Helper function to execute a query with retry logic
const executeWithRetry = async (queryText, params, maxRetries = 3) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    const client = await getClientWithTimeout();
    
    try {
      const result = await client.query(queryText, params);
      client.release();
      return result;
    } catch (error) {
      client.release();
      lastError = error;
      
      // Only retry on connection-related errors
      if (!error.code?.startsWith('08') && !error.code?.startsWith('57')) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100));
    }
  }
  
  throw lastError;
};

// Helper function to execute a transaction
const executeTransaction = async (queries) => {
  const client = await getClientWithTimeout();
  
  try {
    await client.query('BEGIN');
    const results = [];
    
    for (const { text, params } of queries) {
      const result = await client.query(text, params);
      results.push(result);
    }
    
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getClientWithTimeout,
  executeWithRetry,
  executeTransaction
}; 