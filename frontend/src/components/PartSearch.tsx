import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  List,
  ListItem,
  Paper,
  Typography,
  Chip,
  CircularProgress,
} from '@mui/material';
import { useDebounce } from 'use-debounce';
import { AxiosError } from 'axios';
import { ApiErrorResponse } from '../types/api';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import {
  COLOR_ERROR_BG,
  COLOR_ERROR_TEXT,
  COLOR_WARNING_BG,
  COLOR_WARNING_TEXT,
  COLOR_SUCCESS_BG,
  COLOR_SUCCESS_TEXT,
} from '../theme';
import { searchParts, SearchHit } from '../services/searchApi';

// Hybrid search widget: hits GET /api/v1/search (FTS + vector, RRF + cross-encoder
// rerank, tenant-scoped) instead of fetching all parts and filtering client-side.
const PartSearch: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState<string[] | null>(null);
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!debouncedSearchTerm.trim()) {
        setResults([]);
        setDegraded(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await searchParts(debouncedSearchTerm, 10);
        if (cancelled) return;
        setResults(res.results);
        setDegraded(res.degraded);
      } catch (err) {
        if (cancelled) return;
        const e = err as AxiosError<ApiErrorResponse>;
        setError(e.response?.data?.error || e.response?.data?.message || 'Failed to search parts');
        setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearchTerm]);

  const getStockChip = (quantity?: number, minimum?: number) => {
    const q = quantity ?? 0;
    const m = minimum ?? 0;
    if (q <= 0) {
      return <Chip label="Out of Stock" size="small" sx={{ bgcolor: COLOR_ERROR_BG, color: COLOR_ERROR_TEXT }} />;
    }
    if (q < m) {
      return <Chip label="Low Stock" size="small" sx={{ bgcolor: COLOR_WARNING_BG, color: COLOR_WARNING_TEXT }} />;
    }
    return <Chip label="In Stock" size="small" sx={{ bgcolor: COLOR_SUCCESS_BG, color: COLOR_SUCCESS_TEXT }} />;
  };

  const formatCurrency = (value?: string | number): string => {
    if (value === undefined || value === null) return '$0.00';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(numValue) ? '$0.00' : `$${numValue.toFixed(2)}`;
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Smart Search
      </Typography>
      <TextField
        label="Search Parts"
        fullWidth
        size="small"
        placeholder="Search by description, part number, or what it's used for…"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 1 }}
      />

      {degraded && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Showing limited results ({degraded.join(', ')} unavailable).
        </Typography>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}

      {!loading && !error && results.length > 0 && (
        <List disablePadding>
          {results.map((part) => (
            <ListItem key={part.part_id} disablePadding sx={{ mb: 1 }}>
              <Paper variant="outlined" sx={{ p: 2, width: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    {part.image_url ? (
                      <img
                        src={part.image_url}
                        alt={part.name}
                        style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid #ddd' }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: 60,
                          height: 60,
                          bgcolor: 'grey.100',
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <PhotoCameraIcon sx={{ color: 'grey.400' }} />
                      </Box>
                    )}

                    <Box>
                      <Typography variant="subtitle2" fontWeight={600}>{part.name}</Typography>
                      {part.description && (
                        <Typography variant="body2" sx={{ mb: 0.5 }}>{part.description}</Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        MPN: {part.manufacturer_part_number || '—'}
                        {part.barcode ? ` · Barcode: ${part.barcode}` : ''}
                      </Typography>
                      {part.location && (
                        <Box sx={{ mt: 0.5 }}>
                          <Typography variant="caption" component="span">
                            <strong>Location: </strong>{part.location}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>

                  <Box sx={{ textAlign: 'right' }}>
                    {getStockChip(part.quantity, part.minimum_quantity)}
                    <Typography variant="body2" fontWeight={600} sx={{ mt: 1 }}>
                      {formatCurrency(part.unit_cost)}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </ListItem>
          ))}
        </List>
      )}

      {!loading && !error && searchTerm && results.length === 0 && (
        <Typography color="text.secondary">No parts found matching your search.</Typography>
      )}
    </Box>
  );
};

export default PartSearch;
