import React, { useState, useEffect } from 'react';
import axios from '../utils/axios';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  Chip,
  CircularProgress,
  Paper,
  List,
  ListItem,
  ListItemButton,
} from '@mui/material';
import {
  COLOR_ERROR_BG,
  COLOR_ERROR_TEXT,
  COLOR_WARNING_BG,
  COLOR_WARNING_TEXT,
  COLOR_SUCCESS_BG,
  COLOR_SUCCESS_TEXT,
} from '../theme';

interface Part {
  part_id: string;
  name: string;
  manufacturer_part_number?: string;
  quantity: number;
  minimum_quantity: number;
  id?: number;
}

interface RestockFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preSelectedPart?: Part | null;
}

const RestockForm: React.FC<RestockFormProps> = ({ open, onClose, onSuccess, preSelectedPart }) => {
  const [parts, setParts] = useState<Part[]>([]);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Effect to handle preSelectedPart
  useEffect(() => {
    if (preSelectedPart && open) {
      // Convert the preSelectedPart to match the expected format
      const formattedPart: Part = {
        part_id: preSelectedPart.part_id?.toString() || preSelectedPart.id?.toString() || '0',
        id: typeof preSelectedPart.part_id === 'string' ? parseInt(preSelectedPart.part_id) : preSelectedPart.part_id || preSelectedPart.id || 0,
        name: preSelectedPart.name,
        manufacturer_part_number: preSelectedPart.manufacturer_part_number,
        quantity: preSelectedPart.quantity,
        minimum_quantity: preSelectedPart.minimum_quantity
      };
      setSelectedPart(formattedPart);
      setSearchTerm(preSelectedPart.name);
      setParts([]); // Clear search results since we have a pre-selected part
    } else if (open) {
      // Reset form when opened without preSelectedPart
      setSelectedPart(null);
      setSearchTerm('');
      setParts([]);
      setQuantity(0);
      setError(null);
    }
  }, [preSelectedPart, open]);

  const searchParts = async (term: string) => {
    if (!term) {
      setParts([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await axios.get('/api/v1/parts', {
        params: {
          limit: 10,
          page: 0,
          search: term
        }
      });

      setParts(response.data.items);
    } catch (error) {
      console.error('Error searching parts:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const getStockChip = (part: Part) => {
    if (part.quantity === 0) {
      return <Chip label="Out of Stock" size="small" sx={{ bgcolor: COLOR_ERROR_BG, color: COLOR_ERROR_TEXT }} />;
    } else if (part.quantity <= part.minimum_quantity) {
      return <Chip label="Low Stock" size="small" sx={{ bgcolor: COLOR_WARNING_BG, color: COLOR_WARNING_TEXT }} />;
    }
    return <Chip label="In Stock" size="small" sx={{ bgcolor: COLOR_SUCCESS_BG, color: COLOR_SUCCESS_TEXT }} />;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPart || quantity <= 0) {
      setError('Please select a part and enter a valid quantity');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await axios.post('/api/v1/parts/restock', {
        part_id: selectedPart.part_id || selectedPart.id,
        quantity: quantity
      });

      onSuccess?.();
      onClose();
      setSelectedPart(null);
      setQuantity(0);
      setSearchTerm('');
    } catch (error: any) {
      console.error('Error restocking part:', error);
      setError(error.response?.data?.error || 'Failed to restock part');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Restock Parts</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                label="Search Part"
                placeholder="Search by part number or name"
                fullWidth
                size="small"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  searchParts(e.target.value);
                }}
                disabled={!!preSelectedPart}
              />
              {searchLoading && <CircularProgress size={20} />}
              {preSelectedPart && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setSelectedPart(null);
                    setSearchTerm('');
                    setParts([]);
                  }}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  Clear
                </Button>
              )}
            </Box>

            {parts.length > 0 && (
              <Paper variant="outlined" sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
                <List dense disablePadding>
                  {parts.map((part) => (
                    <ListItem key={part.part_id} disablePadding>
                      <ListItemButton
                        onClick={() => {
                          setSelectedPart(part);
                          setParts([]);
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="body2">{part.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Mfr: {part.manufacturer_part_number || 'N/A'}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="caption" display="block">Qty: {part.quantity}</Typography>
                            {getStockChip(part)}
                          </Box>
                        </Box>
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Box>

          {selectedPart && (
            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={600}>{selectedPart.name}</Typography>
                {getStockChip(selectedPart)}
              </Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Mfr: {selectedPart.manufacturer_part_number || 'N/A'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Current Stock: {selectedPart.quantity} | Minimum Required: {selectedPart.minimum_quantity}
              </Typography>
            </Paper>
          )}

          <TextField
            label="Quantity to Restock"
            type="number"
            fullWidth
            size="small"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
            inputProps={{ min: 0 }}
            disabled={!selectedPart}
            sx={{ mb: 2 }}
          />

          {error && (
            <Alert severity="error">{error}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            disabled={loading || !selectedPart || quantity <= 0}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {loading ? 'Restocking...' : 'Restock'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default RestockForm;
