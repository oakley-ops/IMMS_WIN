import { createTheme } from '@mui/material';

// Fiserv colors
export const FISERV_BLUE = '#0066A1';
export const FISERV_ORANGE = '#FF6200';
export const FISERV_ORANGE_DARK = '#e55800';

// Common styles
export const commonStyles = {
  button: {
    fontWeight: 'medium',
    textTransform: 'none',
    fontSize: '1rem',
  },
  navButton: {
    fontWeight: 'medium',
    textTransform: 'none',
    fontSize: '1rem',
    color: FISERV_ORANGE,
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
  },
  loginButton: {
    mt: 2,
    py: 1.5,
    textTransform: 'none',
    fontSize: '1.1rem',
    backgroundColor: FISERV_ORANGE,
    '&:hover': {
      backgroundColor: FISERV_ORANGE_DARK,
    },
  },
  title: {
    color: FISERV_ORANGE,
    fontWeight: 'bold',
    mb: 3,
  },
  subtitle: {
    mb: 4,
    color: FISERV_BLUE,
  },
  container: {
    minHeight: '100vh',
    backgroundColor: FISERV_BLUE,
    display: 'flex',
    alignItems: 'center',
  },
};

// Theme configuration
export const theme = createTheme({
  palette: {
    primary: {
      main: FISERV_BLUE,
    },
    secondary: {
      main: FISERV_ORANGE,
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    button: {
      textTransform: 'none',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
}); 