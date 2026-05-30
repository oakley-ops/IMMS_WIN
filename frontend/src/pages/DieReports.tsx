import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Tabs,
  Tab,
} from '@mui/material';
import DieUsageReport from '../components/dies/reports/DieUsageReport';
import CostAnalysisReport from '../components/dies/reports/CostAnalysisReport';
import PredictiveMaintenanceReport from '../components/dies/reports/PredictiveMaintenanceReport';

const DieReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 6, height: 40, bgcolor: '#FF6B35', borderRadius: 1 }} />
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            Die Reports & Analytics
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Analyze die usage, costs, and maintenance patterns
        </Typography>
      </Box>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab label="Usage Analysis" />
            <Tab label="Cost Analysis" />
            <Tab label="Predictive Maintenance" />
          </Tabs>
        </Box>
        <CardContent>
          {activeTab === 0 && <DieUsageReport />}
          {activeTab === 1 && <CostAnalysisReport />}
          {activeTab === 2 && <PredictiveMaintenanceReport />}
        </CardContent>
      </Card>
    </Box>
  );
};

export default DieReports;
