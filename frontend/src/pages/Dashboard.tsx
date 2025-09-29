import React, { useEffect, useState, useRef } from 'react';
import { Container, Alert, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { BarChart } from '@mui/icons-material';
import LowStockReport from '../components/LowStockReport';
import PMCalendar, { PMCalendarRef } from '../components/PMCalendar';
import DashboardCard from '../components/DashboardCard';
import FiservButton from '../components/FiservButton';
import POStatusCard from '../components/purchaseOrders/POStatusCard';
import axiosInstance from '../utils/axios';
import { socket } from '../utils/socket';
import { DashboardData } from '../types';
import { useAuth } from '../contexts/AuthContext';

const Dashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const calendarRef = useRef<PMCalendarRef>(null);
  const exportRef = useRef<(() => void) | null>(null);
  const navigate = useNavigate();
  const { hasPermission, userRole } = useAuth();

  // Check if user can manage purchase orders
  const canManagePurchaseOrders = hasPermission('CAN_MANAGE_PURCHASE_ORDERS');
  
  // Check if user is a tech user (PM should be more prominent)
  const isTechUser = userRole === 'tech';

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axiosInstance.get<DashboardData>('/api/v1/dashboard');
      setDashboardData(response.data);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    socket.on('stock-update', (data) => {
      console.log('Stock update received:', data);
      fetchDashboardData();
    });

    socket.on('dashboard-update', () => {
      console.log('Dashboard update received');
      fetchDashboardData();
    });

    return () => {
      socket.off('stock-update');
      socket.off('dashboard-update');
    };
  }, []);

  if (loading) {
    return (
      <div style={{ backgroundColor: '#d1d5db', minHeight: '100vh', padding: '5px' }}>
        <div className="d-flex justify-content-center align-items-center" style={{ 
          minHeight: 'calc(100vh - 10px)', 
          backgroundColor: '#0066A1',
          borderRadius: '12px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}>
          <Spinner animation="border" role="status" variant="primary">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ backgroundColor: '#d1d5db', minHeight: '100vh', padding: '5px' }}>
        <div style={{ 
          backgroundColor: '#0066A1',
          borderRadius: '12px',
          padding: '20px',
          minHeight: 'calc(100vh - 10px)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}>
          <Alert variant="danger">
            {error}
            <div className="mt-2">
              <FiservButton onClick={() => fetchDashboardData()}>
                Try Again
              </FiservButton>
            </div>
          </Alert>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div style={{ backgroundColor: '#d1d5db', minHeight: '100vh', padding: '5px' }}>
        <div style={{ 
          backgroundColor: '#0066A1',
          borderRadius: '12px',
          padding: '20px',
          minHeight: 'calc(100vh - 10px)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}>
          <Alert variant="warning">No dashboard data available</Alert>
        </div>
      </div>
    );
  }

  const handleDateChange = (date: Date) => {
    setCalendarDate(date);
  };

  return (
    <div style={{ backgroundColor: '#d1d5db', minHeight: '100vh', padding: '5px' }}>
      <div className="dashboard-page px-2 py-2" style={{ 
        backgroundColor: '#0066A1',
        borderRadius: '12px',
        margin: '0',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gridTemplateRows: 'auto auto',
        gap: '10px',
        height: 'calc(100vh - 10px)',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '100%',
        position: 'relative'
      }}>
        {/* PM Calendar - More prominent for tech users */}
        <div className="card shadow-sm border-0 rounded-3" style={{ 
          backgroundColor: '#f0f2f5', 
          gridColumn: isTechUser ? 'span 7' : 'span 5', // Slightly smaller for tech users to give more space to Stock Status
          gridRow: isTechUser ? 'span 2' : 'span 2', // Full height for tech users
          overflow: 'auto',
          height: 'calc(100vh - 20px)'
        }}>
          <div className="card-body p-2" style={{ height: '100%' }}>
            <div style={{ height: '100%' }}>
              <PMCalendar
                ref={calendarRef}
                defaultDate={calendarDate}
                onDateChange={handleDateChange}
              />
            </div>
          </div>
        </div>

        {/* Inventory Status Alerts - Wider for tech users */}
        <div className="card shadow-sm border-0 rounded-3" style={{ 
          backgroundColor: '#f0f2f5', 
          gridColumn: isTechUser ? 'span 5' : 'span 7', // Wider for tech users
          gridRow: isTechUser ? 'span 2' : (canManagePurchaseOrders ? 'span 1' : 'span 2'), // Same height as PM for tech users
          overflow: 'auto',
          height: isTechUser ? 'calc(100vh - 20px)' : (canManagePurchaseOrders ? 'calc(50vh - 10px)' : 'calc(100vh - 20px)')
        }}>
          <div className="card-body p-2">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <h5 className="card-title mb-0" style={{ color: '#FF6200', fontSize: '1.1rem' }}>
                {isTechUser ? 'Stock Status' : 'Inventory Status Alerts'}
              </h5>
              <div className="d-flex gap-2">
                <FiservButton 
                  onClick={() => exportRef.current && exportRef.current()} 
                  size="sm"
                  variant="outline"
                >
                  Export to Excel
                </FiservButton>
                {canManagePurchaseOrders && (
                  <FiservButton onClick={() => navigate('/purchase-orders')} size="sm">
                    View Purchase Orders
                  </FiservButton>
                )}
              </div>
            </div>
            <LowStockReport 
              data={[
                ...(dashboardData.outOfStockParts || []),
                ...(dashboardData.lowStockParts || [])
              ]}
              exportRef={exportRef}
            />
          </div>
        </div>

        {/* Purchase Order Status - Only show for non-tech users when they have permission */}
        {canManagePurchaseOrders && !isTechUser && (
          <div className="card shadow-sm border-0 rounded-3" style={{ 
            backgroundColor: '#f0f2f5', 
            gridColumn: 'span 7', // Full width for non-tech users
            gridRow: 'span 1',
            overflow: 'auto',
            height: 'calc(50vh - 10px)'
          }}>
            <div className="card-body p-2">
              <POStatusCard
                pendingCount={dashboardData.pendingPOCount || 0}
                approvedCount={dashboardData.approvedPOCount || 0}
                rejectedCount={dashboardData.rejectedPOCount || 0}
                totalCount={dashboardData.totalPOCount || 0}
                recentPOs={dashboardData.recentPurchaseOrders || []}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;