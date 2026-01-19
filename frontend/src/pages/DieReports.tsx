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
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#0066A1' }}>
          Die Reports & Analytics
        </Typography>
        <Typography variant="body2" color="text.secondary">
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
