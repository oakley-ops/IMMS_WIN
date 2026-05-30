import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import CSVUploadForm from '../components/CSVUploadForm';

const Import: React.FC = () => {
  return (
    <Box sx={{ px: 3, py: 3 }}>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 4 }}>
        Import Data
      </Typography>

      <Grid container>
        <Grid item xs={12} md={8} lg={6}>
          <Card sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <CardContent>
              <CSVUploadForm />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Import;
