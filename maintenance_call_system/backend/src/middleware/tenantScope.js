// maintenance_call_system/backend/src/middleware/tenantScope.js
// Single source of truth for "which tenant is this request?". Until Step 3
// wires the auth-service JWT into req.user, this returns 1 (the IMMS
// tenant) for every call. After Step 3, it returns req.user.tenant_id.
//
// Cross-app DRY shim deferred — both apps keep their own copy until/unless
// we extract a shared package.

const FALLBACK_TENANT_ID = 1; // IMMS

const currentTenantId = (req) => {
  return req?.user?.tenant_id ?? FALLBACK_TENANT_ID;
};

module.exports = { currentTenantId, FALLBACK_TENANT_ID };
