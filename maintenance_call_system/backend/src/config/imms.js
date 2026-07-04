// Base URL of the IMMS API (the app that owns the parts/inventory tables).
// Used for the one cross-app write MCS makes: decrementing part quantity
// when a technician logs parts used on a resolved call.
const IMMS_API_URL = process.env.IMMS_API_URL || 'http://localhost:4000/api/v1';

module.exports = { IMMS_API_URL };
