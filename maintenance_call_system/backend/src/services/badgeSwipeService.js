// Badge-swipe orchestration. Pure business logic: no HTTP, no logging.
// Returns a discriminated union: { action, call?, machine_name }.
// Throws domain errors that the route layer translates to HTTP responses.

const repo = require('../repositories/maintenanceCallsRepo');
const { getCurrentShift } = require('../config/shifts');

class DomainError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * Handle a badge swipe at a reader.
 * @returns {{ action: string, call?: object, machine_name: string | null, emit?: { event: string, payload: object } }}
 */
const handleBadgeSwipe = async (db, { badge_id, reader_key }) => {
  const badge = await repo.findActiveBadge(db, badge_id);
  if (!badge) {
    return { action: 'unknown_badge', machine_name: null };
  }

  const reader = await repo.findActiveReader(db, reader_key);
  if (!reader) {
    throw new DomainError('not_found', 'Reader not found or inactive', 404);
  }

  const activeCall = await repo.findOpenCallForMachine(db, reader.machine_id);

  if (badge.role === 'operator') {
    return handleOperatorSwipe({ db, badge, reader, activeCall });
  }
  if (badge.role === 'technician') {
    return handleTechnicianSwipe({ db, badge, reader, activeCall });
  }
  throw new DomainError('bad_request', 'Unknown badge role', 400);
};

const handleOperatorSwipe = async ({ db, badge, reader, activeCall }) => {
  if (activeCall) {
    return {
      action: 'already_active',
      call: activeCall,
      machine_name: reader.machine_name,
    };
  }
  const newCall = await repo.insertCall(db, {
    machineId: reader.machine_id,
    readerId: reader.reader_id,
    badgeId: badge.badge_id,
    personName: badge.person_name,
    shiftName: getCurrentShift(),
  });
  const callWithMachine = { ...newCall, machine_name: reader.machine_name };
  return {
    action: 'call_created',
    call: callWithMachine,
    machine_name: reader.machine_name,
    emit: { event: 'maintenance_call_created', payload: callWithMachine },
  };
};

const handleTechnicianSwipe = async ({ db, badge, reader, activeCall }) => {
  if (!activeCall) {
    return { action: 'no_active_call', machine_name: reader.machine_name };
  }
  if (activeCall.status === 'in_progress' && activeCall.technician_badge_id === badge.badge_id) {
    return {
      action: 'already_in_progress',
      call: activeCall,
      machine_name: reader.machine_name,
    };
  }
  if (activeCall.status === 'suspended') {
    const resumed = await repo.resumeCall(db, {
      callId: activeCall.call_id,
      badgeId: badge.badge_id,
      technicianId: badge.technician_id,
      personName: badge.person_name,
    });
    const call = { ...resumed, machine_name: reader.machine_name };
    return {
      action: 'call_resumed',
      call,
      machine_name: reader.machine_name,
      emit: { event: 'maintenance_call_updated', payload: call },
    };
  }
  const updated = await repo.acknowledgeCall(db, {
    callId: activeCall.call_id,
    badgeId: badge.badge_id,
    technicianId: badge.technician_id,
    personName: badge.person_name,
  });
  const call = { ...updated, machine_name: reader.machine_name };
  return {
    action: 'call_acknowledged',
    call,
    machine_name: reader.machine_name,
    emit: { event: 'maintenance_call_updated', payload: call },
  };
};

module.exports = { handleBadgeSwipe, DomainError };
