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
  id?: number;
  part_id: string;
  name: string;
  manufacturer_part_number?: string;
  quantity: number;
  minimum_quantity: number;
}

interface Machine {
  machine_id: number;
  id?: number; // Keep for backward compatibility
  name: string;
  description?: string;
}

interface PartsUsageDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preSelectedPart?: Part | null;
}

const PartsUsageDialog: React.FC<PartsUsageDialogProps> = ({
  open,
  onClose,
  onSuccess,
  preSelectedPart,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Part[]>([]);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [machineSearchTerm, setMachineSearchTerm] = useState('');
  const [machineResults, setMachineResults] = useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchingMachines, setSearchingMachines] = useState(false);

  useEffect(() => {
    if (open) {
      fetchMachines();
    }
  }, [open]);

  // Effect to handle preSelectedPart
  useEffect(() => {
    if (preSelectedPart && open) {
      // Convert the preSelectedPart to match the expected format
      const formattedPart: Part = {
        id: typeof preSelectedPart.part_id === 'string' ? parseInt(preSelectedPart.part_id) : preSelectedPart.part_id || preSelectedPart.id,
        part_id: preSelectedPart.part_id?.toString() || preSelectedPart.id?.toString() || '0',
        name: preSelectedPart.name,
        manufacturer_part_number: preSelectedPart.manufacturer_part_number,
        quantity: preSelectedPart.quantity,
        minimum_quantity: preSelectedPart.minimum_quantity
      };
      setSelectedPart(formattedPart);
      setSearchTerm(preSelectedPart.name);
      setSearchResults([]); // Clear search results since we have a pre-selected part
    } else if (open) {
      // Reset form when opened without preSelectedPart
      setSelectedPart(null);
      setSearchTerm('');
      setSearchResults([]);
      setSelectedMachine(null);
      setMachineSearchTerm('');
      setMachineResults([]);
      setQuantity(0);
      setReason('');
      setError(null);
    }
  }, [preSelectedPart, open]);

  const fetchMachines = async () => {
    setSearchingMachines(true);
    try {
      const response = await axios.get('/api/v1/machines');
      setAllMachines(response.data);
    } catch (error) {
      console.error('Error fetching machines:', error);
      setError('Failed to fetch machines');
    } finally {
      setSearchingMachines(false);
    }
  };

  const searchParts = async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await axios.get('/api/v1/parts', {
        params: {
          search: term,
          limit: 10,
          page: 0
        }
      });
      setSearchResults(response.data.items);
    } catch (error) {
      console.error('Error searching parts:', error);
      setError('Failed to search parts');
    } finally {
      setSearching(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    searchParts(term);
  };

  const selectPart = (part: Part) => {
    setSelectedPart(part);
    setSearchTerm('');
    setSearchResults([]);
    if (quantity > part.quantity) {
      setQuantity(0);
    }
  };

  const searchMachines = (term: string) => {
    if (!term.trim()) {
      setMachineResults([]);
      return;
    }

    const searchTerm = term.toLowerCase();
    const filteredMachines = allMachines.filter(machine =>
      machine.name.toLowerCase().includes(searchTerm) ||
      (machine.description && machine.description.toLowerCase().includes(searchTerm))
    );
    setMachineResults(filteredMachines);
  };

  const handleMachineSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setMachineSearchTerm(term);
    searchMachines(term);
  };

  const selectMachine = (machine: Machine) => {
    setSelectedMachine(machine);
    setMachineSearchTerm('');
    setMachineResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPart) {
      setError('Please select a part');
      return;
    }

    if (!selectedMachine) {
      setError('Please select a machine');
      return;
    }

    if (quantity <= 0 || quantity > selectedPart.quantity) {
      setError('Please enter a valid quantity');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const partId = selectedPart.part_id;
      if (!partId) {
        throw new Error('Invalid part ID');
      }

      const machineId = selectedMachine.machine_id || selectedMachine.id;

      console.log('Sending request with data:', {
        part_id: partId,
        machine_id: machineId,
        quantity: quantity,
        reason: reason,
        work_order_number: null
      });

      // Now we can send the reason since we're storing it in the transactions table
      const response = await axios.post('/api/v1/parts/usage', {
        part_id: partId,
        machine_id: machineId,
        quantity: quantity,
        reason: reason,
        work_order_number: null // Optional field
      });

      console.log('API response:', response.data);

      onSuccess?.();
      onClose();
      setSelectedPart(null);
      setSelectedMachine(null);
      setQuantity(0);
      setReason('');
      setSearchTerm('');
      setMachineSearchTerm('');
      setSearchResults([]);
      setMachineResults([]);
    } catch (error: any) {
      console.error('Error recording part usage:', error);
      console.error('Error details:', error.response?.data);
      const failedMachineId = selectedMachine?.machine_id || selectedMachine?.id;
      console.error('Request that failed:', {
        part_id: selectedPart?.part_id,
        machine_id: failedMachineId,
        quantity: quantity,
        reason: reason
      });
      setError(error.response?.data?.error || error.response?.data?.details || 'Failed to record part usage');
    } finally {
      setLoading(false);
    }
  };

  const getStockChip = (qty: number, minQty: number) => {
    if (qty === 0) return <Chip label="Out of Stock" size="small" sx={{ bgcolor: COLOR_ERROR_BG, color: COLOR_ERROR_TEXT }} />;
    if (qty <= minQty) return <Chip label="Low Stock" size="small" sx={{ bgcolor: COLOR_WARNING_BG, color: COLOR_WARNING_TEXT }} />;
    return <Chip label="In Stock" size="small" sx={{ bgcolor: COLOR_SUCCESS_BG, color: COLOR_SUCCESS_TEXT }} />;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Record Part Usage</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 2 }}>
          {/* Part Search */}
          <Box sx={{ mb: 3 }}>
            <TextField
              label="Search Part"
              fullWidth
              size="small"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by part number or name"
              disabled={!!selectedPart}
              InputProps={{
                endAdornment: searching ? <CircularProgress size={16} /> : undefined,
              }}
            />

            {searchResults.length > 0 && !selectedPart && (
              <Paper variant="outlined" sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
                <List dense disablePadding>
                  {searchResults.map((part) => (
                    <ListItem
                      key={`part-${part.part_id || Math.random().toString(36).substr(2, 9)}`}
                      disablePadding
                    >
                      <ListItemButton onClick={() => selectPart(part)}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="body2" fontWeight={600}>{part.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Mfr: {part.manufacturer_part_number || 'N/A'}
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            {getStockChip(part.quantity, part.minimum_quantity)}
                            <Typography variant="caption" display="block">Qty: {part.quantity}</Typography>
                          </Box>
                        </Box>
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}

            {selectedPart && (
              <Paper key="selected-part" variant="outlined" sx={{ p: 2, mt: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{selectedPart.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Mfr: {selectedPart.manufacturer_part_number || 'N/A'}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      {getStockChip(selectedPart.quantity, selectedPart.minimum_quantity)}
                      <Typography variant="caption" sx={{ ml: 1 }}>
                        Available: {selectedPart.quantity}
                      </Typography>
                    </Box>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setSelectedPart(null)}
                  >
                    Change Part
                  </Button>
                </Box>
              </Paper>
            )}
          </Box>

          {selectedPart && (
            <>
              {/* Machine Search */}
              <Box sx={{ mb: 3 }}>
                <TextField
                  label="Machine"
                  fullWidth
                  size="small"
                  value={machineSearchTerm}
                  onChange={handleMachineSearchChange}
                  placeholder="Search for a machine"
                  disabled={!!selectedMachine}
                  InputProps={{
                    endAdornment: searchingMachines ? <CircularProgress size={16} /> : undefined,
                  }}
                />

                {machineResults.length > 0 && !selectedMachine && (
                  <Paper variant="outlined" sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
                    <List dense disablePadding>
                      {machineResults.map((machine) => (
                        <ListItem
                          key={`machine-${machine.machine_id || machine.id || Math.random().toString(36).substr(2, 9)}`}
                          disablePadding
                        >
                          <ListItemButton onClick={() => selectMachine(machine)}>
                            <Box>
                              <Typography variant="body2" fontWeight={600}>{machine.name}</Typography>
                              {machine.description && (
                                <Typography variant="caption" color="text.secondary">
                                  {machine.description}
                                </Typography>
                              )}
                            </Box>
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                )}

                {selectedMachine && (
                  <Paper key="selected-machine" variant="outlined" sx={{ p: 2, mt: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{selectedMachine.name}</Typography>
                        {selectedMachine.description && (
                          <Typography variant="caption" color="text.secondary">
                            {selectedMachine.description}
                          </Typography>
                        )}
                      </Box>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setSelectedMachine(null)}
                      >
                        Change Machine
                      </Button>
                    </Box>
                  </Paper>
                )}
              </Box>

              <TextField
                label="Quantity Used"
                type="number"
                fullWidth
                size="small"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                inputProps={{ min: 1, max: selectedPart.quantity }}
                sx={{ mb: 3 }}
              />

              <TextField
                label="Reason for Usage"
                fullWidth
                size="small"
                multiline
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this part was used"
                sx={{ mb: 2 }}
              />
            </>
          )}

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
            disabled={
              loading ||
              !selectedPart ||
              !selectedMachine ||
              quantity <= 0 ||
              quantity > (selectedPart?.quantity || 0)
            }
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {loading ? 'Recording...' : 'Record Usage'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default PartsUsageDialog;
