const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');
const { generateAnalyticsReportPDF } = require('../utils/analyticsReportGenerator');
const { generatePuppeteerAnalyticsPDF } = require('../utils/puppeteerPdfGenerator');

/**
 * @route GET /api/v1/analytics/inventory-health
 * @desc Get inventory health metrics
 * @access Private
 */
router.get('/inventory-health', auth, async (req, res) => {
  try {
    console.log('Fetching inventory health analytics...');

    // Calculate average turnover rate and stock coverage
    const overallMetrics = await db.query(`
      SELECT 
        AVG(turnover_rate) as average_turnover_rate,
        AVG(coverage_days) as stock_coverage_days
      FROM (
        SELECT 
          p.part_id,
          CASE 
            WHEN p.quantity > 0 AND p.minimum_quantity > 0 
            THEN (p.quantity::float / NULLIF(p.minimum_quantity, 0))
            ELSE 0 
          END as turnover_rate,
          CASE 
            WHEN daily_usage.avg_daily > 0 
            THEN p.quantity / daily_usage.avg_daily
            ELSE 999
          END as coverage_days
        FROM parts p
        LEFT JOIN (
          SELECT 
            part_id,
            AVG(quantity) as avg_daily
          FROM transactions
          WHERE type IN ('usage', 'OUT')
            AND created_at >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY part_id
        ) daily_usage ON p.part_id = daily_usage.part_id
        WHERE p.status = 'active'
          AND p.quantity >= 0
      ) stats
    `);

    // Get high risk parts - parts with low stock and high usage
    const highRiskParts = await db.query(`
      WITH daily_usage AS (
        SELECT 
          p.part_id,
          p.name,
          p.quantity,
          p.minimum_quantity,
          COALESCE(AVG(
            CASE 
              WHEN t.type IN ('usage', 'OUT') THEN t.quantity 
              ELSE 0 
            END
          ), 0) as avg_daily_usage,
          COUNT(DISTINCT DATE(t.created_at)) as active_days
        FROM parts p
        LEFT JOIN transactions t ON p.part_id = t.part_id
          AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
          AND t.type IN ('usage', 'OUT')
        WHERE p.status = 'active'
        GROUP BY p.part_id, p.name, p.quantity, p.minimum_quantity
      ),
      risk_calculation AS (
        SELECT 
          part_id,
          name,
          quantity,
          minimum_quantity,
          avg_daily_usage,
          CASE 
            WHEN avg_daily_usage > 0 THEN quantity / avg_daily_usage
            ELSE 999999
          END as days_until_stockout,
          CASE 
            WHEN avg_daily_usage = 0 THEN 0
            WHEN quantity = 0 THEN 1.0
            WHEN quantity / NULLIF(avg_daily_usage, 0) < 7 THEN 0.9
            WHEN quantity / NULLIF(avg_daily_usage, 0) < 14 THEN 0.8
            WHEN quantity / NULLIF(avg_daily_usage, 0) < 30 THEN 0.6
            ELSE 0.3
          END as risk_score
        FROM daily_usage
      )
      SELECT 
        part_id,
        name,
        ROUND(risk_score::numeric, 2) as risk_score,
        ROUND(days_until_stockout::numeric, 1) as days_until_stockout,
        quantity as current_quantity,
        minimum_quantity,
        ROUND(avg_daily_usage::numeric, 2) as avg_daily_usage
      FROM risk_calculation
      WHERE risk_score > 0.5
      ORDER BY risk_score DESC, days_until_stockout ASC
      LIMIT 10
    `);

    const result = {
      average_turnover_rate: parseFloat(overallMetrics.rows[0]?.average_turnover_rate || 0).toFixed(2),
      stock_coverage_days: parseInt(overallMetrics.rows[0]?.stock_coverage_days || 0),
      high_risk_parts: highRiskParts.rows.map(part => ({
        part_id: part.part_id,
        name: part.name,
        risk_score: parseFloat(part.risk_score),
        days_until_stockout: parseFloat(part.days_until_stockout),
        current_quantity: part.current_quantity,
        minimum_quantity: part.minimum_quantity,
        avg_daily_usage: parseFloat(part.avg_daily_usage)
      }))
    };

    console.log('Inventory health analytics computed:', {
      turnover: result.average_turnover_rate,
      coverage: result.stock_coverage_days,
      high_risk_count: result.high_risk_parts.length
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching inventory health:', error);
    res.status(500).json({ 
      error: 'Failed to fetch inventory health analytics',
      details: error.message 
    });
  }
});

/**
 * @route GET /api/v1/analytics/usage-patterns
 * @desc Get usage pattern analytics
 * @access Private
 */
router.get('/usage-patterns', auth, async (req, res) => {
  try {
    console.log('Fetching usage pattern analytics...');

    // Get fastest moving parts with trend analysis
    const fastestMovingParts = await db.query(`
      WITH weekly_usage AS (
        SELECT 
          p.part_id,
          p.name,
          DATE_TRUNC('week', t.created_at) as week,
          SUM(CASE WHEN t.type IN ('usage', 'OUT') THEN t.quantity ELSE 0 END) as weekly_usage
        FROM parts p
        JOIN transactions t ON p.part_id = t.part_id
        WHERE t.created_at >= CURRENT_DATE - INTERVAL '60 days'
          AND p.status = 'active'
          AND t.type IN ('usage', 'OUT')
        GROUP BY p.part_id, p.name, DATE_TRUNC('week', t.created_at)
      ),
      trend_calculation AS (
        SELECT 
          part_id,
          name,
          COUNT(*) as week_count,
          AVG(weekly_usage) as avg_weekly_usage,
          CASE 
            WHEN COUNT(*) >= 2 THEN
              (MAX(weekly_usage) - MIN(weekly_usage))::float / NULLIF(MIN(weekly_usage), 0) * 100
            ELSE 0
          END as trend_percentage
        FROM weekly_usage
        GROUP BY part_id, name
        HAVING COUNT(*) >= 2
      ),
      last_30_days_usage AS (
        SELECT 
          part_id,
          SUM(quantity) as usage_last_30_days
        FROM transactions
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
          AND type IN ('usage', 'OUT')
        GROUP BY part_id
      )
      SELECT 
        tc.part_id,
        tc.name,
        ROUND(tc.trend_percentage::numeric, 2) as trend,
        COALESCE(lu.usage_last_30_days, 0) as usage_last_30_days,
        ROUND(tc.avg_weekly_usage::numeric, 2) as avg_weekly_usage
      FROM trend_calculation tc
      LEFT JOIN last_30_days_usage lu ON tc.part_id = lu.part_id
      WHERE COALESCE(lu.usage_last_30_days, 0) > 0
      ORDER BY lu.usage_last_30_days DESC, tc.trend_percentage DESC
      LIMIT 10
    `);

    // Get usage velocity (parts used most frequently)
    const usageVelocity = await db.query(`
      SELECT 
        p.part_id,
        p.name,
        COUNT(t.transaction_id) as usage_frequency,
        SUM(t.quantity) as total_quantity
      FROM parts p
      JOIN transactions t ON p.part_id = t.part_id
      WHERE t.type IN ('usage', 'OUT')
        AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND p.status = 'active'
      GROUP BY p.part_id, p.name
      ORDER BY usage_frequency DESC
      LIMIT 5
    `);

    const result = {
      fastest_moving_parts: fastestMovingParts.rows.map(part => ({
        part_id: part.part_id,
        name: part.name,
        trend: parseFloat(part.trend || 0),
        usage_last_30_days: parseInt(part.usage_last_30_days),
        avg_weekly_usage: parseFloat(part.avg_weekly_usage || 0)
      })),
      high_velocity_parts: usageVelocity.rows.map(part => ({
        part_id: part.part_id,
        name: part.name,
        usage_frequency: parseInt(part.usage_frequency),
        total_quantity: parseInt(part.total_quantity)
      }))
    };

    console.log('Usage pattern analytics computed:', {
      fastest_moving_count: result.fastest_moving_parts.length,
      high_velocity_count: result.high_velocity_parts.length
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching usage patterns:', error);
    res.status(500).json({ 
      error: 'Failed to fetch usage pattern analytics',
      details: error.message 
    });
  }
});

/**
 * @route GET /api/v1/analytics/cost-analysis
 * @desc Get cost analysis metrics
 * @access Private
 */
router.get('/cost-analysis', auth, async (req, res) => {
  try {
    console.log('Fetching cost analysis...');

    // Calculate total inventory value and average cost
    const inventoryValue = await db.query(`
      SELECT 
        SUM(p.quantity * COALESCE(p.unit_cost, 0)) as total_value,
        AVG(COALESCE(p.unit_cost, 0)) as avg_cost,
        COUNT(*) as total_parts,
        COUNT(*) FILTER (WHERE p.unit_cost > 0) as parts_with_cost
      FROM parts p
      WHERE p.status = 'active'
    `);

    // Get highest value parts (by total value = quantity * unit_cost)
    const highValueParts = await db.query(`
      SELECT 
        p.part_id,
        p.name,
        p.quantity,
        COALESCE(p.unit_cost, 0) as unit_cost,
        (p.quantity * COALESCE(p.unit_cost, 0)) as total_value,
        p.manufacturer_part_number
      FROM parts p
      WHERE p.status = 'active'
        AND p.unit_cost > 0
        AND p.quantity > 0
      ORDER BY total_value DESC
      LIMIT 10
    `);

    // Get monthly cost trends (cost of parts used per month)
    const costTrends = await db.query(`
      SELECT 
        TO_CHAR(t.created_at, 'YYYY-MM') as month,
        SUM(t.quantity * COALESCE(p.unit_cost, 0)) as month_cost,
        COUNT(DISTINCT t.part_id) as unique_parts,
        SUM(t.quantity) as total_quantity
      FROM transactions t
      JOIN parts p ON t.part_id = p.part_id
      WHERE t.type IN ('usage', 'OUT')
        AND t.created_at >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY TO_CHAR(t.created_at, 'YYYY-MM')
      ORDER BY month ASC
    `);

    // Calculate cost by category (top machines by cost)
    const costByMachine = await db.query(`
      SELECT 
        m.machine_id,
        m.name as machine_name,
        SUM(t.quantity * COALESCE(p.unit_cost, 0)) as total_cost,
        COUNT(DISTINCT t.part_id) as unique_parts
      FROM transactions t
      JOIN parts p ON t.part_id = p.part_id
      LEFT JOIN machines m ON p.machine_id = m.machine_id
      WHERE t.type IN ('usage', 'OUT')
        AND t.created_at >= CURRENT_DATE - INTERVAL '90 days'
        AND m.machine_id IS NOT NULL
      GROUP BY m.machine_id, m.name
      ORDER BY total_cost DESC
      LIMIT 5
    `);

    const result = {
      total_inventory_value: parseFloat(inventoryValue.rows[0]?.total_value || 0).toFixed(2),
      average_part_cost: parseFloat(inventoryValue.rows[0]?.avg_cost || 0).toFixed(2),
      total_parts: parseInt(inventoryValue.rows[0]?.total_parts || 0),
      parts_with_cost: parseInt(inventoryValue.rows[0]?.parts_with_cost || 0),
      highest_value_parts: highValueParts.rows.map(part => ({
        part_id: part.part_id,
        name: part.name,
        total_value: parseFloat(part.total_value).toFixed(2),
        quantity: part.quantity,
        unit_cost: parseFloat(part.unit_cost).toFixed(2),
        manufacturer_part_number: part.manufacturer_part_number
      })),
      cost_trends: costTrends.rows.map(trend => ({
        month: trend.month,
        month_cost: parseFloat(trend.month_cost || 0).toFixed(2),
        unique_parts: parseInt(trend.unique_parts),
        total_quantity: parseInt(trend.total_quantity)
      })),
      cost_by_machine: costByMachine.rows.map(machine => ({
        machine_id: machine.machine_id,
        machine_name: machine.machine_name,
        total_cost: parseFloat(machine.total_cost || 0).toFixed(2),
        unique_parts: parseInt(machine.unique_parts)
      }))
    };

    console.log('Cost analysis computed:', {
      total_value: result.total_inventory_value,
      avg_cost: result.average_part_cost,
      high_value_parts: result.highest_value_parts.length,
      cost_trends_months: result.cost_trends.length
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching cost analysis:', error);
    res.status(500).json({ 
      error: 'Failed to fetch cost analysis',
      details: error.message 
    });
  }
});

/**
 * @route GET /api/v1/analytics/summary
 * @desc Get all analytics in one call (lighter version for overview)
 * @access Private
 */
router.get('/summary', auth, async (req, res) => {
  try {
    console.log('Fetching analytics summary...');

    // Make parallel requests to all analytics endpoints
    const [inventoryHealth, usagePatterns, costAnalysis] = await Promise.all([
      db.query(`
        SELECT 
          AVG(turnover_rate) as average_turnover_rate,
          AVG(coverage_days) as stock_coverage_days
        FROM (
          SELECT 
            CASE 
              WHEN p.quantity > 0 AND p.minimum_quantity > 0 
              THEN (p.quantity::float / NULLIF(p.minimum_quantity, 0))
              ELSE 0 
            END as turnover_rate,
            CASE 
              WHEN daily_usage.avg_daily > 0 
              THEN p.quantity / daily_usage.avg_daily
              ELSE 999
            END as coverage_days
          FROM parts p
          LEFT JOIN (
            SELECT part_id, AVG(quantity) as avg_daily
            FROM transactions
            WHERE type IN ('usage', 'OUT') 
              AND created_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY part_id
          ) daily_usage ON p.part_id = daily_usage.part_id
          WHERE p.status = 'active'
        ) stats
      `),
      db.query(`
        SELECT COUNT(*) as fastest_moving_count
        FROM (
          SELECT part_id, SUM(quantity) as total
          FROM transactions
          WHERE type IN ('usage', 'OUT')
            AND created_at >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY part_id
          ORDER BY total DESC
          LIMIT 10
        ) top_parts
      `),
      db.query(`
        SELECT 
          SUM(quantity * COALESCE(unit_cost, 0)) as total_value,
          AVG(COALESCE(unit_cost, 0)) as avg_cost
        FROM parts
        WHERE status = 'active'
      `)
    ]);

    res.json({
      inventory_health: {
        average_turnover_rate: parseFloat(inventoryHealth.rows[0]?.average_turnover_rate || 0).toFixed(2),
        stock_coverage_days: parseInt(inventoryHealth.rows[0]?.stock_coverage_days || 0)
      },
      usage_patterns: {
        fastest_moving_count: parseInt(usagePatterns.rows[0]?.fastest_moving_count || 0)
      },
      cost_analysis: {
        total_inventory_value: parseFloat(costAnalysis.rows[0]?.total_value || 0).toFixed(2),
        average_part_cost: parseFloat(costAnalysis.rows[0]?.avg_cost || 0).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    res.status(500).json({ 
      error: 'Failed to fetch analytics summary',
      details: error.message 
    });
  }
});

/**
 * @route GET /api/v1/analytics/export/pdf
 * @desc Export analytics report as PDF
 * @access Private
 */
router.get('/export/pdf', auth, async (req, res) => {
  try {
    console.log('Generating PDF analytics report...');

    // Fetch all analytics data
    const [inventoryHealthReq, usagePatternsReq, costAnalysisReq] = await Promise.all([
      // Inventory Health
      db.query(`
        SELECT 
          AVG(turnover_rate) as average_turnover_rate,
          AVG(coverage_days) as stock_coverage_days
        FROM (
          SELECT 
            CASE 
              WHEN p.quantity > 0 AND p.minimum_quantity > 0 
              THEN (p.quantity::float / NULLIF(p.minimum_quantity, 0))
              ELSE 0 
            END as turnover_rate,
            CASE 
              WHEN daily_usage.avg_daily > 0 
              THEN p.quantity / daily_usage.avg_daily
              ELSE 999
            END as coverage_days
          FROM parts p
          LEFT JOIN (
            SELECT part_id, AVG(quantity) as avg_daily
            FROM transactions
            WHERE type IN ('usage', 'OUT') 
              AND created_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY part_id
          ) daily_usage ON p.part_id = daily_usage.part_id
          WHERE p.status = 'active'
        ) stats
      `).then(result => ({
        average_turnover_rate: parseFloat(result.rows[0]?.average_turnover_rate || 0).toFixed(2),
        stock_coverage_days: parseInt(result.rows[0]?.stock_coverage_days || 0)
      })),

      // Usage Patterns - Fastest Moving
      db.query(`
        WITH weekly_usage AS (
          SELECT 
            p.part_id,
            p.name,
            DATE_TRUNC('week', t.created_at) as week,
            SUM(CASE WHEN t.type IN ('usage', 'OUT') THEN t.quantity ELSE 0 END) as weekly_usage
          FROM parts p
          JOIN transactions t ON p.part_id = t.part_id
          WHERE t.created_at >= CURRENT_DATE - INTERVAL '60 days'
            AND p.status = 'active'
            AND t.type IN ('usage', 'OUT')
          GROUP BY p.part_id, p.name, DATE_TRUNC('week', t.created_at)
        ),
        trend_calculation AS (
          SELECT 
            part_id,
            name,
            AVG(weekly_usage) as avg_weekly_usage,
            CASE 
              WHEN COUNT(*) >= 2 THEN
                (MAX(weekly_usage) - MIN(weekly_usage))::float / NULLIF(MIN(weekly_usage), 0) * 100
              ELSE 0
            END as trend_percentage
          FROM weekly_usage
          GROUP BY part_id, name
          HAVING COUNT(*) >= 2
        ),
        last_30_days_usage AS (
          SELECT 
            part_id,
            SUM(quantity) as usage_last_30_days
          FROM transactions
          WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND type IN ('usage', 'OUT')
          GROUP BY part_id
        )
        SELECT 
          tc.part_id,
          tc.name,
          ROUND(tc.trend_percentage::numeric, 2) as trend,
          COALESCE(lu.usage_last_30_days, 0) as usage_last_30_days,
          ROUND(tc.avg_weekly_usage::numeric, 2) as avg_weekly_usage
        FROM trend_calculation tc
        LEFT JOIN last_30_days_usage lu ON tc.part_id = lu.part_id
        WHERE COALESCE(lu.usage_last_30_days, 0) > 0
        ORDER BY lu.usage_last_30_days DESC
        LIMIT 10
      `).then(result => result.rows),

      // Cost Analysis
      db.query(`
        SELECT 
          SUM(p.quantity * COALESCE(p.unit_cost, 0)) as total_value,
          AVG(COALESCE(p.unit_cost, 0)) as avg_cost,
          COUNT(*) as total_parts,
          COUNT(*) FILTER (WHERE p.unit_cost > 0) as parts_with_cost
        FROM parts p
        WHERE p.status = 'active'
      `).then(result => ({
        total_inventory_value: parseFloat(result.rows[0]?.total_value || 0).toFixed(2),
        average_part_cost: parseFloat(result.rows[0]?.avg_cost || 0).toFixed(2),
        total_parts: parseInt(result.rows[0]?.total_parts || 0),
        parts_with_cost: parseInt(result.rows[0]?.parts_with_cost || 0)
      }))
    ]);

    // Get high risk parts
    const highRiskParts = await db.query(`
      WITH daily_usage AS (
        SELECT 
          p.part_id,
          p.name,
          p.quantity,
          p.minimum_quantity,
          COALESCE(AVG(
            CASE WHEN t.type IN ('usage', 'OUT') THEN t.quantity ELSE 0 END
          ), 0) as avg_daily_usage
        FROM parts p
        LEFT JOIN transactions t ON p.part_id = t.part_id
          AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
          AND t.type IN ('usage', 'OUT')
        WHERE p.status = 'active'
        GROUP BY p.part_id, p.name, p.quantity, p.minimum_quantity
      ),
      risk_calculation AS (
        SELECT 
          part_id,
          name,
          quantity,
          minimum_quantity,
          avg_daily_usage,
          CASE 
            WHEN avg_daily_usage > 0 THEN quantity / avg_daily_usage
            ELSE 999999
          END as days_until_stockout,
          CASE 
            WHEN avg_daily_usage = 0 THEN 0
            WHEN quantity = 0 THEN 1.0
            WHEN quantity / NULLIF(avg_daily_usage, 0) < 7 THEN 0.9
            WHEN quantity / NULLIF(avg_daily_usage, 0) < 14 THEN 0.8
            WHEN quantity / NULLIF(avg_daily_usage, 0) < 30 THEN 0.6
            ELSE 0.3
          END as risk_score
        FROM daily_usage
      )
      SELECT 
        part_id,
        name,
        ROUND(risk_score::numeric, 2) as risk_score,
        ROUND(days_until_stockout::numeric, 1) as days_until_stockout,
        quantity as current_quantity
      FROM risk_calculation
      WHERE risk_score > 0.5
      ORDER BY risk_score DESC, days_until_stockout ASC
      LIMIT 10
    `);

    // Get high velocity parts
    const highVelocityParts = await db.query(`
      SELECT 
        p.part_id,
        p.name,
        COUNT(t.transaction_id) as usage_frequency,
        SUM(t.quantity) as total_quantity
      FROM parts p
      JOIN transactions t ON p.part_id = t.part_id
      WHERE t.type IN ('usage', 'OUT')
        AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND p.status = 'active'
      GROUP BY p.part_id, p.name
      ORDER BY usage_frequency DESC
      LIMIT 5
    `);

    // Get highest value parts
    const highestValueParts = await db.query(`
      SELECT 
        p.part_id,
        p.name,
        p.quantity,
        COALESCE(p.unit_cost, 0) as unit_cost,
        (p.quantity * COALESCE(p.unit_cost, 0)) as total_value
      FROM parts p
      WHERE p.status = 'active'
        AND p.unit_cost > 0
        AND p.quantity > 0
      ORDER BY total_value DESC
      LIMIT 10
    `);

    // Compile analytics data
    const analyticsData = {
      inventoryHealth: {
        ...inventoryHealthReq,
        high_risk_parts: highRiskParts.rows.map(part => ({
          ...part,
          risk_score: parseFloat(part.risk_score),
          days_until_stockout: parseFloat(part.days_until_stockout)
        }))
      },
      usagePatterns: {
        fastest_moving_parts: usagePatternsReq.map(part => ({
          ...part,
          trend: parseFloat(part.trend),
          usage_last_30_days: parseInt(part.usage_last_30_days),
          avg_weekly_usage: parseFloat(part.avg_weekly_usage || 0)
        })),
        high_velocity_parts: highVelocityParts.rows.map(part => ({
          ...part,
          usage_frequency: parseInt(part.usage_frequency),
          total_quantity: parseInt(part.total_quantity)
        }))
      },
      costAnalysis: {
        ...costAnalysisReq,
        highest_value_parts: highestValueParts.rows.map(part => ({
          ...part,
          total_value: parseFloat(part.total_value).toFixed(2),
          unit_cost: parseFloat(part.unit_cost).toFixed(2)
        }))
      }
    };

    // Generate PDF
    const pdfBuffer = await generateAnalyticsReportPDF(analyticsData);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="analytics-report-${new Date().toISOString().split('T')[0]}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.send(pdfBuffer);

    console.log('PDF analytics report generated successfully');
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ 
      error: 'Failed to generate PDF report',
      details: error.message 
    });
  }
});

/**
 * @route GET /api/v1/analytics/export/pdf-puppeteer
 * @desc Export analytics report as PDF using Puppeteer (Chrome rendering)
 * @access Private
 */
router.get('/export/pdf-puppeteer', auth, async (req, res) => {
  try {
    console.log('Generating Puppeteer PDF analytics report...');

    // Fetch all analytics data (same as regular PDF endpoint)
    const [inventoryHealthReq, usagePatternsReq, costAnalysisReq] = await Promise.all([
      // Inventory Health
      db.query(`
        SELECT 
          AVG(turnover_rate) as average_turnover_rate,
          AVG(coverage_days) as stock_coverage_days
        FROM (
          SELECT 
            CASE 
              WHEN p.quantity > 0 AND p.minimum_quantity > 0 
              THEN (p.quantity::float / NULLIF(p.minimum_quantity, 0))
              ELSE 0 
            END as turnover_rate,
            CASE 
              WHEN daily_usage.avg_daily > 0 
              THEN p.quantity / daily_usage.avg_daily
              ELSE 999
            END as coverage_days
          FROM parts p
          LEFT JOIN (
            SELECT part_id, AVG(quantity) as avg_daily
            FROM transactions
            WHERE type IN ('usage', 'OUT') 
              AND created_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY part_id
          ) daily_usage ON p.part_id = daily_usage.part_id
          WHERE p.status = 'active'
        ) stats
      `).then(result => ({
        average_turnover_rate: parseFloat(result.rows[0]?.average_turnover_rate || 0).toFixed(2),
        stock_coverage_days: parseInt(result.rows[0]?.stock_coverage_days || 0)
      })),

      // Usage Patterns - Fastest Moving
      db.query(`
        WITH weekly_usage AS (
          SELECT 
            p.part_id,
            p.name,
            DATE_TRUNC('week', t.created_at) as week,
            SUM(CASE WHEN t.type IN ('usage', 'OUT') THEN t.quantity ELSE 0 END) as weekly_usage
          FROM parts p
          JOIN transactions t ON p.part_id = t.part_id
          WHERE t.created_at >= CURRENT_DATE - INTERVAL '60 days'
            AND p.status = 'active'
            AND t.type IN ('usage', 'OUT')
          GROUP BY p.part_id, p.name, DATE_TRUNC('week', t.created_at)
        ),
        trend_calculation AS (
          SELECT 
            part_id,
            name,
            AVG(weekly_usage) as avg_weekly_usage,
            CASE 
              WHEN COUNT(*) >= 2 THEN
                (MAX(weekly_usage) - MIN(weekly_usage))::float / NULLIF(MIN(weekly_usage), 0) * 100
              ELSE 0
            END as trend_percentage
          FROM weekly_usage
          GROUP BY part_id, name
          HAVING COUNT(*) >= 2
        ),
        last_30_days_usage AS (
          SELECT 
            part_id,
            SUM(quantity) as usage_last_30_days
          FROM transactions
          WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND type IN ('usage', 'OUT')
          GROUP BY part_id
        )
        SELECT 
          tc.part_id,
          tc.name,
          ROUND(tc.trend_percentage::numeric, 2) as trend,
          COALESCE(lu.usage_last_30_days, 0) as usage_last_30_days,
          ROUND(tc.avg_weekly_usage::numeric, 2) as avg_weekly_usage
        FROM trend_calculation tc
        LEFT JOIN last_30_days_usage lu ON tc.part_id = lu.part_id
        WHERE COALESCE(lu.usage_last_30_days, 0) > 0
        ORDER BY lu.usage_last_30_days DESC
        LIMIT 10
      `).then(result => result.rows),

      // Cost Analysis
      db.query(`
        SELECT 
          SUM(p.quantity * COALESCE(p.unit_cost, 0)) as total_value,
          AVG(COALESCE(p.unit_cost, 0)) as avg_cost,
          COUNT(*) as total_parts,
          COUNT(*) FILTER (WHERE p.unit_cost > 0) as parts_with_cost
        FROM parts p
        WHERE p.status = 'active'
      `).then(result => ({
        total_inventory_value: parseFloat(result.rows[0]?.total_value || 0).toFixed(2),
        average_part_cost: parseFloat(result.rows[0]?.avg_cost || 0).toFixed(2),
        total_parts: parseInt(result.rows[0]?.total_parts || 0),
        parts_with_cost: parseInt(result.rows[0]?.parts_with_cost || 0)
      }))
    ]);

    // Get high risk parts
    const highRiskParts = await db.query(`
      WITH daily_usage AS (
        SELECT 
          p.part_id,
          p.name,
          p.quantity,
          p.minimum_quantity,
          COALESCE(AVG(
            CASE WHEN t.type IN ('usage', 'OUT') THEN t.quantity ELSE 0 END
          ), 0) as avg_daily_usage
        FROM parts p
        LEFT JOIN transactions t ON p.part_id = t.part_id
          AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
          AND t.type IN ('usage', 'OUT')
        WHERE p.status = 'active'
        GROUP BY p.part_id, p.name, p.quantity, p.minimum_quantity
      ),
      risk_calculation AS (
        SELECT 
          part_id,
          name,
          quantity,
          minimum_quantity,
          avg_daily_usage,
          CASE 
            WHEN avg_daily_usage > 0 THEN quantity / avg_daily_usage
            ELSE 999999
          END as days_until_stockout,
          CASE 
            WHEN avg_daily_usage = 0 THEN 0
            WHEN quantity = 0 THEN 1.0
            WHEN quantity / NULLIF(avg_daily_usage, 0) < 7 THEN 0.9
            WHEN quantity / NULLIF(avg_daily_usage, 0) < 14 THEN 0.8
            WHEN quantity / NULLIF(avg_daily_usage, 0) < 30 THEN 0.6
            ELSE 0.3
          END as risk_score
        FROM daily_usage
      )
      SELECT 
        part_id,
        name,
        ROUND(risk_score::numeric, 2) as risk_score,
        ROUND(days_until_stockout::numeric, 1) as days_until_stockout,
        quantity as current_quantity
      FROM risk_calculation
      WHERE risk_score > 0.5
      ORDER BY risk_score DESC, days_until_stockout ASC
      LIMIT 10
    `);

    // Get high velocity parts
    const highVelocityParts = await db.query(`
      SELECT 
        p.part_id,
        p.name,
        COUNT(t.transaction_id) as usage_frequency,
        SUM(t.quantity) as total_quantity
      FROM parts p
      JOIN transactions t ON p.part_id = t.part_id
      WHERE t.type IN ('usage', 'OUT')
        AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND p.status = 'active'
      GROUP BY p.part_id, p.name
      ORDER BY usage_frequency DESC
      LIMIT 5
    `);

    // Get highest value parts
    const highestValueParts = await db.query(`
      SELECT 
        p.part_id,
        p.name,
        p.quantity,
        COALESCE(p.unit_cost, 0) as unit_cost,
        (p.quantity * COALESCE(p.unit_cost, 0)) as total_value
      FROM parts p
      WHERE p.status = 'active'
        AND p.unit_cost > 0
        AND p.quantity > 0
      ORDER BY total_value DESC
      LIMIT 12
    `);

    // Compile analytics data
    const analyticsData = {
      inventoryHealth: {
        ...inventoryHealthReq,
        high_risk_parts: highRiskParts.rows.map(part => ({
          ...part,
          risk_score: parseFloat(part.risk_score),
          days_until_stockout: parseFloat(part.days_until_stockout)
        }))
      },
      usagePatterns: {
        fastest_moving_parts: usagePatternsReq.map(part => ({
          ...part,
          trend: parseFloat(part.trend),
          usage_last_30_days: parseInt(part.usage_last_30_days),
          avg_weekly_usage: parseFloat(part.avg_weekly_usage || 0)
        })),
        high_velocity_parts: highVelocityParts.rows.map(part => ({
          ...part,
          usage_frequency: parseInt(part.usage_frequency),
          total_quantity: parseInt(part.total_quantity)
        }))
      },
      costAnalysis: {
        ...costAnalysisReq,
        highest_value_parts: highestValueParts.rows.map(part => ({
          ...part,
          total_value: parseFloat(part.total_value).toFixed(2),
          unit_cost: parseFloat(part.unit_cost).toFixed(2)
        }))
      }
    };

    // Generate PDF using Puppeteer
    const pdfBuffer = await generatePuppeteerAnalyticsPDF(analyticsData);

    // Set response headers for binary PDF data
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="analytics-report-puppeteer-${new Date().toISOString().split('T')[0]}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');

    // Send PDF as binary buffer
    res.end(pdfBuffer, 'binary');

    console.log('✅ Puppeteer PDF analytics report generated successfully');
  } catch (error) {
    console.error('Error generating Puppeteer PDF:', error);
    res.status(500).json({ 
      error: 'Failed to generate Puppeteer PDF report',
      details: error.message 
    });
  }
});

module.exports = router;

