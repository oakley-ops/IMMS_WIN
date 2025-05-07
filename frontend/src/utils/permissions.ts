/**
 * Permissions utility for role-based access control
 * This file defines the permissions for each role and provides utility functions
 * to check if a user has a specific permission.
 */

// Define the structure of permission sets
type PermissionSet = {
  CAN_VIEW_ALL: boolean;
  CAN_ADD_PARTS: boolean;
  CAN_DELETE_PARTS: boolean;
  CAN_CHECKOUT_PARTS: boolean;
  CAN_MANAGE_PURCHASE_ORDERS: boolean;
  CAN_VIEW_TRANSACTIONS: boolean;
  CAN_MANAGE_USERS: boolean;
  [key: string]: boolean;
};

// Define the role types
type Role = 'ADMIN' | 'TECH' | 'PURCHASING' | string;

// Define permissions for each role
export const PERMISSIONS: Record<string, PermissionSet> = {
  ADMIN: {
    CAN_VIEW_ALL: true,
    CAN_ADD_PARTS: true,
    CAN_DELETE_PARTS: true,
    CAN_CHECKOUT_PARTS: true,
    CAN_MANAGE_PURCHASE_ORDERS: true,
    CAN_VIEW_TRANSACTIONS: true,
    CAN_MANAGE_USERS: true
  },
  TECH: {
    CAN_VIEW_ALL: false,
    CAN_ADD_PARTS: false,
    CAN_DELETE_PARTS: false, 
    CAN_CHECKOUT_PARTS: true,
    CAN_MANAGE_PURCHASE_ORDERS: false,
    CAN_VIEW_TRANSACTIONS: false,
    CAN_MANAGE_USERS: false
  },
  PURCHASING: {
    CAN_VIEW_ALL: false,
    CAN_ADD_PARTS: false,
    CAN_DELETE_PARTS: false,
    CAN_CHECKOUT_PARTS: false,
    CAN_MANAGE_PURCHASE_ORDERS: true,
    CAN_VIEW_TRANSACTIONS: true,
    CAN_MANAGE_USERS: false
  }
};

/**
 * Check if a user with the given role has the specified permission
 * 
 * @param userRole The user's role (admin, tech, purchasing)
 * @param permission The permission to check
 * @returns True if the user has the permission, false otherwise
 */
export const hasPermission = (userRole: string | undefined, permission: string): boolean => {
  if (!userRole) {
    console.warn('hasPermission: No user role provided');
    return false;
  }
  
  // Log debug info
  console.log(`Checking permission "${permission}" for role "${userRole}"`);
  
  // Admin role has all permissions by default
  if (userRole.toLowerCase() === 'admin') {
    return true;
  }
  
  // Get the normalized role
  const normalizedRole = userRole.toUpperCase();
  
  // Handle case where role permissions aren't defined
  if (!PERMISSIONS[normalizedRole]) {
    console.warn(`Unknown role: ${userRole}. Defaulting to no permissions.`);
    
    // Special case for purchase orders - enable for all users temporarily
    if (permission === 'CAN_MANAGE_PURCHASE_ORDERS' || permission === 'CAN_VIEW_TRANSACTIONS') {
      console.log(`Granting ${permission} to user with role ${userRole} temporarily`);
      return true;
    }
    
    return false;
  }
  
  return PERMISSIONS[normalizedRole][permission] || false;
};

/**
 * Get all permissions for a specific role
 * 
 * @param role The role to get permissions for
 * @returns An object containing all permissions for the role
 */
export const getPermissionsForRole = (role: string): PermissionSet => {
  // Admin role should return all permissions set to true,
  // regardless of what's defined in PERMISSIONS
  if (role.toLowerCase() === 'admin') {
    return Object.keys(PERMISSIONS.ADMIN).reduce((allPermissions, key) => {
      allPermissions[key] = true;
      return allPermissions;
    }, {} as PermissionSet);
  }
  
  const normalizedRole = role.toUpperCase();
  
  if (!PERMISSIONS[normalizedRole]) {
    console.warn(`Unknown role: ${role}. Defaulting to basic permissions.`);
    return {
      CAN_VIEW_ALL: false,
      CAN_ADD_PARTS: false,
      CAN_DELETE_PARTS: false,
      CAN_CHECKOUT_PARTS: true,
      CAN_MANAGE_PURCHASE_ORDERS: true, // Allow purchase order access to all users temporarily
      CAN_VIEW_TRANSACTIONS: true, // Allow transaction access to all users temporarily
      CAN_MANAGE_USERS: false
    };
  }
  
  return PERMISSIONS[normalizedRole];
}; 