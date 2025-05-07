import React, { useEffect, useState } from 'react';
import { Container, Alert, Spinner, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import StockLevelChart from '../components/StockLevelChart';
import TopUsedPartsChart from '../components/TopUsedPartsChart';
import InventoryHealthCard from '../components/analytics/InventoryHealthCard';
import CostAnalysisCard from '../components/analytics/CostAnalysisCard';
import UsagePatternsCard from '../components/analytics/UsagePatternsCard';
import axiosInstance from '../utils/axios';
import { DashboardData } from '../types';
import { analyticsService, InventoryHealth, UsagePatterns, CostAnalysis } from '../services/analyticsService';

const KPIDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [analyticsData, setAnalyticsData] = useState<{
    inventoryHealth: InventoryHealth | null;
    usagePatterns: UsagePatterns | null;
    costAnalysis: CostAnalysis | null;
  }>({
    inventoryHealth: null,
    usagePatterns: null,
    costAnalysis: null
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch regular dashboard data
      const response = await axiosInstance.get<DashboardData>('/api/v1/dashboard');
      setDashboardData(response.data);

      try {
        // Fetch analytics data
        const [inventoryHealth, usagePatterns, costAnalysis] = await Promise.all([
          analyticsService.getInventoryHealth(),
          analyticsService.getUsagePatterns(),
          analyticsService.getCostAnalysis()
        ]);

        setAnalyticsData({
          inventoryHealth,
          usagePatterns,
          costAnalysis
        });
      } catch (analyticsErr) {
        console.log('Analytics service not available:', analyticsErr);
        // Don't set the error state for analytics failures
      }
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.toString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <Container fluid className="px-4 py-4">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
          <Spinner animation="border" role="status" variant="primary">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container fluid className="px-4 py-4">
        <Alert variant="danger">
          {error}
          <div className="mt-2">
            <button 
              className="btn btn-outline-danger" 
              style={{ backgroundColor: '#0066A1', borderColor: '#0066A1', color: 'white' }}
              onClick={() => {
                setError(null);
                setLoading(true);
                fetchDashboardData();
              }}
            >
              Try Again
            </button>
          </div>
        </Alert>
      </Container>
    );
  }

  if (!dashboardData) {
    return (
      <Container fluid className="px-4 py-4">
        <Alert variant="warning">No dashboard data available</Alert>
      </Container>
    );
  }

  return (
    <div className="kpi-dashboard-page px-3 py-3" style={{ backgroundColor: '#f8f9fb' }}>
      <div className="mb-4 d-flex justify-content-between align-items-center">
        <h1 className="h2 mb-0">KPI Dashboard</h1>
        <Button 
          variant="outline-primary" 
          onClick={() => navigate('/dashboard')}
        >
          Back to Dashboard
        </Button>
      </div>
      
      {/* Analytics Cards Row */}
      <div className="row g-4 mb-4">
        <div className="col-md-4">
          {analyticsData.inventoryHealth && (
            <InventoryHealthCard data={analyticsData.inventoryHealth} />
          )}
        </div>
        <div className="col-md-4">
          {analyticsData.usagePatterns && (
            <UsagePatternsCard data={analyticsData.usagePatterns} />
          )}
        </div>
        <div className="col-md-4">
          {analyticsData.costAnalysis && (
            <CostAnalysisCard data={analyticsData.costAnalysis} />
          )}
        </div>
      </div>

      {/* Charts Row - Removed */}
    </div>
  );
};

export default KPIDashboard; 