'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Card, CardContent, TextField, Button, Typography, Alert } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { MCS_ORANGE, DARK_BG } from '../theme';

const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      router.replace('/calls');
    } catch {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh" sx={{ bgcolor: DARK_BG }}>
      <Card sx={{ width: 380, bgcolor: '#1E1E1E', color: 'white' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight="bold" color={MCS_ORANGE} mb={0.5} textAlign="center">
            MCS
          </Typography>
          <Typography variant="body2" color="grey.500" textAlign="center" mb={3}>
            {process.env.NEXT_PUBLIC_SITE_NAME ? `${process.env.NEXT_PUBLIC_SITE_NAME} — Maintenance Call System` : 'Maintenance Call System'}
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <form onSubmit={handleSubmit}>
            <TextField
              label="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              fullWidth
              autoFocus
              sx={{ mb: 2, input: { color: 'white' }, label: { color: 'grey.500' } }}
              InputProps={{ sx: { borderColor: 'grey.700' } }}
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              fullWidth
              sx={{ mb: 3, input: { color: 'white' }, label: { color: 'grey.500' } }}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading || !username || !password}
              sx={{ bgcolor: MCS_ORANGE, py: 1.5, fontSize: '1rem', fontWeight: 700 }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginForm;
