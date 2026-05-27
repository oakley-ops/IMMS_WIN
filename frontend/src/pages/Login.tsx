import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  ThemeProvider,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { theme, PRIMARY_ORANGE, DARK_BG } from '../theme';

// Allowlist of origins permitted as ?returnTo= targets. Without this the
// login page could be turned into an open redirect by attackers who craft a
// link to a phishing site. The list comes from REACT_APP_RETURN_TO_ALLOWLIST
// (comma-separated), with MCS dev defaults baked in so local kiosks work.
const allowedOrigins = new Set(
  (process.env.REACT_APP_RETURN_TO_ALLOWLIST ?? 'http://localhost:3003')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);

const resolveReturnTo = (raw: string | null): string | null => {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return allowedOrigins.has(url.origin) ? url.toString() : null;
  } catch {
    return null;
  }
};

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => {
    // Default to checked if previously set (for kiosk convenience)
    return localStorage.getItem('rememberMe') === 'true';
  });
  const [error, setError] = useState('');
  const { login, isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = resolveReturnTo(searchParams.get('returnTo'));

  // Already-authenticated user with a valid returnTo: forward immediately
  // using the existing token instead of asking them to log in again.
  useEffect(() => {
    if (loading || !isAuthenticated || !returnTo || !user) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    const frag = `token=${encodeURIComponent(token)}&user=${encodeURIComponent(btoa(JSON.stringify(user)))}`;
    window.location.replace(`${returnTo}#${frag}`);
  }, [loading, isAuthenticated, returnTo, user]);

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, display: 'flex', justifyContent: 'center' }}>
        <Typography>Loading...</Typography>
      </Container>
    );
  }

  if (isAuthenticated && !returnTo) {
    return <Navigate to="/" />;
  }

  if (isAuthenticated && returnTo) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, display: 'flex', justifyContent: 'center' }}>
        <Typography>Redirecting...</Typography>
      </Container>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { token, user } = await login(username, password, rememberMe);
      if (returnTo) {
        const frag = `token=${encodeURIComponent(token)}&user=${encodeURIComponent(btoa(JSON.stringify(user)))}`;
        window.location.replace(`${returnTo}#${frag}`);
        return;
      }
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to login');
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: DARK_BG,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Container maxWidth="xs">
          <Paper
            elevation={8}
            sx={{
              p: 4,
              borderRadius: 2,
              borderTop: `4px solid ${PRIMARY_ORANGE}`,
            }}
          >
            <Typography
              variant="h4"
              component="h1"
              align="center"
              sx={{ color: PRIMARY_ORANGE, fontWeight: 'bold', mb: 0.5 }}
            >
              IMMS
            </Typography>
            <Typography
              variant="subtitle1"
              align="center"
              sx={{ color: 'text.secondary', mb: 3 }}
            >
              Inventory Management System
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                label="Username"
                fullWidth
                margin="normal"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                sx={{ mb: 1 }}
              />
              <TextField
                label="Password"
                type="password"
                fullWidth
                margin="normal"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                sx={{ mb: 1 }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    color="primary"
                  />
                }
                label="Remember Me"
                sx={{ mb: 2 }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                size="large"
                sx={{ py: 1.5, fontSize: '1rem' }}
              >
                Login
              </Button>
            </form>
          </Paper>
        </Container>
      </Box>
    </ThemeProvider>
  );
};

export default Login; 