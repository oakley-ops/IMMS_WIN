import React, { useEffect, useState } from 'react';
import {
  Box,
  Alert,
  CircularProgress,
  Button,
  Typography,
  Grid,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import InventoryHealthCard from '../components/analytics/InventoryHealthCard';
import CostAnalysisCard from '../components/analytics/CostAnalysisCard';
import UsagePatternsCard from '../components/analytics/UsagePatternsCard';
import axiosInstance from '../utils/axios';
import { DashboardData } from '../types';
import { analyticsService, InventoryHealth, UsagePatterns, CostAnalysis } from '../services/analyticsService';
import { PAGE_BG, PRIMARY_ORANGE } from '../theme';

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
  const [exportingPDF, setExportingPDF] = useState(false);
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

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      console.log('Requesting PDF export (Puppeteer - Chrome rendering)...');
      const pdfBlob = await analyticsService.exportAnalyticsPDFPuppeteer();

      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      const filename = `analytics-report-${new Date().toISOString().split('T')[0]}.pdf`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log('PDF downloaded successfully!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again or check the console for details.');
    } finally {
      setExportingPDF(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ px: 4, py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" sx={{ minHeight: '60vh' }}>
          <CircularProgress color="primary" />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ px: 4, py: 4 }}>
        <Alert
          severity="error"
          action={
            <Button
              color="error"
              variant="outlined"
              size="small"
              onClick={() => {
                setError(null);
                setLoading(true);
                fetchDashboardData();
              }}
            >
              Try Again
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  if (!dashboardData) {
    return (
      <Box sx={{ px: 4, py: 4 }}>
        <Alert severity="warning">No dashboard data available</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 3, py: 3, backgroundColor: PAGE_BG, minHeight: '100%' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700}>
          KPI Dashboard
        </Typography>
        <Box display="flex" gap={1}>
          <Button
            variant="contained"
            onClick={handleExportPDF}
            disabled={exportingPDF || !analyticsData.inventoryHealth}
            sx={{
              backgroundColor: PRIMARY_ORANGE,
              '&:hover': { backgroundColor: PRIMARY_ORANGE, filter: 'brightness(0.9)' },
              fontWeight: 600,
            }}
            startIcon={exportingPDF ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {exportingPDF ? 'Generating PDF...' : '📄 Export PDF Report'}
          </Button>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate('/dashboard')}
          >
            Back to Dashboard
          </Button>
        </Box>
      </Box>

      {/* Analytics Cards Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          {analyticsData.inventoryHealth && (
            <InventoryHealthCard data={analyticsData.inventoryHealth} />
          )}
        </Grid>
        <Grid item xs={12} md={4}>
          {analyticsData.usagePatterns && (
            <UsagePatternsCard data={analyticsData.usagePatterns} />
          )}
        </Grid>
        <Grid item xs={12} md={4}>
          {analyticsData.costAnalysis && (
            <CostAnalysisCard data={analyticsData.costAnalysis} />
          )}
        </Grid>
      </Grid>

      {/* Charts Row - Removed */}
    </Box>
  );
};

export default KPIDashboard;
