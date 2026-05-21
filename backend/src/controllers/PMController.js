const { pool } = require('../../db');

class PMController {

  // Get PM statistics
  async getStats(req, res) {
    try {
      const result = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE next_maintenance_date < CURRENT_DATE AND (maintenance_status IS NULL OR maintenance_status != 'in_progress')) as overdue,
          COUNT(*) FILTER (WHERE next_maintenance_date >= CURRENT_DATE AND next_maintenance_date <= CURRENT_DATE + INTERVAL '7 days' AND (maintenance_status IS NULL OR maintenance_status != 'in_progress')) as due_soon,
          COUNT(*) FILTER (WHERE next_maintenance_date > CURRENT_DATE + INTERVAL '7 days' AND (maintenance_status IS NULL OR maintenance_status != 'in_progress')) as scheduled,
          COUNT(*) FILTER (WHERE maintenance_status = 'in_progress') as in_progress,
          COUNT(*) FILTER (WHERE next_maintenance_date IS NULL AND (maintenance_status IS NULL OR maintenance_status != 'completed')) as not_scheduled,
          COUNT(*) as total
        FROM machines
        WHERE maintenance_status IS NULL OR maintenance_status != 'completed'
      `);

      const stats = result.rows[0];
      res.json({
        overdue: parseInt(stats.overdue) || 0,
        due_soon: parseInt(stats.due_soon) || 0,
        scheduled: parseInt(stats.scheduled) || 0,
        in_progress: parseInt(stats.in_progress) || 0,
        not_scheduled: parseInt(stats.not_scheduled) || 0,
        total: parseInt(stats.total) || 0
      });
    } catch (error) {
      console.error('Error fetching PM stats:', error);
      res.status(500).json({ error: 'Failed to fetch PM stats' });
    }
  }

  // Get all PM intervals
  async getIntervals(req, res) {
    try {
      const result = await pool.query(
        'SELECT * FROM pm_intervals ORDER BY machine_type, interval_days'
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching PM intervals:', error);
      res.status(500).json({ error: 'Failed to fetch PM intervals' });
    }
  }

  // Get PM interval by machine type
  async getIntervalByMachineType(req, res) {
    try {
      const { machineType } = req.params;
      const result = await pool.query(
        'SELECT * FROM pm_intervals WHERE machine_type = $1',
        [machineType]
      );
      
      if (result.rows.length === 0) {
        // Return default interval if no specific one found
        const defaultResult = await pool.query(
          'SELECT * FROM pm_intervals WHERE machine_type = $1',
          ['Default']
        );
        res.json(defaultResult.rows[0] || { interval_days: 90 });
      } else {
        res.json(result.rows[0]);
      }
    } catch (error) {
      console.error('Error fetching PM interval:', error);
      res.status(500).json({ error: 'Failed to fetch PM interval' });
    }
  }

  // Get all PM checklists
  async getChecklists(req, res) {
    try {
      const result = await pool.query(
        'SELECT * FROM pm_checklists WHERE is_active = true ORDER BY name'
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching PM checklists:', error);
      res.status(500).json({ error: 'Failed to fetch PM checklists' });
    }
  }

  // Get checklist by machine type
  async getChecklistByMachineType(req, res) {
    try {
      const { machineType } = req.params;
      const result = await pool.query(
        'SELECT * FROM pm_checklists WHERE machine_type = $1 AND is_active = true',
        [machineType]
      );
      
      if (result.rows.length === 0) {
        // Return default checklist if no specific one found
        const defaultResult = await pool.query(
          'SELECT * FROM pm_checklists WHERE machine_type = $1 AND is_active = true',
          ['Default']
        );
        res.json(defaultResult.rows[0] || null);
      } else {
        res.json(result.rows[0]);
      }
    } catch (error) {
      console.error('Error fetching PM checklist:', error);
      res.status(500).json({ error: 'Failed to fetch PM checklist' });
    }
  }

  // Get tasks for a specific checklist
  async getChecklistTasks(req, res) {
    try {
      const { checklistId } = req.params;
      const result = await pool.query(
        'SELECT * FROM pm_tasks WHERE checklist_id = $1 ORDER BY sort_order',
        [checklistId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching PM tasks:', error);
      res.status(500).json({ error: 'Failed to fetch PM tasks' });
    }
  }

  // Start a new PM session
  async startSession(req, res) {
    try {
      const { machineId, checklistId, technicianName } = req.body;
      
      // Validate required fields
      if (!machineId || !checklistId) {
        return res.status(400).json({ error: 'Machine ID and checklist ID are required' });
      }

      // Check if there's already an active session for this machine
      const existingSession = await pool.query(
        'SELECT * FROM pm_sessions WHERE machine_id = $1 AND status = $2',
        [machineId, 'in_progress']
      );

      if (existingSession.rows.length > 0) {
        return res.status(400).json({ error: 'There is already an active PM session for this machine' });
      }

      // Create new session
      const sessionResult = await pool.query(
        'INSERT INTO pm_sessions (machine_id, checklist_id, technician_name, status) VALUES ($1, $2, $3, $4) RETURNING *',
        [machineId, checklistId, technicianName, 'in_progress']
      );

      const session = sessionResult.rows[0];

      // Update machine maintenance_status to in_progress
      await pool.query(
        'UPDATE machines SET maintenance_status = $1 WHERE machine_id = $2',
        ['in_progress', machineId]
      );

      // Create task completion entries for all tasks in the checklist
      const tasksResult = await pool.query(
        'SELECT * FROM pm_tasks WHERE checklist_id = $1',
        [checklistId]
      );

      for (const task of tasksResult.rows) {
        await pool.query(
          'INSERT INTO pm_task_completions (session_id, task_id, is_completed) VALUES ($1, $2, $3)',
          [session.session_id, task.task_id, false]
        );
      }

      res.status(201).json(session);
    } catch (error) {
      console.error('Error starting PM session:', error);
      res.status(500).json({ error: 'Failed to start PM session' });
    }
  }

  // Get PM session details with task completion status
  async getSession(req, res) {
    try {
      const { sessionId } = req.params;
      
      // Get session details
      const sessionResult = await pool.query(
        `SELECT 
          s.*,
          m.name as machine_name,
          m.model as machine_model,
          m.location as machine_location,
          c.name as checklist_name,
          c.description as checklist_description,
          s.technician_name as technician_username
        FROM pm_sessions s
        JOIN machines m ON s.machine_id = m.machine_id
        JOIN pm_checklists c ON s.checklist_id = c.checklist_id
        WHERE s.session_id = $1`,
        [sessionId]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(404).json({ error: 'PM session not found' });
      }

      const session = sessionResult.rows[0];

      // Get task completion status
      const tasksResult = await pool.query(
        `SELECT 
          t.task_id,
          t.task_name,
          t.description as task_description,
          t.is_required,
          t.sort_order as order_position,
          tc.is_completed,
          tc.completed_at,
          tc.notes
        FROM pm_tasks t
        JOIN pm_task_completions tc ON t.task_id = tc.task_id
        WHERE tc.session_id = $1
        ORDER BY t.sort_order`,
        [sessionId]
      );

      session.tasks = tasksResult.rows;
      
      res.json(session);
    } catch (error) {
      console.error('Error fetching PM session:', error);
      res.status(500).json({ error: 'Failed to fetch PM session' });
    }
  }

  // Update task completion status
  async updateTaskCompletion(req, res) {
    try {
      const { sessionId, taskId } = req.params;
      const { isCompleted, notes } = req.body;

      const completedAt = isCompleted ? new Date() : null;

      const result = await pool.query(
        'UPDATE pm_task_completions SET is_completed = $1, completed_at = $2, notes = $3 WHERE session_id = $4 AND task_id = $5 RETURNING *',
        [isCompleted, completedAt, notes, sessionId, taskId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Task completion not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating task completion:', error);
      res.status(500).json({ error: 'Failed to update task completion' });
    }
  }

  // Complete PM session
  async completeSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { notes } = req.body;

      // Check if all required tasks are completed
      const incompleteRequiredTasks = await pool.query(
        `SELECT COUNT(*) as count
        FROM pm_tasks t
        JOIN pm_task_completions tc ON t.task_id = tc.task_id
        WHERE tc.session_id = $1 AND t.is_required = true AND tc.is_completed = false`,
        [sessionId]
      );

      if (incompleteRequiredTasks.rows[0].count > 0) {
        return res.status(400).json({ 
          error: 'All required tasks must be completed before finishing the PM session' 
        });
      }

      // Update session status to completed
      const sessionResult = await pool.query(
        'UPDATE pm_sessions SET status = $1, completed_at = $2, notes = $3 WHERE session_id = $4 RETURNING *',
        ['completed', new Date(), notes, sessionId]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(404).json({ error: 'PM session not found' });
      }

      const session = sessionResult.rows[0];

      // Update machine maintenance dates and schedule next PM
      const machineResult = await pool.query(
        'SELECT machine_id, machine_type FROM machines WHERE machine_id = $1',
        [session.machine_id]
      );

      if (machineResult.rows.length > 0) {
        const machine = machineResult.rows[0];
        
        // Get interval for this machine type
        const intervalResult = await pool.query(
          'SELECT interval_days FROM pm_intervals WHERE machine_type = $1',
          [machine.machine_type]
        );

        let intervalDays = 90; // Default
        if (intervalResult.rows.length > 0) {
          intervalDays = intervalResult.rows[0].interval_days;
        }

        // Calculate next maintenance date
        const nextMaintenanceDate = new Date();
        nextMaintenanceDate.setDate(nextMaintenanceDate.getDate() + intervalDays);

        // Update machine maintenance dates and reset maintenance_status
        await pool.query(
          'UPDATE machines SET last_maintenance_date = $1, next_maintenance_date = $2, maintenance_status = NULL WHERE machine_id = $3',
          [new Date(), nextMaintenanceDate, session.machine_id]
        );

        // Log maintenance completion
        try {
          await pool.query(
            'INSERT INTO maintenance_logs (machine_id, status, log_date, completion_date, technician, notes) VALUES ($1, $2, $3, $4, $5, $6)',
            [session.machine_id, 'completed', new Date(), new Date(), session.technician_name, notes]
          );
        } catch (logError) {
          console.warn('Could not log maintenance completion:', logError.message);
        }
      }

      res.json(session);
    } catch (error) {
      console.error('Error completing PM session:', error);
      res.status(500).json({ error: 'Failed to complete PM session' });
    }
  }

  // Get active PM sessions
  async getActiveSessions(req, res) {
    try {
      const result = await pool.query(
        `SELECT 
          s.*,
          m.name as machine_name,
          m.model as machine_model,
          m.location as machine_location,
          c.name as checklist_name,
          s.technician_name as technician_username
        FROM pm_sessions s
        JOIN machines m ON s.machine_id = m.machine_id
        JOIN pm_checklists c ON s.checklist_id = c.checklist_id
        WHERE s.status = 'in_progress'
        ORDER BY s.started_at DESC`
      );

      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching active PM sessions:', error);
      res.status(500).json({ error: 'Failed to fetch active PM sessions' });
    }
  }

  // Get PM session history
  async getSessionHistory(req, res) {
    try {
      const { page = 0, limit = 25 } = req.query;
      const offset = page * limit;

      const result = await pool.query(
        `SELECT 
          s.*,
          m.name as machine_name,
          m.model as machine_model,
          m.location as machine_location,
          c.name as checklist_name,
          s.technician_name as technician_username
        FROM pm_sessions s
        JOIN machines m ON s.machine_id = m.machine_id
        JOIN pm_checklists c ON s.checklist_id = c.checklist_id
        ORDER BY s.started_at DESC
        LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      // Get total count
      const countResult = await pool.query('SELECT COUNT(*) FROM pm_sessions');
      const totalCount = parseInt(countResult.rows[0].count);

      res.json({
        sessions: result.rows,
        pagination: {
          total: totalCount,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalCount / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching PM session history:', error);
      res.status(500).json({ error: 'Failed to fetch PM session history' });
    }
  }

  // Create new PM checklist (Admin only)
  async createChecklist(req, res) {
    try {
      const { name, description, machineType, tasks } = req.body;
      
      if (!name || !machineType) {
        return res.status(400).json({ error: 'Name and machine type are required' });
      }

      // Create checklist
      const checklistResult = await pool.query(
        'INSERT INTO pm_checklists (name, description, machine_type) VALUES ($1, $2, $3) RETURNING *',
        [name, description, machineType]
      );

      const checklist = checklistResult.rows[0];

      // Add tasks if provided
      if (tasks && Array.isArray(tasks)) {
        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          await pool.query(
            'INSERT INTO pm_tasks (checklist_id, task_name, description, is_required, sort_order) VALUES ($1, $2, $3, $4, $5)',
            [checklist.checklist_id, task.name, task.description, task.isRequired || true, i + 1]
          );
        }
      }

      res.status(201).json(checklist);
    } catch (error) {
      console.error('Error creating PM checklist:', error);
      res.status(500).json({ error: 'Failed to create PM checklist' });
    }
  }

  // Update PM checklist (Admin only)
  async updateChecklist(req, res) {
    try {
      const { checklistId } = req.params;
      const { name, description, machineType, tasks } = req.body;
      
      if (!name || !machineType) {
        return res.status(400).json({ error: 'Name and machine type are required' });
      }

      // Check if checklist exists
      const existingChecklist = await pool.query(
        'SELECT * FROM pm_checklists WHERE checklist_id = $1',
        [checklistId]
      );

      if (existingChecklist.rows.length === 0) {
        return res.status(404).json({ error: 'Checklist not found' });
      }

      // Update checklist
      const checklistResult = await pool.query(
        'UPDATE pm_checklists SET name = $1, description = $2, machine_type = $3, updated_at = CURRENT_TIMESTAMP WHERE checklist_id = $4 RETURNING *',
        [name, description, machineType, checklistId]
      );

      const checklist = checklistResult.rows[0];

      // Update tasks if provided
      if (tasks && Array.isArray(tasks)) {
        // Delete existing tasks
        await pool.query('DELETE FROM pm_tasks WHERE checklist_id = $1', [checklistId]);
        
        // Add new tasks
        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          await pool.query(
            'INSERT INTO pm_tasks (checklist_id, task_name, description, is_required, sort_order) VALUES ($1, $2, $3, $4, $5)',
            [checklistId, task.name, task.description, task.isRequired || true, i + 1]
          );
        }
      }

      res.json(checklist);
    } catch (error) {
      console.error('Error updating PM checklist:', error);
      res.status(500).json({ error: 'Failed to update PM checklist' });
    }
  }

  // Delete PM checklist (Admin only)
  async deleteChecklist(req, res) {
    try {
      const { checklistId } = req.params;

      // Check if checklist exists
      const existingChecklist = await pool.query(
        'SELECT * FROM pm_checklists WHERE checklist_id = $1',
        [checklistId]
      );

      if (existingChecklist.rows.length === 0) {
        return res.status(404).json({ error: 'Checklist not found' });
      }

      // Check if there are any active sessions using this checklist
      const activeSessions = await pool.query(
        'SELECT COUNT(*) as count FROM pm_sessions WHERE checklist_id = $1 AND status = $2',
        [checklistId, 'in_progress']
      );

      if (activeSessions.rows[0].count > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete checklist with active PM sessions. Please complete or cancel active sessions first.' 
        });
      }

      // Soft delete by marking as inactive
      await pool.query(
        'UPDATE pm_checklists SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE checklist_id = $1',
        [checklistId]
      );

      res.json({ message: 'Checklist deleted successfully' });
    } catch (error) {
      console.error('Error deleting PM checklist:', error);
      res.status(500).json({ error: 'Failed to delete PM checklist' });
    }
  }

  // Get checklist with tasks for editing
  async getChecklistWithTasks(req, res) {
    try {
      const { checklistId } = req.params;
      
      // Get checklist details
      const checklistResult = await pool.query(
        'SELECT * FROM pm_checklists WHERE checklist_id = $1 AND is_active = true',
        [checklistId]
      );

      if (checklistResult.rows.length === 0) {
        return res.status(404).json({ error: 'Checklist not found' });
      }

      const checklist = checklistResult.rows[0];

      // Get tasks for this checklist
      const tasksResult = await pool.query(
        'SELECT * FROM pm_tasks WHERE checklist_id = $1 ORDER BY sort_order',
        [checklistId]
      );

      checklist.tasks = tasksResult.rows;
      
      res.json(checklist);
    } catch (error) {
      console.error('Error fetching checklist with tasks:', error);
      res.status(500).json({ error: 'Failed to fetch checklist with tasks' });
    }
  }

  // Schedule maintenance for a machine
  async scheduleMaintenance(req, res) {
    try {
      const { machineId, checklistId, nextMaintenanceDate, technicianName, notes } = req.body;
      
      // Validate required fields
      if (!machineId || !checklistId || !nextMaintenanceDate) {
        return res.status(400).json({ error: 'Machine ID, checklist ID, and next maintenance date are required' });
      }

      // Validate the date
      const scheduleDate = new Date(nextMaintenanceDate);
      if (isNaN(scheduleDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }

      // Check if machine exists
      const machineResult = await pool.query(
        'SELECT machine_id, name, machine_type FROM machines WHERE machine_id = $1',
        [machineId]
      );

      if (machineResult.rows.length === 0) {
        return res.status(404).json({ error: 'Machine not found' });
      }

      // Check if checklist exists
      const checklistResult = await pool.query(
        'SELECT checklist_id, name FROM pm_checklists WHERE checklist_id = $1 AND is_active = true',
        [checklistId]
      );

      if (checklistResult.rows.length === 0) {
        return res.status(404).json({ error: 'Checklist not found or inactive' });
      }

      // Update machine's next maintenance date, scheduled technician, and scheduled checklist
      await pool.query(
        'UPDATE machines SET next_maintenance_date = $1, scheduled_technician = $2, scheduled_checklist_id = $3 WHERE machine_id = $4',
        [scheduleDate, technicianName, checklistId, machineId]
      );

      // Create a scheduled maintenance log entry
      try {
        await pool.query(
          'INSERT INTO maintenance_logs (machine_id, status, log_date, scheduled_date, technician, notes) VALUES ($1, $2, $3, $4, $5, $6)',
          [machineId, 'scheduled', new Date(), scheduleDate, technicianName || 'System', notes || 'Maintenance scheduled']
        );
      } catch (logError) {
        console.warn('Could not log maintenance scheduling:', logError.message);
      }

      // Return success response with details
      res.status(201).json({
        message: 'Maintenance scheduled successfully',
        machine: machineResult.rows[0],
        checklist: checklistResult.rows[0],
        scheduledDate: scheduleDate,
        technicianName,
        notes
      });
    } catch (error) {
      console.error('Error scheduling maintenance:', error);
      res.status(500).json({ error: 'Failed to schedule maintenance' });
    }
  }

  // Update PM interval (Admin only)
  async updateInterval(req, res) {
    try {
      const { machineType } = req.params;
      const { intervalDays, intervalDescription } = req.body;

      if (!intervalDays || intervalDays <= 0) {
        return res.status(400).json({ error: 'Valid interval days are required' });
      }

      const result = await pool.query(
        'UPDATE pm_intervals SET interval_days = $1, interval_description = $2 WHERE machine_type = $3 RETURNING *',
        [intervalDays, intervalDescription, machineType]
      );

      if (result.rows.length === 0) {
        // Create new interval if it doesn't exist
        const createResult = await pool.query(
          'INSERT INTO pm_intervals (machine_type, interval_days, interval_description) VALUES ($1, $2, $3) RETURNING *',
          [machineType, intervalDays, intervalDescription]
        );
        res.status(201).json(createResult.rows[0]);
      } else {
        res.json(result.rows[0]);
      }
    } catch (error) {
      console.error('Error updating PM interval:', error);
      res.status(500).json({ error: 'Failed to update PM interval' });
    }
  }

  // Update scheduled maintenance for a machine
  async updateScheduledMaintenance(req, res) {
    try {
      const { machineId } = req.params;
      const { checklistId, nextMaintenanceDate, technicianName, notes } = req.body;

      // Validate required fields
      if (!nextMaintenanceDate) {
        return res.status(400).json({ error: 'Next maintenance date is required' });
      }

      // Validate the date
      const scheduleDate = new Date(nextMaintenanceDate);
      if (isNaN(scheduleDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }

      // Check if machine exists
      const machineResult = await pool.query(
        'SELECT machine_id, name, machine_type FROM machines WHERE machine_id = $1',
        [machineId]
      );

      if (machineResult.rows.length === 0) {
        return res.status(404).json({ error: 'Machine not found' });
      }

      // If checklistId provided, verify it exists
      if (checklistId) {
        const checklistResult = await pool.query(
          'SELECT checklist_id, name FROM pm_checklists WHERE checklist_id = $1 AND is_active = true',
          [checklistId]
        );

        if (checklistResult.rows.length === 0) {
          return res.status(404).json({ error: 'Checklist not found or inactive' });
        }
      }

      // Update machine's scheduled maintenance
      await pool.query(
        'UPDATE machines SET next_maintenance_date = $1, scheduled_technician = $2, scheduled_checklist_id = $3 WHERE machine_id = $4',
        [scheduleDate, technicianName, checklistId, machineId]
      );

      // Log the schedule update
      try {
        await pool.query(
          'INSERT INTO maintenance_logs (machine_id, status, log_date, scheduled_date, technician, notes) VALUES ($1, $2, $3, $4, $5, $6)',
          [machineId, 'rescheduled', new Date(), scheduleDate, technicianName || 'System', notes || 'Maintenance rescheduled']
        );
      } catch (logError) {
        console.warn('Could not log maintenance rescheduling:', logError.message);
      }

      res.json({
        message: 'Scheduled maintenance updated successfully',
        machine: machineResult.rows[0],
        scheduledDate: scheduleDate,
        technicianName
      });
    } catch (error) {
      console.error('Error updating scheduled maintenance:', error);
      res.status(500).json({ error: 'Failed to update scheduled maintenance' });
    }
  }

  // Cancel scheduled maintenance for a machine
  async cancelScheduledMaintenance(req, res) {
    try {
      const { machineId } = req.params;
      const { notes } = req.body;

      // Check if machine exists
      const machineResult = await pool.query(
        'SELECT machine_id, name, next_maintenance_date FROM machines WHERE machine_id = $1',
        [machineId]
      );

      if (machineResult.rows.length === 0) {
        return res.status(404).json({ error: 'Machine not found' });
      }

      const machine = machineResult.rows[0];

      if (!machine.next_maintenance_date) {
        return res.status(400).json({ error: 'No maintenance is scheduled for this machine' });
      }

      // Clear the scheduled maintenance
      await pool.query(
        'UPDATE machines SET next_maintenance_date = NULL, scheduled_technician = NULL, scheduled_checklist_id = NULL, maintenance_status = NULL WHERE machine_id = $1',
        [machineId]
      );

      // Log the cancellation
      try {
        await pool.query(
          'INSERT INTO maintenance_logs (machine_id, status, log_date, notes) VALUES ($1, $2, $3, $4)',
          [machineId, 'cancelled', new Date(), notes || 'Scheduled maintenance cancelled']
        );
      } catch (logError) {
        console.warn('Could not log maintenance cancellation:', logError.message);
      }

      res.json({
        message: 'Scheduled maintenance cancelled successfully',
        machine: machine
      });
    } catch (error) {
      console.error('Error cancelling scheduled maintenance:', error);
      res.status(500).json({ error: 'Failed to cancel scheduled maintenance' });
    }
  }

  // Get scheduled maintenance details for a machine
  async getScheduledMaintenance(req, res) {
    try {
      const { machineId } = req.params;

      const result = await pool.query(
        `SELECT
          m.machine_id,
          m.name,
          m.model,
          m.location,
          m.machine_type,
          m.next_maintenance_date,
          m.last_maintenance_date,
          m.scheduled_technician,
          m.scheduled_checklist_id,
          m.maintenance_status,
          c.name as checklist_name,
          c.description as checklist_description
        FROM machines m
        LEFT JOIN pm_checklists c ON m.scheduled_checklist_id = c.checklist_id
        WHERE m.machine_id = $1`,
        [machineId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Machine not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching scheduled maintenance:', error);
      res.status(500).json({ error: 'Failed to fetch scheduled maintenance' });
    }
  }
}

module.exports = new PMController(); 