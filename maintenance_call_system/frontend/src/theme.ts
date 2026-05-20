import { createTheme } from '@mui/material/styles';

export const MCS_ORANGE = '#FF6B35';
export const STATUS_OPEN = '#EF5350';
export const STATUS_IN_PROGRESS = '#FFA726';
export const STATUS_RESOLVED = '#66BB6A';
export const STATUS_SUSPENDED = '#7E57C2';
export const STATUS_CRITICAL = '#D32F2F';
export const DARK_BG = '#121212';
export const DARK_SURFACE = '#1E1E1E';

export const theme = createTheme({
  palette: {
    primary: { main: MCS_ORANGE, contrastText: '#fff' },
    secondary: { main: '#37474F' },
    background: { default: '#F5F5F5', paper: '#FFFFFF' },
    error: { main: STATUS_OPEN },
    warning: { main: STATUS_IN_PROGRESS },
    success: { main: STATUS_RESOLVED },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
  },
});
