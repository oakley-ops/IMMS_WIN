import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
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
import axiosInstance from '../utils/axios';
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

interface PartLocation {
  location: string;
  quantity: number;
}

interface Part {
  part_id: number;
  name: string;
  description: string;
  manufacturer_part_number: string;
  internal_part_number: string;
  quantity: number;
  minimum_quantity: number;
  machine_id: number;
  supplier: string;
  unit_cost: string | number;
  locations: PartLocation[];
  image_url?: string;
}

const PartSearch: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);

  useEffect(() => {
    const searchParts = async () => {
      if (!debouncedSearchTerm) {
        setParts([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await axiosInstance.get<Part[]>('/api/v1/parts');
        const filteredParts = response.data.filter(part => {
          const searchTermLower = debouncedSearchTerm.toLowerCase();
          const locationMatch = part.locations.some(loc =>
            loc.location.toLowerCase().includes(searchTermLower)
          );

          return (
            part.name.toLowerCase().includes(searchTermLower) ||
            part.description?.toLowerCase().includes(searchTermLower) ||
            part.manufacturer_part_number?.toLowerCase().includes(searchTermLower) ||
            part.internal_part_number?.toLowerCase().includes(searchTermLower) ||
            part.supplier?.toLowerCase().includes(searchTermLower) ||
            locationMatch
          );
        });
        setParts(filteredParts);
      } catch (err) {
        console.error('Error searching parts:', err);
        const error = err as AxiosError<ApiErrorResponse>;
        setError(error.response?.data?.error || error.response?.data?.message || 'Failed to search parts');
      } finally {
        setLoading(false);
      }
    };

    searchParts();
  }, [debouncedSearchTerm]);

  const getStockChip = (quantity: number, minimum_quantity: number) => {
    if (quantity <= 0) {
      return <Chip label="Out of Stock" size="small" sx={{ bgcolor: COLOR_ERROR_BG, color: COLOR_ERROR_TEXT }} />;
    } else if (quantity < minimum_quantity) {
      return <Chip label="Low Stock" size="small" sx={{ bgcolor: COLOR_WARNING_BG, color: COLOR_WARNING_TEXT }} />;
    }
    return <Chip label="In Stock" size="small" sx={{ bgcolor: COLOR_SUCCESS_BG, color: COLOR_SUCCESS_TEXT }} />;
  };

  const formatCurrency = (value: string | number): string => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(numValue) ? '$0.00' : `$${numValue.toFixed(2)}`;
  };

  return (
    <Box sx={{ mb: 4 }}>
      <TextField
        label="Search Parts"
        fullWidth
        size="small"
        placeholder="Search by name, part number, or description..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2 }}
      />

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
      )}

      {!loading && !error && parts.length > 0 && (
        <List disablePadding>
          {parts.map(part => (
            <ListItem key={part.part_id} disablePadding sx={{ mb: 1 }}>
              <Paper variant="outlined" sx={{ p: 2, width: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    {/* Image Preview */}
                    {part.image_url ? (
                      <img
                        src={part.image_url}
                        alt={part.name}
                        style={{
                          width: 60,
                          height: 60,
                          objectFit: 'cover',
                          borderRadius: 8,
                          border: '1px solid #ddd'
                        }}
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
                          justifyContent: 'center'
                        }}
                      >
                        <PhotoCameraIcon sx={{ color: 'grey.400' }} />
                      </Box>
                    )}

                    <Box>
                      <Typography variant="subtitle2" fontWeight={600}>{part.name}</Typography>
                      <Typography variant="body2" sx={{ mb: 0.5 }}>{part.description}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Part Numbers: {part.manufacturer_part_number} / {part.internal_part_number}
                      </Typography>
                      <Box sx={{ mt: 0.5 }}>
                        <Typography variant="caption" component="span">
                          <strong>Locations: </strong>
                          {part.locations.map((loc, idx) => (
                            <span key={idx}>
                              {loc.location} ({loc.quantity} units)
                              {idx < part.locations.length - 1 ? ', ' : ''}
                            </span>
                          ))}
                        </Typography>
                      </Box>
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

      {!loading && !error && searchTerm && parts.length === 0 && (
        <Typography color="text.secondary">No parts found matching your search.</Typography>
      )}
    </Box>
  );
};

export default PartSearch;
