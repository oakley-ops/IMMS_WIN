import React, { useEffect, useState, useRef } from 'react';
import { Box, Alert, CircularProgress, Button, Typography, Card, CardContent } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import LowStockReport from '../components/LowStockReport';
import PMCalendar, { PMCalendarRef } from '../components/PMCalendar';
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
      <Box sx={{ backgroundColor: '#d1d5db', minHeight: '100vh', padding: '5px' }}>
        <Box sx={{
          minHeight: 'calc(100vh - 10px)',
          backgroundColor: '#f3f4f6',
          borderRadius: '12px',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <CircularProgress color="primary" aria-label="Loading" />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ backgroundColor: '#d1d5db', minHeight: '100vh', padding: '5px' }}>
        <Box sx={{
          backgroundColor: '#f3f4f6',
          borderRadius: '12px',
          padding: '20px',
          minHeight: 'calc(100vh - 10px)',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
        }}>
          <Alert severity="error" role="alert">
            {error}
            <Box sx={{ mt: 1 }}>
              <Button variant="contained" color="primary" onClick={() => fetchDashboardData()}>
                Try Again
              </Button>
            </Box>
          </Alert>
        </Box>
      </Box>
    );
  }

  if (!dashboardData) {
    return (
      <Box sx={{ backgroundColor: '#d1d5db', minHeight: '100vh', padding: '5px' }}>
        <Box sx={{
          backgroundColor: '#f3f4f6',
          borderRadius: '12px',
          padding: '20px',
          minHeight: 'calc(100vh - 10px)',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
        }}>
          <Alert severity="warning">No dashboard data available</Alert>
        </Box>
      </Box>
    );
  }

  const handleDateChange = (date: Date) => {
    setCalendarDate(date);
  };

  return (
    <Box sx={{ backgroundColor: '#d1d5db', minHeight: '100vh', padding: '5px' }}>
      <Box sx={{
        backgroundColor: '#f3f4f6',
        borderRadius: '12px',
        margin: '0',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gridTemplateRows: 'auto auto',
        gap: '10px',
        height: 'calc(100vh - 10px)',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '100%',
        position: 'relative',
        padding: '8px',
      }}>
        {/* PM Calendar - More prominent for tech users */}
        <Card sx={{
          backgroundColor: '#f0f2f5',
          gridColumn: isTechUser ? 'span 7' : 'span 5',
          gridRow: 'span 2',
          overflow: 'auto',
          height: 'calc(100vh - 20px)',
          borderRadius: 2,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          border: 'none',
        }}>
          <CardContent sx={{ height: '100%', p: 1, '&:last-child': { pb: 1 } }}>
            <Box sx={{ height: '100%' }}>
              <PMCalendar
                ref={calendarRef}
                defaultDate={calendarDate}
                onDateChange={handleDateChange}
              />
            </Box>
          </CardContent>
        </Card>

        {/* Inventory Status Alerts - Wider for tech users */}
        <Card sx={{
          backgroundColor: '#f0f2f5',
          gridColumn: isTechUser ? 'span 5' : 'span 7',
          gridRow: isTechUser ? 'span 2' : (canManagePurchaseOrders ? 'span 1' : 'span 2'),
          overflow: 'auto',
          height: isTechUser ? 'calc(100vh - 20px)' : (canManagePurchaseOrders ? 'calc(50vh - 10px)' : 'calc(100vh - 20px)'),
          borderRadius: 2,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          border: 'none',
        }}>
          <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="subtitle1" sx={{ color: '#FF6200', fontSize: '1.1rem', fontWeight: 600 }}>
                {isTechUser ? 'Stock Status' : 'Inventory Status Alerts'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => exportRef.current && exportRef.current()}
                >
                  Export to Excel
                </Button>
                {canManagePurchaseOrders && (
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    onClick={() => navigate('/purchase-orders')}
                  >
                    View Purchase Orders
                  </Button>
                )}
              </Box>
            </Box>
            <LowStockReport
              data={[
                ...(dashboardData.outOfStockParts || []),
                ...(dashboardData.lowStockParts || [])
              ]}
              exportRef={exportRef}
            />
          </CardContent>
        </Card>

        {/* Purchase Order Status - Only show for non-tech users when they have permission */}
        {canManagePurchaseOrders && !isTechUser && (
          <Card sx={{
            backgroundColor: '#f0f2f5',
            gridColumn: 'span 7',
            gridRow: 'span 1',
            overflow: 'auto',
            height: 'calc(50vh - 10px)',
            borderRadius: 2,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: 'none',
          }}>
            <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
              <POStatusCard
                pendingCount={dashboardData.pendingPOCount || 0}
                approvedCount={dashboardData.approvedPOCount || 0}
                rejectedCount={dashboardData.rejectedPOCount || 0}
                totalCount={dashboardData.totalPOCount || 0}
                recentPOs={dashboardData.recentPurchaseOrders || []}
              />
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
};

export default Dashboard;
