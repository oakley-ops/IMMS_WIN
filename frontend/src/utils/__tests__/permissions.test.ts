import { hasPermission, getPermissionsForRole, PERMISSIONS } from '../permissions';

describe('Permissions Utility', () => {
  describe('hasPermission', () => {
    it('should return true for admin with CAN_VIEW_ALL permission', () => {
      expect(hasPermission('admin', 'CAN_VIEW_ALL')).toBe(true);
    });
    
    it('should return true for admin with CAN_MANAGE_PURCHASE_ORDERS permission', () => {
      expect(hasPermission('admin', 'CAN_MANAGE_PURCHASE_ORDERS')).toBe(true);
    });
    
    it('should return true for admin with any permission, even unknown ones', () => {
      expect(hasPermission('admin', 'SOME_UNKNOWN_PERMISSION')).toBe(true);
    });
    
    it('should handle case insensitivity for admin role', () => {
      expect(hasPermission('Admin', 'CAN_VIEW_ALL')).toBe(true);
      expect(hasPermission('ADMIN', 'CAN_VIEW_ALL')).toBe(true);
    });
    
    it('should return true for purchasing role with CAN_MANAGE_PURCHASE_ORDERS permission', () => {
      expect(hasPermission('purchasing', 'CAN_MANAGE_PURCHASE_ORDERS')).toBe(true);
    });
    
    it('should return false for tech role with CAN_MANAGE_PURCHASE_ORDERS permission', () => {
      expect(hasPermission('tech', 'CAN_MANAGE_PURCHASE_ORDERS')).toBe(false);
    });
    
    it('should return true for tech role with CAN_CHECKOUT_PARTS permission', () => {
      expect(hasPermission('tech', 'CAN_CHECKOUT_PARTS')).toBe(true);
    });
    
    it('should return false for unknown permission for non-admin roles', () => {
      expect(hasPermission('tech', 'NON_EXISTENT_PERMISSION')).toBe(false);
      expect(hasPermission('purchasing', 'NON_EXISTENT_PERMISSION')).toBe(false);
    });
    
    it('should return false for unknown role', () => {
      expect(hasPermission('unknown_role', 'CAN_VIEW_ALL')).toBe(false);
    });
    
    it('should return false for undefined role', () => {
      expect(hasPermission(undefined, 'CAN_VIEW_ALL')).toBe(false);
    });
  });
  
  describe('getPermissionsForRole', () => {
    it('should return all permissions as true for admin role', () => {
      const adminPermissions = getPermissionsForRole('admin');
      
      // All permissions should be true for admin
      Object.keys(adminPermissions).forEach(permission => {
        expect(adminPermissions[permission]).toBe(true);
      });
    });
    
    it('should return all permissions as true for admin role even with different case', () => {
      const adminPermissions = getPermissionsForRole('ADMIN');
      
      // All permissions should be true for admin regardless of case
      Object.keys(adminPermissions).forEach(permission => {
        expect(adminPermissions[permission]).toBe(true);
      });
    });
    
    it('should return all permissions for tech role', () => {
      const techPermissions = getPermissionsForRole('tech');
      expect(techPermissions).toEqual(PERMISSIONS.TECH);
    });
    
    it('should return all permissions for purchasing role', () => {
      const purchasingPermissions = getPermissionsForRole('purchasing');
      expect(purchasingPermissions).toEqual(PERMISSIONS.PURCHASING);
    });
    
    it('should return empty object for unknown role', () => {
      const unknownPermissions = getPermissionsForRole('unknown_role');
      // Should return an object with all false permissions as defined in the function
      expect(unknownPermissions.CAN_VIEW_ALL).toBe(false);
      expect(unknownPermissions.CAN_MANAGE_PURCHASE_ORDERS).toBe(false);
    });
  });
}); 