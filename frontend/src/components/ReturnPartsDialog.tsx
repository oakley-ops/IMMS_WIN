import React, { useState, useEffect } from 'react';
import { Part } from '../types';
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

interface ReturnPartsDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preSelectedPart?: Part | null;
}

const ReturnPartsDialog: React.FC<ReturnPartsDialogProps> = ({
  open,
  onClose,
  onSuccess,
  preSelectedPart,
}) => {
  const [selectedPart, setSelectedPart] = useState<Part | null>(preSelectedPart || null);
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Part[]>([]);

  // Debug searchResults changes
  const [searchLoading, setSearchLoading] = useState(false);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedPart(preSelectedPart || null);
      setQuantity(1);
      setError(null);
      setSuccess(null);
      setSearchTerm('');
      setSearchResults([]); // Ensure this is always an array
    } else {
      // Also reset when dialog closes
      setSearchResults([]);
      setSearchTerm('');
    }
  }, [open, preSelectedPart]);

  // Search for parts
  useEffect(() => {
    const searchParts = async () => {
      if (searchTerm.length >= 2) {
        setSearchLoading(true);
        try {
          const response = await axios.get(`/api/v1/parts?page=0&limit=50&search=${encodeURIComponent(searchTerm)}`);

          // Get the actual data from the response
          const responseData = response.data || response;
          const partsArray = responseData.items || responseData.parts || responseData || [];

          // Ensure we always set an array
          if (Array.isArray(partsArray)) {
            setSearchResults(partsArray);
          } else {
            console.warn('Return Dialog - Unexpected API response structure:', partsArray);
            setSearchResults([]);
          }
        } catch (error) {
          console.error('Error searching parts:', error);
          setSearchResults([]);
        } finally {
          setSearchLoading(false);
        }
      } else {
        setSearchResults([]);
      }
    };

    const timeoutId = setTimeout(searchParts, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPart) {
      setError('Please select a part');
      return;
    }

    if (quantity <= 0) {
      setError('Please enter a valid quantity greater than 0');
      return;
    }


    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const partId = selectedPart.part_id;
      if (!partId) {
        throw new Error('Invalid part ID');
      }

      console.log('Returning parts with data:', {
        part_id: partId,
        quantity: quantity,
        reason: 'Part returned to inventory'
      });

      const response = await axios.post('/api/v1/parts/return', {
        part_id: partId,
        quantity: quantity,
        reason: 'Part returned to inventory'
      });

      console.log('Return API response:', response);

      setSuccess(`Successfully returned ${quantity} units of ${selectedPart.name} to inventory`);

      // Reset form after successful return
      setTimeout(() => {
        onSuccess?.();
        onClose();
        setSelectedPart(null);
        setQuantity(1);
        setSearchTerm('');
        setSearchResults([]);
        setSuccess(null);
      }, 2000);

    } catch (error: any) {
      console.error('Error returning parts:', error);
      setError(
        error.response?.data?.error ||
        error.response?.data?.details ||
        error.message ||
        'Failed to return parts to inventory'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setSelectedPart(null);
      setQuantity(1);
      setError(null);
      setSuccess(null);
      setSearchTerm('');
      setSearchResults([]);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Return Parts to Inventory</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 2 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          <Box sx={{ mb: 3 }}>
            <Box sx={{ position: 'relative' }}>
              <TextField
                label="Search and Select Part *"
                fullWidth
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Type part name or part number..."
                disabled={!!selectedPart}
                InputProps={{
                  endAdornment: searchLoading ? <CircularProgress size={16} /> : undefined,
                }}
              />
            </Box>

            {searchResults.length > 0 && !selectedPart && searchTerm.length >= 2 && (
              <Paper variant="outlined" sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
                <List dense disablePadding>
                  {searchResults.map((part) => (
                    <ListItem key={part.part_id} disablePadding>
                      <ListItemButton
                        onClick={() => {
                          setSelectedPart(part);
                          setSearchTerm(part.name);
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start' }}>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="body2" fontWeight={600}>{part.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Mfg Part #: {part.manufacturer_part_number || 'N/A'}
                            </Typography>
                          </Box>
                          <Chip
                            label={`Stock: ${part.quantity}`}
                            size="small"
                            color="primary"
                          />
                        </Box>
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}

            {selectedPart && (
              <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Selected Part Details
                </Typography>
                <Typography variant="body2">
                  <strong>Name:</strong> {selectedPart.name}
                </Typography>
                <Typography variant="body2">
                  <strong>Manufacturer Part #:</strong> {selectedPart.manufacturer_part_number || 'N/A'}
                </Typography>
                <Typography variant="body2">
                  <strong>Current Stock:</strong> {selectedPart.quantity} units
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>New Stock After Return:</strong> {selectedPart.quantity + quantity} units
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setSelectedPart(null);
                    setSearchTerm('');
                  }}
                >
                  Change Part
                </Button>
              </Paper>
            )}
          </Box>

          <TextField
            label="Quantity to Return *"
            type="number"
            fullWidth
            size="small"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            inputProps={{ min: 1 }}
            required
            helperText="Enter the number of parts to return to inventory"
            sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            disabled={loading || !selectedPart || quantity <= 0}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {loading ? 'Returning...' : 'Return to Inventory'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ReturnPartsDialog;
