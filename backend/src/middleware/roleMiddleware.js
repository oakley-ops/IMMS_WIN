/**
 * Role-based authorization middleware
 * This middleware checks if the user has one of the allowed roles
 * It should be used after the authentication middleware
 */

const roleAuthorization = (allowedRoles) => {
  return (req, res, next) => {
    // Check if req.user exists (should be set by authMiddleware)
    if (!req.user) {
      console.error('Role middleware: No user in request');
      return res.status(401).json({ 
        error: 'Unauthorized. Authentication required.' 
      });
    }
    
    // Get the user role from req.user
    const userRole = req.user.role;
    
    // Log for debugging
    console.log(`Role middleware: User ${req.user.username} with role "${userRole}" accessing endpoint. Allowed roles:`, allowedRoles);
    
    // Check if the role is defined
    if (!userRole) {
      console.error(`Role middleware: User ${req.user.username} has no role defined`);
      return res.status(403).json({ 
        error: 'Access forbidden. No role assigned to user.',
        requiredRoles: allowedRoles
      });
    }
    
    // Admin role has access to all endpoints
    if (userRole === 'admin') {
      return next();
    }
    
    // Check if the user's role is in the allowed roles
    if (!allowedRoles.includes(userRole)) {
      console.error(`Role middleware: User ${req.user.username} with role "${userRole}" denied access. Required roles:`, allowedRoles);
      return res.status(403).json({ 
        error: 'Access forbidden. Insufficient permissions.',
        requiredRoles: allowedRoles,
        userRole
      });
    }
    
    // User has the required role, proceed to the next middleware/controller
    next();
  };
};

module.exports = roleAuthorization; 