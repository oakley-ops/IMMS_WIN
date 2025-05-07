import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  LinearProgress,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  IconButton,
  Tooltip,
  styled,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import * as XLSX from 'xlsx';
import axios from '../utils/axios';

// Styled components
const UploadBox = styled(Box)(({ theme }) => ({
  border: `2px dashed ${theme.palette.primary.main}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(3),
  textAlign: 'center',
  backgroundColor: theme.palette.background.default,
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  fontWeight: 'bold',
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.common.white,
}));

interface ImportPartsDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ExcelPart {
  name: string;
  description: string;
  manufacturer: string;
  manufacturer_part_number: string;
  fiserv_part_number: string;
  quantity: number;
  minimum_quantity: number;
  location: string;
  notes: string;
  cost: number;
}

const ImportPartsDialog: React.FC<ImportPartsDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ExcelPart[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const downloadTemplate = () => {
    const headers = [
      'Part Number',
      'Fiserv Part Number',
      'Description',
      'Quantity',
      'Location',
      'Manufacturer',
      'Cost'
    ];

    const sampleData = [
      [
        'ABC123',
        'FISERV-123',
        'Sample Part Description',
        '10',
        'Sensor Cabinet',
        'Sample Manufacturer',
        '99.99'
      ]
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Parts Import');
    XLSX.writeFile(wb, 'parts_import_template.xlsx');
  };

  const validateData = (jsonData: any[]): ExcelPart[] => {
    const validatedData: ExcelPart[] = [];
    const errors: string[] = [];

    const dataRows = jsonData.slice(1);

    dataRows.forEach((row: any, index: number) => {
      try {
        const partNumber = row['Part Number']?.toString().trim();
        const fiservPartNumber = row['Fiserv Part Number']?.toString().trim();
        const description = row['Description']?.toString().trim();
        const quantity = row['Quantity']?.toString().trim();
        const location = row['Location']?.toString().trim();
        const manufacturer = row['Manufacturer']?.toString().trim() || '';
        const cost = row['Cost']?.toString().trim();

        if (!partNumber) {
          errors.push(`Row ${index + 1}: Missing part number`);
          return;
        }

        let parsedQuantity = 0;
        if (quantity) {
          parsedQuantity = parseInt(quantity);
          if (isNaN(parsedQuantity)) {
            errors.push(`Row ${index + 1}: Invalid quantity "${quantity}" for part ${partNumber}`);
            return;
          }
        }

        let parsedCost = 0;
        if (cost) {
          parsedCost = parseFloat(cost);
          if (isNaN(parsedCost)) {
            errors.push(`Row ${index + 1}: Invalid cost "${cost}" for part ${partNumber}`);
            return;
          }
        }

        const part: ExcelPart = {
          name: description || partNumber,
          description: description || '',
          manufacturer: manufacturer,
          manufacturer_part_number: partNumber,
          fiserv_part_number: fiservPartNumber || partNumber,
          quantity: parsedQuantity,
          minimum_quantity: 1,
          location: location || '',
          notes: '',
          cost: parsedCost
        };

        validatedData.push(part);
      } catch (error) {
        errors.push(`Row ${index + 1}: Error processing row`);
      }
    });

    if (errors.length > 0) {
      throw new Error(errors.join('\n'));
    }

    if (validatedData.length === 0) {
      throw new Error('No valid parts found in the Excel file');
    }

    return validatedData;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    try {
      setError(null);
      setPreview([]);
      
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          if (workbook.SheetNames.length === 0) {
            throw new Error('Excel file is empty');
          }

          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            header: ['Part Number', 'Fiserv Part Number', 'Description', 'Quantity', 'Location', 'Manufacturer', 'Cost'],
            raw: true,
            defval: '',
            blankrows: false
          });

          if (jsonData.length === 0) {
            throw new Error('No data found in Excel file');
          }

          const validatedData = validateData(jsonData);
          setPreview(validatedData);
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Invalid file format');
          setPreview([]);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      setError('Error reading file');
      setPreview([]);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleImport = async () => {
    if (preview.length === 0) {
      setError('No valid data to import');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      await axios.post('/api/v1/parts/bulk', preview);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Import error:', error);
      // Extract error message from response in a safe way
      let errorMessage = 'Failed to import parts';
      
      if (error.response?.data?.error && typeof error.response.data.error === 'string') {
        errorMessage = error.response.data.error;
      } else if (error.message && typeof error.message === 'string') {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { 
          borderRadius: 2,
          maxHeight: '90vh',
          height: 'auto'
        }
      }}
    >
      <DialogTitle sx={{ 
        bgcolor: 'primary.main', 
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 1
      }}>
        Import Parts from Excel
        <Tooltip title="Download template">
          <IconButton 
            onClick={downloadTemplate}
            size="small"
            sx={{ color: 'white' }}
          >
            <DownloadIcon />
          </IconButton>
        </Tooltip>
      </DialogTitle>

      <DialogContent sx={{ 
        p: 3,
        overflowY: 'auto',
        '&::-webkit-scrollbar': {
          width: '8px'
        },
        '&::-webkit-scrollbar-track': {
          background: '#f1f1f1'
        },
        '&::-webkit-scrollbar-thumb': {
          background: '#888',
          borderRadius: '4px'
        },
        '&::-webkit-scrollbar-thumb:hover': {
          background: '#555'
        }
      }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            File Requirements
            <Tooltip title="Make sure your Excel file follows this format">
              <HelpOutlineIcon fontSize="small" color="primary" />
            </Tooltip>
          </Typography>
          <Typography variant="body2" component="div" sx={{ ml: 2 }}>
            • First column: Part Number (required)
            • Second column: Fiserv Part Number
            • Third column: Description
            • Fourth column: Quantity
            • Fifth column: Location
            • Sixth column: Manufacturer
            • Seventh column: Cost
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <input
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          id="import-file"
          type="file"
          onChange={handleFileUpload}
        />

        <label htmlFor="import-file">
          <UploadBox
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            sx={{
              mb: 3,
              bgcolor: dragActive ? 'action.hover' : 'background.default',
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Drag and drop your Excel file here
            </Typography>
            <Typography variant="body2" color="textSecondary">
              or click to browse
            </Typography>
          </UploadBox>
        </label>

        {preview.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Found {preview.length} valid parts to import
            </Alert>
            <Typography variant="subtitle2" gutterBottom>
              Preview:
            </Typography>
            <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <StyledTableCell>Part Number</StyledTableCell>
                    <StyledTableCell>Fiserv Part Number</StyledTableCell>
                    <StyledTableCell>Description</StyledTableCell>
                    <StyledTableCell align="right">Qty</StyledTableCell>
                    <StyledTableCell>Location</StyledTableCell>
                    <StyledTableCell>Notes</StyledTableCell>
                    <StyledTableCell align="right">Cost</StyledTableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.slice(0, 5).map((part, index) => (
                    <TableRow key={index} hover>
                      <TableCell>{part.manufacturer_part_number}</TableCell>
                      <TableCell>{part.fiserv_part_number}</TableCell>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {part.description}
                      </TableCell>
                      <TableCell align="right">{part.quantity}</TableCell>
                      <TableCell sx={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {part.location}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {part.notes}
                      </TableCell>
                      <TableCell align="right">
                        ${part.cost.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {preview.length > 5 && (
                    <TableRow>
                      <TableCell 
                        colSpan={5} 
                        align="center"
                        sx={{ fontStyle: 'italic', color: 'text.secondary' }}
                      >
                        ... and {preview.length - 5} more parts
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {uploading && <LinearProgress sx={{ mt: 2 }} />}
      </DialogContent>

      <DialogActions sx={{ 
        p: 2, 
        bgcolor: 'background.default',
        position: 'sticky',
        bottom: 0,
        zIndex: 1
      }}>
        <Button onClick={onClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          onClick={handleImport}
          variant="contained"
          disabled={uploading || preview.length === 0}
          startIcon={uploading ? null : <CloudUploadIcon />}
        >
          {uploading ? 'Importing...' : `Import ${preview.length} Parts`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportPartsDialog;
