# Role-Based Access Control Implementation Plan

## Overview

This document outlines the implementation plan for role-based access control in the Tech Inventory system. Currently, the system has a single admin role with full access. We will implement three distinct roles:

1. **Admin**: Full access to all functionalities (existing)
2. **Tech**: Limited access to parts checkout, search, and dashboard for PMs
3. **Purchasing**: Limited access to purchase orders and transactions

## Testing Strategy (Pre-Implementation)

Before implementing any changes to the main codebase:

1. **Create a Test Branch**: 
   ```bash
   git checkout -b feature/role-based-access-control
   ```

2. **Write Unit Tests**:
   - Test backend role validation
   - Test permission checks
   - Test route protection

3. **Create Integration Tests**:
   - Test API endpoints with different role permissions
   - Test authentication flow with roles

4. **Create UI Tests**:
   - Test conditional rendering based on roles
   - Test navigation visibility
   - Test button disabling

5. **Manual Test Plan**:
   - Create test users for each role
   - Create a test checklist for each role's permissions
   - Verify proper access control across all features

## Implementation Plan

### 1. Backend Changes

#### User Model and Database Updates

1. Update the `users` table schema to properly utilize roles:
   ```sql
   ALTER TABLE users
   ALTER COLUMN role TYPE VARCHAR(20),
   ADD CONSTRAINT valid_role CHECK (role IN ('admin', 'tech', 'purchasing'));
   ```

2. Create migration scripts for existing users

#### Authentication Controller Updates

Update the AuthController to handle role-specific authentication:

```javascript
// AuthController.js
async login(req, res) {
  // Existing login logic...
  
  // Include role information in JWT payload
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  // Return user info with role
  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    },
    token
  });
}
```

#### Authorization Middleware

Create a role-based authorization middleware:

```javascript
// roleMiddleware.js
const roleAuthorization = (allowedRoles) => {
  return (req, res, next) => {
    // JWT already verified by authMiddleware
    const userRole = req.user.role;
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Access forbidden. Insufficient permissions.' });
    }
    
    next();
  };
};

module.exports = roleAuthorization;
```

#### API Route Protection

Update API routes to use role-based authorization:

```javascript
// routes/parts.js
router.post('/api/parts', 
  authMiddleware, 
  roleAuthorization(['admin']), 
  partsController.createPart
);

router.get('/api/parts',
  authMiddleware,
  roleAuthorization(['admin', 'tech', 'purchasing']),
  partsController.getParts
);

router.delete('/api/parts/:id',
  authMiddleware,
  roleAuthorization(['admin']),
  partsController.deletePart
);
```

### 2. Frontend Changes

#### Permission Utilities

Create a permissions utility file:

```typescript
// src/utils/permissions.ts
export const PERMISSIONS = {
  ADMIN: {
    CAN_VIEW_ALL: true,
    CAN_ADD_PARTS: true,
    CAN_DELETE_PARTS: true,
    CAN_CHECKOUT_PARTS: true,
    CAN_MANAGE_PURCHASE_ORDERS: true,
    CAN_VIEW_TRANSACTIONS: true
  },
  TECH: {
    CAN_VIEW_ALL: false,
    CAN_ADD_PARTS: false,
    CAN_DELETE_PARTS: false, 
    CAN_CHECKOUT_PARTS: true,
    CAN_MANAGE_PURCHASE_ORDERS: false,
    CAN_VIEW_TRANSACTIONS: false
  },
  PURCHASING: {
    CAN_VIEW_ALL: false,
    CAN_ADD_PARTS: false,
    CAN_DELETE_PARTS: false,
    CAN_CHECKOUT_PARTS: false,
    CAN_MANAGE_PURCHASE_ORDERS: true,
    CAN_VIEW_TRANSACTIONS: true
  }
};

export const hasPermission = (userRole, permission) => {
  if (!userRole || !PERMISSIONS[userRole.toUpperCase()]) return false;
  return PERMISSIONS[userRole.toUpperCase()][permission] || false;
};
```

#### Enhanced AuthContext

Update the AuthContext to include role-based permissions:

```typescript
// src/contexts/AuthContext.tsx
interface User {
  id: number;
  username: string;
  name: string;
  role: string;
}

interface AuthContextType {
  // Existing properties
  hasPermission: (permission: string) => boolean;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Existing state and functions
  
  const checkPermission = (permission: string) => {
    if (!user || !user.role) return false;
    return hasPermission(user.role, permission);
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      user, 
      login, 
      logout: handleLogout, 
      loading,
      changePassword,
      hasPermission: checkPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
};
```

#### Enhanced Protected Route

Enhance ProtectedRoute to check for specific permissions:

```typescript
// src/components/ProtectedRoute.tsx
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredPermission }) => {
  const { isAuthenticated, loading, hasPermission } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  // Check for specific permission if required
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/unauthorized" />;
  }

  return <>{children}</>;
};
```

#### Update App Routing

Modify App.tsx to implement role-based route protection:

```typescript
// src/App.tsx
<Route
  path="/parts/*"
  element={
    <ProtectedRoute>
      <Navigation>
        <Parts />
      </Navigation>
    </ProtectedRoute>
  }
/>

<Route
  path="/purchase-orders"
  element={
    <ProtectedRoute requiredPermission="CAN_MANAGE_PURCHASE_ORDERS">
      <Navigation>
        <PurchaseOrders />
      </Navigation>
    </ProtectedRoute>
  }
>
  {/* Nested routes */}
</Route>
```

#### Update Navigation

Modify Navigation to show only relevant menu items:

```typescript
// src/components/Navigation.tsx
const navigationItems = [
  { path: '/', label: 'DASHBOARD', icon: <Dashboard />, requiredPermission: null }, // Available to all
  { path: '/parts', label: 'PARTS', icon: <Inventory />, requiredPermission: null }, // View only for techs
  { path: '/machines', label: 'MACHINES', icon: <Build />, requiredPermission: 'CAN_VIEW_ALL' },
  { path: '/transactions', label: 'TRANSACTIONS', icon: <SwapHoriz />, requiredPermission: 'CAN_VIEW_TRANSACTIONS' },
  { path: '/purchase-orders', label: 'PURCHASE ORDERS', icon: <ShoppingCart />, requiredPermission: 'CAN_MANAGE_PURCHASE_ORDERS' }
];

// In the component:
const filteredNavigationItems = navigationItems.filter(item => 
  item.requiredPermission === null || hasPermission(user?.role, item.requiredPermission)
);

// Use filteredNavigationItems for rendering
```

#### Component-Level Permission Checks

Update UI components to respect permissions:

```tsx
// Example in PartsManagement.tsx
const PartsManagement = () => {
  const { hasPermission } = useAuth();
  
  return (
    <div>
      {/* Only render if user has permission */}
      {hasPermission('CAN_ADD_PARTS') && (
        <Button onClick={handleAddPart}>Add Part</Button>
      )}
      
      {/* Or disable the button */}
      <Button 
        onClick={handleDeletePart} 
        disabled={!hasPermission('CAN_DELETE_PARTS')}
        style={{
          opacity: hasPermission('CAN_DELETE_PARTS') ? 1 : 0.5,
          cursor: hasPermission('CAN_DELETE_PARTS') ? 'pointer' : 'not-allowed'
        }}
      >
        Delete Part
      </Button>
    </div>
  );
};
```

## Feature Testing

After implementation:

1. **Unit Testing**:
   - Test the permission utility functions
   - Test AuthContext role handling

2. **Integration Testing**:
   - Test API endpoints with different role credentials
   - Test navigation rendering for different roles

3. **End-to-End Testing**:
   - Create test scenarios for each role
   - Verify proper UI rendering
   - Test all permission boundaries

## Deployment Plan

1. Complete all tests in the feature branch
2. Create a PR for review
3. Deploy to staging environment for final testing
4. Deploy to production

## User Account Management

1. **Create Role Management UI** (Admin-only):
   - Create a user management page
   - Add ability to create users with specific roles
   - Add ability to change user roles

2. **Create Role-Specific Onboarding**:
   - Add role-specific welcome screens
   - Provide role-specific tutorials

## Conclusion

This role-based access control implementation will:

1. Enhance security by restricting sensitive operations to authorized users
2. Simplify the UI for users who only need specific functionality
3. Maintain a consistent user experience through conditional UI rendering rather than completely different UIs

The implementation strategy focuses on both frontend and backend security to ensure proper access control at all levels. 