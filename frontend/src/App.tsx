import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Unauthorized from './pages/Unauthorized';
import Dashboard from './pages/Dashboard';
import KPIDashboard from './pages/KPIDashboard';
import Parts from './pages/Parts';
import Machines from './pages/Machines';
import TransactionHistory from './components/TransactionHistory';
import Navigation from './components/Navigation';
import PurchaseOrders from './pages/PurchaseOrders';
import MachineCostReport from './components/MachineCostReport';
import PurchaseOrderList from './components/purchaseOrders/PurchaseOrderList';
import PurchaseOrderDetail from './components/purchaseOrders/PurchaseOrderDetail';
import GeneratePurchaseOrders from './components/purchaseOrders/GeneratePurchaseOrders';
import ManualPOForm from './components/purchaseOrders/ManualPOForm';
import SupplierManagement from './components/suppliers/SupplierManagement';
import SupplierPartsList from './components/suppliers/SupplierPartsList';
import UserManagement from './pages/UserManagement';
import ProjectList from './components/projects/ProjectList';
import ProjectTimeline from './components/projects/ProjectTimeline';
// Comment out or remove this import since it's creating an error
// import TestPOPage from './pages/TestPOPage';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          
          {/* Root path - redirect to dashboard which will check auth */}
          <Route 
            path="/" 
            element={<Navigate to="/dashboard" replace />} 
          />
          
          {/* Dashboard Route - accessible to all authenticated users */}
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute>
                <Navigation>
                  <Dashboard />
                </Navigation>
              </ProtectedRoute>
            }
          />
          
          {/* KPI Dashboard - requires CAN_VIEW_ALL permission */}
          <Route
            path="/kpi-dashboard"
            element={
              <ProtectedRoute requiredPermission="CAN_VIEW_ALL">
                <Navigation>
                  <KPIDashboard />
                </Navigation>
              </ProtectedRoute>
            }
          />
          
          {/* Parts - accessible to all authenticated users */}
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
          
          {/* Machines - requires CAN_VIEW_ALL permission */}
          <Route
            path="/machines/*"
            element={
              <ProtectedRoute requiredPermission="CAN_VIEW_ALL">
                <Navigation>
                  <Machines />
                </Navigation>
              </ProtectedRoute>
            }
          />
          
          {/* Machine Costs - requires CAN_VIEW_ALL permission */}
          <Route
            path="/machine-costs/*"
            element={
              <ProtectedRoute requiredPermission="CAN_VIEW_ALL">
                <Navigation>
                  <MachineCostReport />
                </Navigation>
              </ProtectedRoute>
            }
          />
          
          {/* Transactions - requires CAN_VIEW_TRANSACTIONS permission */}
          <Route
            path="/transactions/*"
            element={
              <ProtectedRoute requiredPermission="CAN_VIEW_TRANSACTIONS">
                <Navigation>
                  <TransactionHistory />
                </Navigation>
              </ProtectedRoute>
            }
          />
          
          {/* Projects - requires CAN_MANAGE_PROJECTS permission */}
          <Route
            path="/projects"
            element={
              <ProtectedRoute 
                requiredPermission="CAN_MANAGE_PROJECTS"
                fallbackToPublic={true}
              >
                <Navigation>
                  <ProjectList />
                </Navigation>
              </ProtectedRoute>
            }
          />
          
          {/* Project Timeline */}
          <Route
            path="/projects/:projectId/timeline"
            element={
              <ProtectedRoute
                requiredPermission="CAN_MANAGE_PROJECTS"
                fallbackToPublic={true}
              >
                <Navigation>
                  <ProjectTimeline />
                </Navigation>
              </ProtectedRoute>
            }
          />
          
          {/* Purchase Orders - requires CAN_MANAGE_PURCHASE_ORDERS permission */}
          <Route
            path="/purchase-orders"
            element={
              <ProtectedRoute 
                requiredPermission="CAN_MANAGE_PURCHASE_ORDERS"
                fallbackToPublic={true}
              >
                <Navigation>
                  <PurchaseOrders />
                </Navigation>
              </ProtectedRoute>
            }
          >
            <Route index element={<PurchaseOrderList />} />
            <Route path="detail/:id" element={<PurchaseOrderDetail />} />
            <Route path="create" element={<GeneratePurchaseOrders />} />
            <Route path="create-manual" element={<ManualPOForm />} />
            <Route path="suppliers" element={<SupplierManagement />} />
            <Route path="suppliers/:id/parts" element={<SupplierPartsList />} />
            <Route path="*" element={<Navigate to="/purchase-orders" replace />} />
          </Route>
          
          {/* User Management - requires CAN_MANAGE_USERS permission */}
          <Route
            path="/users"
            element={
              <ProtectedRoute requiredPermission="CAN_MANAGE_USERS">
                <Navigation>
                  <UserManagement />
                </Navigation>
              </ProtectedRoute>
            }
          />
          
          {/* Test PO Page - Public route, no authentication required */}
          <Route path="/test-po" element={<div>Test PO Page</div>} />
          
          {/* Catch-all route - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;