import React from 'react';
import {
  Box,
  Grid,
  Typography,
  Paper,
} from '@mui/material';

interface DieOverviewTabProps {
  die: any;
  onRefresh: () => void;
}

const DieOverviewTab: React.FC<DieOverviewTabProps> = ({ die }) => {
  const formatDate = (date: string | undefined) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
              Basic Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Die Number
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  {die.die_number}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Type
                </Typography>
                <Typography variant="body1">{die.die_type}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Current Status
                </Typography>
                <Typography variant="body1">{die.status.replace(/_/g, ' ')}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Created Date
                </Typography>
                <Typography variant="body1">{formatDate(die.created_at)}</Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
              Current Assignment
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Location
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  {die.machine_name || die.current_location || 'Storage'}
                </Typography>
              </Grid>
              {die.machine_name && (
                <>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Installed Date
                    </Typography>
                    <Typography variant="body2">{formatDate(die.die_installed_date)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Installed By
                    </Typography>
                    <Typography variant="body2">{die.die_installed_by || 'N/A'}</Typography>
                  </Grid>
                </>
              )}
            </Grid>
          </Paper>
        </Grid>

        {die.notes && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold' }}>
                Notes
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                {die.notes}
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default DieOverviewTab;
