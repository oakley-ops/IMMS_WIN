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

const Dashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const calendarRef = useRef<PMCalendarRef>(null);
  const navigate = useNavigate();

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
        {/* Inventory Status Alerts - TOP LEFT */}
        <div className="card shadow-sm border-0 rounded-3" style={{ 
          backgroundColor: '#f0f2f5', 
          gridColumn: 'span 7',
          gridRow: 'span 1',
          overflow: 'auto',
          height: 'calc(50vh - 10px)'
        }}>
          <div className="card-body p-2">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <h5 className="card-title mb-0" style={{ color: '#FF6200', fontSize: '1.1rem' }}>Inventory Status Alerts</h5>
              <FiservButton onClick={() => navigate('/purchase-orders')} size="sm">
                View Purchase Orders
              </FiservButton>
            </div>
            <LowStockReport 
              data={[
                ...(dashboardData.lowStockParts || []),
                ...(dashboardData.outOfStockParts || [])
              ]} 
            />
          </div>
        </div>
        
        {/* PM Calendar - TOP RIGHT */}
        <div className="card shadow-sm border-0 rounded-3" style={{ 
          backgroundColor: '#f0f2f5', 
          gridColumn: 'span 5',
          gridRow: 'span 2',
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

        {/* Purchase Order Status - BOTTOM LEFT */}
        <div className="card shadow-sm border-0 rounded-3" style={{ 
          backgroundColor: '#f0f2f5', 
          gridColumn: 'span 7',
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
      </div>
    </div>
  );
};

export default Dashboard;