const express = require('express');
const router = express.Router();
const { pool } = require('../../db');
const authMiddleware = require('../middleware/authMiddleware');

// Helper function to check if user has permission to manage purchase orders
const canManagePurchaseOrders = (userRole) => {
  return userRole === 'admin' || userRole === 'purchasing';
};

// Get dashboard data
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userRole = req.user?.role;
    const hasPOPermission = canManagePurchaseOrders(userRole);
    
    console.log(`Dashboard request from user ${req.user?.username} with role ${userRole}, PO permission: ${hasPOPermission}`);

    // Get all active parts with their status
    const allPartsQuery = `
      SELECT 
        p.*,
        m.name as machine_name,
        CASE 
          WHEN p.quantity = 0 THEN 'out_of_stock'
          WHEN p.quantity < p.minimum_quantity THEN 'low_stock'
          ELSE 'in_stock'
        END as stock_status
      FROM parts p
      LEFT JOIN machines m ON p.machine_id = m.machine_id
      WHERE p.status = 'active'
      ORDER BY p.name
    `;

    // Get low stock parts (not including out of stock)
    const lowStockQuery = `
      SELECT COUNT(*)
      FROM parts
      WHERE quantity > 0 
      AND quantity < minimum_quantity
      AND status = 'active'
    `;
    
    // Get out of stock parts
    const outOfStockQuery = `
      SELECT COUNT(*)
      FROM parts
      WHERE quantity = 0
      AND status = 'active'
    `;

    // Get recent usage history
    const usageHistoryQuery = `
      SELECT 
        t.created_at as date,
        p.name as part_name,
        m.name as machine_name,
        t.quantity,
        t.type
      FROM transactions t
      JOIN parts p ON t.part_id = p.part_id
      LEFT JOIN machines m ON p.machine_id = m.machine_id
      ORDER BY t.created_at DESC
      LIMIT 10
    `;
    
    // Get total counts
    const statsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM parts WHERE status = 'active') as total_parts,
        (SELECT COUNT(*) FROM machines) as total_machines,
        (SELECT COUNT(*) FROM parts WHERE quantity > 0 AND quantity < minimum_quantity AND status = 'active') as low_stock_count,
        (SELECT COUNT(*) FROM parts WHERE quantity = 0 AND status = 'active') as out_of_stock_count
    `;

    // Get usage trends for the last 30 days
    const usageTrendQuery = `
      WITH RECURSIVE dates AS (
        SELECT CURRENT_DATE - INTERVAL '29 days' AS date
        UNION ALL
        SELECT date + INTERVAL '1 day'
        FROM dates
        WHERE date < CURRENT_DATE
      )
      SELECT 
        TO_CHAR(d.date, 'YYYY-MM-DD') as date,
        COALESCE(t.part_name, 'No Usage') as part_name,
        COALESCE(SUM(CASE WHEN t.type IN ('usage', 'OUT') THEN t.quantity ELSE 0 END), 0)::integer as usage_quantity,
        COALESCE(SUM(CASE WHEN t.type IN ('restock', 'IN') THEN t.quantity ELSE 0 END), 0)::integer as restock_quantity
      FROM dates d
      LEFT JOIN (
        SELECT 
          DATE(t.created_at) as date,
          p.name as part_name,
          t.type,
          t.quantity
        FROM transactions t
        JOIN parts p ON t.part_id = p.part_id
        WHERE t.created_at >= CURRENT_DATE - INTERVAL '30 days'
          AND p.status = 'active'
          AND t.type IN ('usage', 'restock', 'IN', 'OUT')
      ) t ON d.date = t.date
      GROUP BY d.date, t.part_name
      ORDER BY d.date ASC;
    `;

    // Get top 5 most used parts
    const topPartsQuery = `
      SELECT 
        p.name as part_name,
        p.quantity::integer as current_quantity,
        p.minimum_quantity::integer as minimum_quantity,
        COALESCE(SUM(CASE WHEN t.type IN ('usage', 'OUT') THEN t.quantity ELSE 0 END), 0)::integer as total_usage,
        COUNT(CASE WHEN t.type IN ('usage', 'OUT') THEN 1 END)::integer as usage_frequency
      FROM parts p
      LEFT JOIN transactions t ON p.part_id = t.part_id 
        AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
        AND t.type IN ('usage', 'OUT')
      WHERE p.status = 'active'
      GROUP BY p.part_id, p.name, p.quantity, p.minimum_quantity
      HAVING COALESCE(SUM(CASE WHEN t.type IN ('usage', 'OUT') THEN t.quantity ELSE 0 END), 0) > 0
      ORDER BY total_usage DESC
      LIMIT 5;
    `;

    // Purchase Order queries - only define if user has permission
    let poStatsQuery = null;
    let recentPOsQuery = null;
    
    if (hasPOPermission) {
      poStatsQuery = `
        SELECT
          (SELECT COUNT(*) FROM purchase_orders) as total_po_count,
          (SELECT COUNT(*) FROM purchase_orders WHERE approval_status = 'pending') as pending_po_count,
          (SELECT COUNT(*) FROM purchase_orders WHERE approval_status = 'approved') as approved_po_count,
          (SELECT COUNT(*) FROM purchase_orders WHERE approval_status = 'rejected') as rejected_po_count
      `;

      recentPOsQuery = `
        SELECT 
          po.po_id,
          po.po_number,
          COALESCE(po.approval_status, po.status) as status,
          COALESCE(s.name, 'Unknown Supplier') as supplier_name,
          po.total_amount,
          po.created_at
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.supplier_id
        ORDER BY po.created_at DESC
        LIMIT 5
      `;
    }

    console.log('Executing queries...');
    
    try {
      // Build queries array based on permissions
      const queries = [
        pool.query(allPartsQuery),
        pool.query(lowStockQuery),
        pool.query(outOfStockQuery),
        pool.query(usageHistoryQuery),
        pool.query(statsQuery),
        pool.query(usageTrendQuery),
        pool.query(topPartsQuery)
      ];

      // Add PO queries only if user has permission
      if (hasPOPermission) {
        queries.push(pool.query(poStatsQuery));
        queries.push(pool.query(recentPOsQuery));
      }

      const results = await Promise.all(queries);
      
      let allPartsResult, lowStockResult, outOfStockResult, usageHistoryResult, statsResult, usageTrendResult, topPartsResult, poStatsResult, recentPOsResult;
      
      if (hasPOPermission) {
        [
          allPartsResult, 
          lowStockResult, 
          outOfStockResult, 
          usageHistoryResult, 
          statsResult, 
          usageTrendResult,
          topPartsResult,
          poStatsResult,
          recentPOsResult
        ] = results;
      } else {
        [
          allPartsResult, 
          lowStockResult, 
          outOfStockResult, 
          usageHistoryResult, 
          statsResult, 
          usageTrendResult,
          topPartsResult
        ] = results;
      }

      const response = {
        allParts: allPartsResult.rows,
        lowStockCount: parseInt(lowStockResult.rows[0].count),
        outOfStockCount: parseInt(outOfStockResult.rows[0].count),
        lowStockParts: allPartsResult.rows.filter(p => p.stock_status === 'low_stock'),
        outOfStockParts: allPartsResult.rows.filter(p => p.stock_status === 'out_of_stock'),
        recentUsageHistory: usageHistoryResult.rows,
        totalParts: parseInt(statsResult.rows[0].total_parts),
        totalMachines: parseInt(statsResult.rows[0].total_machines),
        usageTrends: usageTrendResult?.rows || [],
        topUsedParts: topPartsResult?.rows || [],
        // Purchase order stats - only include if user has permission
        totalPOCount: hasPOPermission ? parseInt(poStatsResult.rows[0].total_po_count) : 0,
        pendingPOCount: hasPOPermission ? parseInt(poStatsResult.rows[0].pending_po_count) : 0,
        approvedPOCount: hasPOPermission ? parseInt(poStatsResult.rows[0].approved_po_count) : 0,
        rejectedPOCount: hasPOPermission ? parseInt(poStatsResult.rows[0].rejected_po_count) : 0,
        recentPurchaseOrders: hasPOPermission ? (recentPOsResult.rows || []) : []
      };

      // Log response for debugging
      console.log('Dashboard response for user', req.user?.username, {
        hasPOPermission,
        totalPOCount: response.totalPOCount,
        recentPOsCount: response.recentPurchaseOrders.length
      });

      res.json(response);
    } catch (error) {
      console.error('Error executing queries:', error);
      throw error;
    }
  } catch (error) {
    console.error('Dashboard route error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Server-sent events endpoint for real-time updates
router.get('/events', authMiddleware, (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send an initial event
  res.write('data: {"connected":true}\n\n');

  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(':\n\n');
  }, 30000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

module.exports = router;
