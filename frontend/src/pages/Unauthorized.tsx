import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Container, Typography, Paper, Box } from '@mui/material';
import { Lock as LockIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

/**
 * Unauthorized page component
 * 
 * This component is shown when a user tries to access a route they don't have permission for
 */
const Unauthorized: React.FC = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();

  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ p: 4, mt: 8, textAlign: 'center', borderRadius: 2 }}>
        <Box display="flex" flexDirection="column" alignItems="center" gap={3}>
          <LockIcon sx={{ fontSize: 80, color: 'error.main' }} />
          
          <Typography variant="h4" component="h1" gutterBottom>
            Access Denied
          </Typography>
          
          <Typography variant="body1" paragraph>
            You don't have permission to access this page.
          </Typography>
          
          {userRole && (
            <Typography variant="body2" color="textSecondary">
              Current role: <strong>{userRole.toUpperCase()}</strong>
            </Typography>
          )}
          
          <Box mt={2}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/')}
              sx={{ mr: 2 }}
            >
              Go to Dashboard
            </Button>
            
            <Button
              variant="outlined"
              onClick={() => navigate(-1)}
            >
              Go Back
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default Unauthorized; 