import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Search,
  Refresh,
  Visibility,
  Edit,
  Build,
  RemoveCircle,
  Add,
  Delete,
  QrCodeScanner,
} from '@mui/icons-material';
import axios from 'axios';
import DieBarcodeScanner from './DieBarcodeScanner';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1';

interface Die {
  die_id: number;
  die_number: string;
  die_name: string;
  die_type: string;
  status: string;
  machine_name?: string;
  current_location?: string;
}

interface DieInventoryListProps {
  onViewDetails: (dieId: number) => void;
  onAddDie: () => void;
  onEditDie: (die: Die) => void;
  onInstallDie: (die: Die) => void;
  onRemoveDie: (die: Die) => void;
  onDeleteDie: (die: Die) => void;
}

const DieInventoryList: React.FC<DieInventoryListProps> = ({
  onViewDetails,
  onAddDie,
  onEditDie,
  onInstallDie,
  onRemoveDie,
  onDeleteDie,
}) => {
  const navigate = useNavigate();
  const [dies, setDies] = useState<Die[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    fetchDies();
  }, [statusFilter]);

  const fetchDies = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params: any = {};
      
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }

      const response = await axios.get(`${API_URL}/dies`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      setDies(response.data);
    } catch (error) {
      console.error('Error fetching dies:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      'SHARP': '#4CAF50',
      'USED': '#F44336',
      'OUT_FOR_SHARPENING': '#FF9800',
      'IN_MACHINE': '#2196F3',
    };
    return colors[status] || '#9E9E9E';
  };

  const getStatusLabel = (status: string) => {
    const labels: any = {
      'IN_MACHINE': 'In Machine',
      'SHARP': 'Sharp',
      'USED': 'Used',
      'OUT_FOR_SHARPENING': 'Sent Out for Sharpening',
    };
    return labels[status] || status.replace(/_/g, ' ');
  };

  const filteredDies = dies.filter((die) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      die.die_number.toLowerCase().includes(searchLower) ||
      die.die_name.toLowerCase().includes(searchLower) ||
      die.die_type.toLowerCase().includes(searchLower)
    );
  });

  const paginatedDies = filteredDies.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleRowClick = (dieId: number) => {
    navigate(`/die-tracker/detail/${dieId}`);
  };

  const handleBarcodeScan = async (barcode: string) => {
    try {
      setScanning(true);
      const token = localStorage.getItem('token');
      
      // Try barcode lookup first
      let response;
      try {
        response = await axios.get(`${API_URL}/dies/barcode/${encodeURIComponent(barcode)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (barcodeError: any) {
        // If barcode lookup fails, try die_number lookup
        if (barcodeError.response?.status === 404) {
          response = await axios.get(`${API_URL}/dies/number/${encodeURIComponent(barcode)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        } else {
          throw barcodeError;
        }
      }
      
      if (response.data) {
        const die = response.data;
        // Navigate to die detail page
        navigate(`/die-tracker/detail/${die.die_id}`);
      }
    } catch (error: any) {
      console.error('Error looking up die by barcode:', error);
      alert(error.response?.data?.error || 'Die not found with this barcode');
    } finally {
      setScanning(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search dies..."
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title="Scan Barcode">
                    <IconButton
                      size="small"
                      onClick={() => setScannerOpen(true)}
                      disabled={scanning}
                    >
                      <QrCodeScanner />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 300 }}
          />

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Status Filter</InputLabel>
            <Select
              value={statusFilter}
              label="Status Filter"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="ALL">All Status</MenuItem>
              <MenuItem value="IN_MACHINE">In Machine</MenuItem>
              <MenuItem value="SHARP">Sharp</MenuItem>
              <MenuItem value="USED">Used</MenuItem>
              <MenuItem value="OUT_FOR_SHARPENING">Sent Out for Sharpening</MenuItem>
            </Select>
          </FormControl>

          <IconButton onClick={fetchDies} color="primary">
            <Refresh />
          </IconButton>

          <Button
            variant="outlined"
            startIcon={<QrCodeScanner />}
            onClick={() => setScannerOpen(true)}
            disabled={scanning}
            sx={{ borderColor: '#0066A1', color: '#0066A1' }}
          >
            Scan Barcode
          </Button>

          <Box sx={{ flexGrow: 1 }} />

          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={onAddDie}
            sx={{
              bgcolor: '#FF6600',
              '&:hover': { bgcolor: '#E55A00' },
            }}
          >
            Add New Die
          </Button>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell><strong>Die Number</strong></TableCell>
                    <TableCell><strong>Type</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>Location/Machine</strong></TableCell>
                    <TableCell align="center"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedDies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        {searchTerm || statusFilter !== 'ALL'
                          ? 'No dies match your filters'
                          : 'No dies in inventory. Click "Add New Die" to get started.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedDies.map((die) => (
                        <TableRow
                          key={die.die_id}
                          hover
                          sx={{ cursor: 'pointer' }}
                          onClick={() => handleRowClick(die.die_id)}
                        >
                          <TableCell sx={{ fontWeight: 'bold', color: '#0066A1' }}>
                            {die.die_number}
                          </TableCell>
                          <TableCell>{die.die_type}</TableCell>
                          <TableCell>
                            <Chip
                              label={getStatusLabel(die.status)}
                              size="small"
                              sx={{
                                bgcolor: getStatusColor(die.status),
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '0.7rem',
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            {die.machine_name || die.current_location || 'Storage'}
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                              <Tooltip title="View Details">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onViewDetails(die.die_id);
                                  }}
                                  color="primary"
                                >
                                  <Visibility fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditDie(die);
                                  }}
                                  color="primary"
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {(die.status === 'SHARP' || die.status === 'USED') ? (
                                <Tooltip title="Install in Machine">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onInstallDie(die);
                                    }}
                                    sx={{ color: '#4CAF50' }}
                                  >
                                    <Build fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              ) : die.status === 'IN_MACHINE' ? (
                                <Tooltip title="Remove from Machine">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRemoveDie(die);
                                    }}
                                    sx={{ color: '#F44336' }}
                                  >
                                    <RemoveCircle fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              ) : null}
                              {die.status !== 'IN_MACHINE' && (
                                <Tooltip title="Delete Die">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteDie(die);
                                    }}
                                    sx={{ color: '#F44336' }}
                                  >
                                    <Delete fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={filteredDies.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </>
        )}
      </CardContent>

      <DieBarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScan}
        title="Scan Die Barcode"
        description="Position the barcode or QR code within the frame to scan"
      />
    </Card>
  );
};

export default DieInventoryList;
