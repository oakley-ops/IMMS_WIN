const express = require('express');
const router = express.Router();
const db = require('../database/db');
const auth = require('../middleware/auth');
const { generateWorkOrderPDF } = require('../utils/workOrderPdfGenerator');

/**
 * Generate technician-based work order number
 * Format: [INITIALS]-[MMDD]-[SEQUENCE]
 * Example: IR-1229-001 for Isaac Rodriguez on Dec 29
 */
async function generateTechnicianWorkOrderNumber(technicianName) {
  try {
    // Default to "UN" (Unassigned) if no technician
    let initials = 'UN';
    
    if (technicianName && technicianName.trim() !== '') {
      // Extract initials from technician name
      const nameParts = technicianName.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        // First letter of first name + first letter of last name
        initials = (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
      } else if (nameParts.length === 1) {
        // If only one name, use first two letters
        initials = nameParts[0].substring(0, 2).toUpperCase();
      }
    }
    
    // Get current date in MMDD format
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = month + day;
    
    // Get sequence number for this technician today
    const prefix = `${initials}-${dateStr}-`;
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM work_orders 
       WHERE work_order_number LIKE $1 
       AND DATE(created_at) = CURRENT_DATE`,
      [`${prefix}%`]
    );
    
    const sequence = parseInt(countResult.rows[0].count) + 1;
    const workOrderNumber = `${prefix}${String(sequence).padStart(3, '0')}`;
    
    console.log(`📋 Generated work order number: ${workOrderNumber} for ${technicianName || 'Unassigned'}`);
    
    return workOrderNumber;
  } catch (error) {
    console.error('Error generating work order number:', error);
    // Fallback to timestamp-based number
    return `WO-${Date.now()}`;
  }
}

/**
 * @route GET /api/v1/work-orders
 * @desc Get all work orders with filters
 * @access Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const { status, priority, work_type, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        wo.*,
        COUNT(DISTINCT wop.wo_part_id) as parts_count,
        COUNT(DISTINCT wot.task_id) as total_tasks,
        COUNT(DISTINCT CASE WHEN wot.is_completed = true THEN wot.task_id END) as completed_tasks
      FROM work_orders wo
      LEFT JOIN work_order_parts wop ON wo.work_order_id = wop.work_order_id
      LEFT JOIN work_order_tasks wot ON wo.work_order_id = wot.work_order_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND wo.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (priority) {
      query += ` AND wo.priority = $${paramCount}`;
      params.push(priority);
      paramCount++;
    }

    if (work_type) {
      query += ` AND wo.work_type = $${paramCount}`;
      params.push(work_type);
      paramCount++;
    }

    query += `
      GROUP BY wo.work_order_id
      ORDER BY 
        CASE wo.priority 
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        wo.due_date ASC NULLS LAST,
        wo.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;
    
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching work orders:', error);
    res.status(500).json({ error: 'Failed to fetch work orders' });
  }
});

/**
 * @route GET /api/v1/work-orders/:id
 * @desc Get single work order with all details
 * @access Private
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get work order details
    const woResult = await db.query(`
      SELECT * FROM work_orders WHERE work_order_id = $1
    `, [id]);

    if (woResult.rows.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    const workOrder = woResult.rows[0];

    // Get tasks
    const tasksResult = await db.query(`
      SELECT * FROM work_order_tasks 
      WHERE work_order_id = $1 
      ORDER BY created_at
    `, [id]);

    // Get parts - handle both id and part_id as primary key
    let partsResult;
    try {
      partsResult = await db.query(`
        SELECT 
          wop.*,
          p.part_name,
          p.crc_part_number as part_number
        FROM work_order_parts wop
        LEFT JOIN parts p ON wop.part_id = p.id
        WHERE wop.work_order_id = $1
        ORDER BY wop.created_at
      `, [id]);
    } catch (err) {
      // If p.id doesn't exist, try p.part_id
      try {
        partsResult = await db.query(`
          SELECT 
            wop.*,
            p.part_name,
            p.crc_part_number as part_number
          FROM work_order_parts wop
          LEFT JOIN parts p ON wop.part_id = p.part_id
          WHERE wop.work_order_id = $1
          ORDER BY wop.created_at
        `, [id]);
      } catch (err2) {
        // If still failing, just get work order parts without join
        partsResult = await db.query(`
          SELECT * FROM work_order_parts
          WHERE work_order_id = $1
          ORDER BY created_at
        `, [id]);
      }
    }

    // Get comments - handle both id and user_id as primary key
    let commentsResult;
    try {
      commentsResult = await db.query(`
        SELECT 
          woc.*,
          u.username as technician_name
        FROM work_order_comments woc
        LEFT JOIN users u ON woc.user_id = u.id
        WHERE woc.work_order_id = $1
        ORDER BY woc.created_at
      `, [id]);
    } catch (err) {
      // If u.id doesn't exist, try u.user_id
      try {
        commentsResult = await db.query(`
          SELECT 
            woc.*,
            u.username as technician_name
          FROM work_order_comments woc
          LEFT JOIN users u ON woc.user_id = u.user_id
          WHERE woc.work_order_id = $1
          ORDER BY woc.created_at
        `, [id]);
      } catch (err2) {
        // If still failing, just get comments without user join
        commentsResult = await db.query(`
          SELECT * FROM work_order_comments
          WHERE work_order_id = $1
          ORDER BY created_at
        `, [id]);
      }
    }

    res.json({
      ...workOrder,
      tasks: tasksResult.rows,
      parts: partsResult.rows,
      comments: commentsResult.rows,
      attachments: [] // Empty array for now
    });
  } catch (error) {
    console.error('Error fetching work order:', error);
    res.status(500).json({ error: 'Failed to fetch work order' });
  }
});

/**
 * @route POST /api/v1/work-orders
 * @desc Create new work order
 * @access Private
 */
router.post('/', auth, async (req, res) => {
  try {
    const {
      title,
      description,
      work_type,
      priority,
      machine_name,
      machine_location,
      technician_name,
      scheduled_date,
      due_date,
      estimated_hours,
      notes
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Generate technician-based work order number
    const work_order_number = await generateTechnicianWorkOrderNumber(technician_name);

    const result = await db.query(`
      INSERT INTO work_orders (
        work_order_number, title, description, work_type, priority,
        machine_name, machine_location, technician_name,
        scheduled_date, due_date, estimated_hours, notes, 
        status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      work_order_number, title, description, work_type, priority || 'medium',
      machine_name, machine_location, technician_name,
      scheduled_date, due_date, estimated_hours, notes,
      'pending', req.user?.id
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating work order:', error);
    res.status(500).json({ error: 'Failed to create work order' });
  }
});

/**
 * @route PUT /api/v1/work-orders/:id
 * @desc Update work order
 * @access Private
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      work_type,
      priority,
      status,
      machine_name,
      machine_location,
      technician_name,
      scheduled_date,
      due_date,
      started_at,
      completed_at,
      estimated_hours,
      actual_hours,
      notes
    } = req.body;

    // Check if technician is being reassigned
    const currentWorkOrder = await db.query(
      'SELECT technician_name, work_order_number FROM work_orders WHERE work_order_id = $1',
      [id]
    );

    let newWorkOrderNumber = null;
    if (currentWorkOrder.rows.length > 0 && technician_name && 
        technician_name !== currentWorkOrder.rows[0].technician_name) {
      // Technician is being reassigned, generate new work order number
      newWorkOrderNumber = await generateTechnicianWorkOrderNumber(technician_name);
      console.log(`🔄 Reassigning work order from ${currentWorkOrder.rows[0].technician_name} to ${technician_name}`);
      console.log(`   Old WO#: ${currentWorkOrder.rows[0].work_order_number} -> New WO#: ${newWorkOrderNumber}`);
    }

    const result = await db.query(`
      UPDATE work_orders SET
        work_order_number = COALESCE($1, work_order_number),
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        work_type = COALESCE($4, work_type),
        priority = COALESCE($5, priority),
        status = COALESCE($6, status),
        machine_name = COALESCE($7, machine_name),
        machine_location = COALESCE($8, machine_location),
        technician_name = COALESCE($9, technician_name),
        scheduled_date = COALESCE($10, scheduled_date),
        due_date = COALESCE($11, due_date),
        started_at = COALESCE($12, started_at),
        completed_at = COALESCE($13, completed_at),
        estimated_hours = COALESCE($14, estimated_hours),
        actual_hours = COALESCE($15, actual_hours),
        notes = COALESCE($16, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE work_order_id = $17
      RETURNING *
    `, [
      newWorkOrderNumber, title, description, work_type, priority, status,
      machine_name, machine_location, technician_name,
      scheduled_date, due_date, started_at, completed_at,
      estimated_hours, actual_hours, notes, id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating work order:', error);
    res.status(500).json({ error: 'Failed to update work order' });
  }
});

/**
 * @route DELETE /api/v1/work-orders/:id
 * @desc Delete work order
 * @access Private
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM work_orders WHERE work_order_id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    res.json({ message: 'Work order deleted successfully' });
  } catch (error) {
    console.error('Error deleting work order:', error);
    res.status(500).json({ error: 'Failed to delete work order' });
  }
});

/**
 * @route POST /api/v1/work-orders/:workOrderId/tasks
 * @desc Add task to work order
 * @access Private
 */
router.post('/:workOrderId/tasks', auth, async (req, res) => {
  try {
    const { workOrderId } = req.params;
    const { task_description } = req.body;

    if (!task_description) {
      return res.status(400).json({ error: 'Task description is required' });
    }

    const result = await db.query(`
      INSERT INTO work_order_tasks (work_order_id, task_description)
      VALUES ($1, $2)
      RETURNING *
    `, [workOrderId, task_description]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding task:', error);
    res.status(500).json({ error: 'Failed to add task' });
  }
});

/**
 * @route PUT /api/v1/work-orders/:workOrderId/tasks/:taskId
 * @desc Update task completion status
 * @access Private
 */
router.put('/:workOrderId/tasks/:taskId', auth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { is_completed } = req.body;

    const result = await db.query(`
      UPDATE work_order_tasks SET
        is_completed = $1,
        completed_at = CASE WHEN $1 = true THEN CURRENT_TIMESTAMP ELSE NULL END,
        completed_by = CASE WHEN $1 = true THEN $2 ELSE NULL END,
        updated_at = CURRENT_TIMESTAMP
      WHERE task_id = $3
      RETURNING *
    `, [is_completed, req.user?.id, taskId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * @route POST /api/v1/work-orders/:workOrderId/comments
 * @desc Add comment to work order
 * @access Private
 */
router.post('/:workOrderId/comments', auth, async (req, res) => {
  try {
    const { workOrderId } = req.params;
    const { comment_text } = req.body;

    if (!comment_text) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const result = await db.query(`
      INSERT INTO work_order_comments (work_order_id, user_id, comment_text)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [workOrderId, req.user?.id, comment_text]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

/**
 * @route GET /api/v1/work-orders/:id/pdf
 * @desc Export work order as PDF
 * @access Private
 */
router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📄 Generating PDF for Work Order ${id}...`);

    // Get complete work order data
    const woResult = await db.query(`
      SELECT * FROM work_orders WHERE work_order_id = $1
    `, [id]);

    if (woResult.rows.length === 0) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    const workOrder = woResult.rows[0];

    // Get parts (for PDF export)
    let partsResult;
    try {
      partsResult = await db.query(`
        SELECT 
          wop.*,
          p.part_name,
          p.crc_part_number as part_number
        FROM work_order_parts wop
        LEFT JOIN parts p ON wop.part_id = p.id
        WHERE wop.work_order_id = $1
        ORDER BY wop.created_at
      `, [id]);
    } catch (err) {
      // If p.id doesn't exist, try p.part_id
      try {
        partsResult = await db.query(`
          SELECT 
            wop.*,
            p.part_name,
            p.crc_part_number as part_number
          FROM work_order_parts wop
          LEFT JOIN parts p ON wop.part_id = p.part_id
          WHERE wop.work_order_id = $1
          ORDER BY wop.created_at
        `, [id]);
      } catch (err2) {
        // If still failing, just get work order parts without join
        partsResult = await db.query(`
          SELECT * FROM work_order_parts
          WHERE work_order_id = $1
          ORDER BY created_at
        `, [id]);
      }
    }

    // Get tasks
    const tasksResult = await db.query(`
      SELECT *
      FROM work_order_tasks
      WHERE work_order_id = $1
      ORDER BY created_at
    `, [id]);

    // Compile data
    const workOrderData = {
      ...workOrder,
      parts: partsResult.rows,
      tasks: tasksResult.rows
    };

    // Generate PDF
    const pdfBuffer = await generateWorkOrderPDF(workOrderData);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${workOrder.work_order_number}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');

    // Send PDF as binary
    res.end(pdfBuffer, 'binary');

    console.log(`✅ PDF generated for Work Order ${workOrder.work_order_number}`);
  } catch (error) {
    console.error('Error generating work order PDF:', error);
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: error.message 
    });
  }
});

module.exports = router;
