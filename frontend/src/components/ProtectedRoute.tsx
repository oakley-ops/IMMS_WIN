import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  fallbackToPublic?: boolean;
}

/**
 * ProtectedRoute component
 * 
 * This component checks if the user is authenticated and has the required permission
 * If not, it redirects to the login page or unauthorized page as appropriate
 * 
 * @param children The components to render if access is allowed
 * @param requiredPermission Optional specific permission required to access the route
 * @param fallbackToPublic If true, allows any authenticated user to access the route regardless of permission
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredPermission,
  fallbackToPublic = false
}) => {
  const { isAuthenticated, loading, hasPermission, userRole } = useAuth();
  const location = useLocation();

  // Show loading indicator while checking authentication
  if (loading) {
    return <div className="loading-container">Loading...</div>;
  }

  // If not authenticated, redirect to login page, remembering the intended destination
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // If a specific permission is required, check if the user has it
  if (requiredPermission) {
    // Check permissions, but optionally bypass if fallbackToPublic is true and user is authenticated
    const hasRequiredPermission = hasPermission(requiredPermission);
    console.log(`Route check: Permission "${requiredPermission}" for role "${userRole}": ${hasRequiredPermission}, fallbackEnabled: ${fallbackToPublic}`);
    
    if (!hasRequiredPermission && !fallbackToPublic) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // User is authenticated and has the required permission (or fallback is enabled), render the children
  return <>{children}</>;
};

export default ProtectedRoute; 