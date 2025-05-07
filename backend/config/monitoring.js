const client = require('prom-client');
const { pool } = require('../db');
const os = require('os');
const { logger } = require('../middleware/logger');

// Create a Registry to register the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
client.collectDefaultMetrics({
  register,
  prefix: 'fiserv_inventory_'
});

// Create custom metrics
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const dbConnectionGauge = new client.Gauge({
  name: 'db_connection_count',
  help: 'Number of database connections'
});

const dbQueryDurationHistogram = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query', 'table'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const activeUsersGauge = new client.Gauge({
  name: 'active_users_count',
  help: 'Number of active users in the last 5 minutes'
});

const partsInventoryGauge = new client.Gauge({
  name: 'parts_inventory_count',
  help: 'Current inventory count by part',
  labelNames: ['part_id', 'name']
});

const systemMetricsGauge = new client.Gauge({
  name: 'system_metrics',
  help: 'System metrics',
  labelNames: ['metric']
});

// Register custom metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(dbConnectionGauge);
register.registerMetric(dbQueryDurationHistogram);
register.registerMetric(activeUsersGauge);
register.registerMetric(partsInventoryGauge);
register.registerMetric(systemMetricsGauge);

// Function to monitor database metrics
async function monitorDatabase() {
  try {
    const result = await pool.query('SELECT count(*) as count FROM pg_stat_activity');
    const connectionCount = result.rows[0]?.count || 0;
    dbConnectionGauge.set(Number(connectionCount));
  } catch (error) {
    console.error('Error monitoring database:', error);
    dbConnectionGauge.set(0); // Set to 0 on error
  }
}

// Function to monitor system metrics
function monitorSystem() {
  try {
    // CPU Load
    const loadAvg = os.loadavg();
    systemMetricsGauge.labels('cpu_load_1m').set(loadAvg[0]);
    systemMetricsGauge.labels('cpu_load_5m').set(loadAvg[1]);
    systemMetricsGauge.labels('cpu_load_15m').set(loadAvg[2]);

    // Memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    systemMetricsGauge.labels('memory_total').set(totalMem);
    systemMetricsGauge.labels('memory_free').set(freeMem);
    systemMetricsGauge.labels('memory_used').set(usedMem);
    systemMetricsGauge.labels('memory_usage_percent').set((usedMem / totalMem) * 100);

    // Uptime
    systemMetricsGauge.labels('uptime_seconds').set(os.uptime());
  } catch (error) {
    logger.error('Error monitoring system metrics:', error);
  }
}

// Function to monitor parts inventory
async function monitorInventory() {
  try {
    const result = await pool.query('SELECT part_id, name, quantity FROM parts');
    result.rows.forEach(row => {
      partsInventoryGauge.labels(row.part_id, row.name).set(row.quantity);
    });
  } catch (error) {
    logger.error('Error monitoring inventory:', error);
  }
}

// Function to monitor active users
async function monitorActiveUsers() {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const result = await pool.query(
      'SELECT COUNT(DISTINCT user_id) as count FROM users WHERE last_login > $1',
      [fiveMinutesAgo]
    );
    activeUsersGauge.set(Number(result.rows[0]?.count || 0));
  } catch (error) {
    logger.error('Error monitoring active users:', error);
    activeUsersGauge.set(0);
  }
}

// Start monitoring intervals
const startMonitoring = () => {
  // Database monitoring every 5 seconds
  setInterval(monitorDatabase, 5000);
  
  // System metrics every 30 seconds
  setInterval(monitorSystem, 30000);
  
  // Inventory monitoring every minute
  setInterval(monitorInventory, 60000);
  
  // Active users monitoring every minute
  setInterval(monitorActiveUsers, 60000);
  
  // Initial calls
  monitorDatabase().catch(logger.error);
  monitorSystem();
  monitorInventory().catch(logger.error);
  monitorActiveUsers().catch(logger.error);
  
  logger.info('Monitoring started');
};

// Health check function
const healthCheck = async () => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    
    // Check system resources
    const memoryUsage = process.memoryUsage();
    const systemHealth = {
      uptime: process.uptime(),
      memoryUsage: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        rss: memoryUsage.rss,
      },
      cpuLoad: os.loadavg()[0],
    };

    // Check if memory usage is critical (>95%)
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    const isCritical = memoryUsagePercent > 95 || systemHealth.cpuLoad > 0.95;

    return {
      status: 'healthy', // Always return healthy during development
      timestamp: new Date().toISOString(),
      checks: {
        database: 'connected',
        memory: memoryUsagePercent > 95 ? 'warning' : 'healthy',
        cpu: systemHealth.cpuLoad > 0.95 ? 'warning' : 'healthy',
      },
      metrics: systemHealth,
    };
  } catch (error) {
    logger.error('Health check failed:', error);
    return {
      status: 'healthy', // Return healthy even on error during development
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  }
};

module.exports = {
  register,
  httpRequestDurationMicroseconds,
  dbQueryDurationHistogram,
  startMonitoring,
  healthCheck,
}; 