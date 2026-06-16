const { EVENTS } = require('./config');

const STATUS_EVENT = {
  submitted: EVENTS.PO_SUBMITTED,
  approved: EVENTS.PO_APPROVED,
  received: EVENTS.PO_RECEIVED,
  on_hold: EVENTS.PO_ON_HOLD,
  rejected: EVENTS.PO_REJECTED,
};

function poEventForStatus(status) {
  return STATUS_EVENT[status] || null;
}

module.exports = { poEventForStatus };
