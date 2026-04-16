import { createTheme } from '@mui/material';

// IMMS colors (keeping the same color scheme)
export const IMMS_BLUE = '#0066A1';
export const IMMS_ORANGE = '#FF6200';
export const IMMS_ORANGE_DARK = '#e55800';

// Keep legacy exports for compatibility
export const IMMS_BLUE = IMMS_BLUE;
export const IMMS_ORANGE = IMMS_ORANGE;
export const IMMS_ORANGE_DARK = IMMS_ORANGE_DARK;

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
    color: IMMS_ORANGE,
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
  },
  loginButton: {
    mt: 2,
    py: 1.5,
    textTransform: 'none',
    fontSize: '1.1rem',
    backgroundColor: IMMS_ORANGE,
    '&:hover': {
      backgroundColor: IMMS_ORANGE_DARK,
    },
  },
  title: {
    color: IMMS_ORANGE,
    fontWeight: 'bold',
    mb: 3,
  },
  subtitle: {
    mb: 4,
    color: IMMS_BLUE,
  },
  container: {
    minHeight: '100vh',
    backgroundColor: IMMS_BLUE,
    display: 'flex',
    alignItems: 'center',
  },
};

// Theme configuration
export const theme = createTheme({
  palette: {
    primary: {
      main: IMMS_BLUE,
    },
    secondary: {
      main: IMMS_ORANGE,
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