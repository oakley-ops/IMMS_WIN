import { createTheme } from '@mui/material';

// ── Shared design tokens (matches MCS) ──────────────────────────────────────
export const DARK_BG = '#121212';
export const DARK_SURFACE = '#1E1E1E';
export const PRIMARY_ORANGE = '#FF6B35';
export const PAGE_BG = '#F5F5F5';

// Status colors
export const COLOR_SUCCESS = '#66BB6A';
export const COLOR_SUCCESS_BG = '#E8F5E9';
export const COLOR_SUCCESS_TEXT = '#2E7D32';
export const COLOR_ERROR = '#EF5350';
export const COLOR_ERROR_BG = '#FFEBEE';
export const COLOR_ERROR_TEXT = '#C62828';
export const COLOR_WARNING = '#FFA726';
export const COLOR_WARNING_BG = '#FFF3E0';
export const COLOR_WARNING_TEXT = '#E65100';
export const COLOR_PURPLE_BG = '#F3E5F5';
export const COLOR_PURPLE_TEXT = '#6A1B9A';

export const theme = createTheme({
  palette: {
    primary: {
      main: PRIMARY_ORANGE,
      contrastText: '#ffffff',
    },
    secondary: {
      main: DARK_SURFACE,
    },
    background: {
      default: PAGE_BG,
      paper: '#ffffff',
    },
    error: { main: COLOR_ERROR },
    success: { main: COLOR_SUCCESS },
    warning: { main: COLOR_WARNING },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 4 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
  },
});
