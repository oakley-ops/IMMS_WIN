const EVENTS = {
  INVENTORY_LOW: 'inventory.low',
  INVENTORY_OUT: 'inventory.out',
  INVENTORY_DIGEST: 'inventory.digest',
  PO_SUBMITTED: 'po.submitted',
  PO_APPROVED: 'po.approved',
  PO_RECEIVED: 'po.received',
  PO_ON_HOLD: 'po.on_hold',
  PO_REJECTED: 'po.rejected',
};

// Which channels each event uses. Email carries everything; SMS only the urgent subset.
const CHANNEL_MATRIX = {
  'inventory.low': ['email'],
  'inventory.out': ['email', 'sms'],
  'inventory.digest': ['email'],
  'po.submitted': ['email'],
  'po.approved': ['email', 'sms'],
  'po.received': ['email'],
  'po.on_hold': ['email', 'sms'],
  'po.rejected': ['email', 'sms'],
};

const RECIPIENT_ROLES = ['admin', 'purchasing'];

module.exports = { EVENTS, CHANNEL_MATRIX, RECIPIENT_ROLES };
