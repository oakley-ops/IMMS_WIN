const express = require('express');
const router = express.Router();
const PMController = require('../controllers/PMController');
const authMiddleware = require('../middleware/authMiddleware');
const roleAuthorization = require('../middleware/roleMiddleware');

// Define role permissions for PM system
const ROLES = {
  ALL: ['admin', 'tech', 'purchasing'],
  ADMIN_TECH: ['admin', 'tech'],
  ADMIN_ONLY: ['admin']
};

// PM Stats route
router.get('/stats', authMiddleware, roleAuthorization(ROLES.ALL), PMController.getStats);

// PM Intervals routes
router.get('/intervals', authMiddleware, roleAuthorization(ROLES.ALL), PMController.getIntervals);
router.get('/intervals/:machineType', authMiddleware, roleAuthorization(ROLES.ALL), PMController.getIntervalByMachineType);
router.put('/intervals/:machineType', authMiddleware, roleAuthorization(ROLES.ADMIN_ONLY), PMController.updateInterval);

// PM Checklists routes
router.get('/checklists', authMiddleware, roleAuthorization(ROLES.ALL), PMController.getChecklists);
router.get('/checklists/by-machine-type/:machineType', authMiddleware, roleAuthorization(ROLES.ALL), PMController.getChecklistByMachineType);
router.get('/checklists/:checklistId', authMiddleware, roleAuthorization(ROLES.ALL), PMController.getChecklistWithTasks);
router.post('/checklists', authMiddleware, roleAuthorization(ROLES.ADMIN_ONLY), PMController.createChecklist);
router.put('/checklists/:checklistId', authMiddleware, roleAuthorization(ROLES.ADMIN_ONLY), PMController.updateChecklist);
router.delete('/checklists/:checklistId', authMiddleware, roleAuthorization(ROLES.ADMIN_ONLY), PMController.deleteChecklist);

// PM Tasks routes
router.get('/checklists/:checklistId/tasks', authMiddleware, roleAuthorization(ROLES.ALL), PMController.getChecklistTasks);

// PM Sessions routes
router.post('/sessions', authMiddleware, roleAuthorization(ROLES.ADMIN_TECH), PMController.startSession);
router.get('/sessions/active', authMiddleware, roleAuthorization(ROLES.ALL), PMController.getActiveSessions);
router.get('/sessions/history', authMiddleware, roleAuthorization(ROLES.ALL), PMController.getSessionHistory);
router.get('/sessions/:sessionId', authMiddleware, roleAuthorization(ROLES.ALL), PMController.getSession);
router.put('/sessions/:sessionId/complete', authMiddleware, roleAuthorization(ROLES.ADMIN_TECH), PMController.completeSession);

// PM Task Completion routes
router.put('/sessions/:sessionId/tasks/:taskId', authMiddleware, roleAuthorization(ROLES.ADMIN_TECH), PMController.updateTaskCompletion);

// PM Scheduling routes
router.post('/schedule', authMiddleware, roleAuthorization(ROLES.ADMIN_TECH), PMController.scheduleMaintenance);
router.get('/schedule/:machineId', authMiddleware, roleAuthorization(ROLES.ALL), PMController.getScheduledMaintenance);
router.put('/schedule/:machineId', authMiddleware, roleAuthorization(ROLES.ADMIN_TECH), PMController.updateScheduledMaintenance);
router.delete('/schedule/:machineId', authMiddleware, roleAuthorization(ROLES.ADMIN_TECH), PMController.cancelScheduledMaintenance);

module.exports = router; 