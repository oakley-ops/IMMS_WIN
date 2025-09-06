import React, { useState } from 'react';
import {
  Typography,
  Button,
  TextField,
  Grid,
  Tabs,
  Tab,
  Box,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Description as DocumentIcon, Build as BuildIcon } from '@mui/icons-material';
import MachineDocuments from './MachineDocuments';
import { Machine as GlobalMachine } from '../types';
import ModalPortal from './ModalPortal';

// Update the Machine interface to match the one in types/index.ts
interface Machine {
  id?: number;
  machine_id?: number;
  name: string;
  model: string;
  serial_number: string;
  location: string;
  manufacturer: string;
  installation_date: string;
  last_maintenance_date: string | null;
  next_maintenance_date: string;
  notes: string;
  status: string;
}

interface MachineDialogsProps {
  open: boolean;
  editOpen: boolean;
  newMachine: Partial<Machine>;
  selectedMachine: Machine | null;
  onClose: () => void;
  onEditClose: () => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEditInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onAddMachine: () => void;
  onUpdateMachine: () => void;
}

const MachineDialogs: React.FC<MachineDialogsProps> = ({
  open,
  editOpen,
  newMachine,
  selectedMachine,
  onClose,
  onEditClose,
  onInputChange,
  onEditInputChange,
  onAddMachine,
  onUpdateMachine,
}) => {
  const [editTabValue, setEditTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setEditTabValue(newValue);
  };

  interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
  }

  const TabPanel = (props: TabPanelProps) => {
    const { children, value, index, ...other } = props;

    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`simple-tabpanel-${index}`}
        aria-labelledby={`simple-tab-${index}`}
        {...other}
      >
        {value === index && (
          <Box sx={{ p: 3 }}>
            {children}
          </Box>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Add Machine Dialog */}
      <Dialog 
        open={open} 
        onClose={onClose}
        maxWidth="md"
        fullWidth
        keepMounted={false}
      >
        <DialogTitle>
          <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
            Add New Machine
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    name="name"
                    label="Machine Name"
                    value={newMachine.name || ''}
                    onChange={onInputChange}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    name="model"
                    label="Model"
                    value={newMachine.model || ''}
                    onChange={onInputChange}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    name="manufacturer"
                    label="Manufacturer"
                    value={newMachine.manufacturer || ''}
                    onChange={onInputChange}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    name="serial_number"
                    label="Serial Number"
                    value={newMachine.serial_number || ''}
                    onChange={onInputChange}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    name="location"
                    label="Location"
                    value={newMachine.location || ''}
                    onChange={onInputChange}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    name="installation_date"
                    label="Installation Date"
                    type="date"
                    value={newMachine.installation_date || ''}
                    onChange={onInputChange}
                    fullWidth
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    name="notes"
                    label="Notes"
                    value={newMachine.notes || ''}
                    onChange={onInputChange}
                    fullWidth
                    multiline
                    rows={3}
                  />
                </Grid>
              </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="inherit">
            Cancel
          </Button>
          <Button 
            onClick={onAddMachine} 
            variant="contained" 
            color="primary"
            startIcon={<AddIcon />}
          >
            Add Machine
          </Button>
        </DialogActions>
          </Dialog>

      {/* Edit Machine Dialog */}
      <ModalPortal open={editOpen}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content custom-dialog">
            <div className="dialog-header">
              <h5 className="dialog-title">Edit Machine</h5>
            </div>
            <div className="dialog-content">
                      {selectedMachine && (
              <div>
                <div className="nav nav-tabs" role="tablist">
                  <button
                    className={`nav-link ${editTabValue === 0 ? 'active' : ''}`}
                    onClick={() => setEditTabValue(0)}
                    type="button"
                    role="tab"
                  >
                    <BuildIcon style={{ marginRight: '8px', fontSize: '16px' }} />
                    Machine Info
                  </button>
                  <button
                    className={`nav-link ${editTabValue === 1 ? 'active' : ''}`}
                    onClick={() => setEditTabValue(1)}
                    type="button"
                    role="tab"
                  >
                    <DocumentIcon style={{ marginRight: '8px', fontSize: '16px' }} />
                    Documents
                  </button>
                </div>
                
                <div className="tab-content mt-3">
                  {editTabValue === 0 && (
                    <div className="tab-pane fade show active">
                      <div className="row">
                        <div className="col-12 mb-3">
                          <label className="form-label">Machine Name *</label>
                          <input
                            type="text"
                            className="form-control"
                            name="name"
                            value={selectedMachine.name || ''}
                            onChange={onEditInputChange}
                            required
                          />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Model *</label>
                          <input
                            type="text"
                            className="form-control"
                            name="model"
                            value={selectedMachine.model || ''}
                            onChange={onEditInputChange}
                            required
                          />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Manufacturer</label>
                          <input
                            type="text"
                            className="form-control"
                            name="manufacturer"
                            value={selectedMachine.manufacturer || ''}
                            onChange={onEditInputChange}
                          />
                        </div>
                        <div className="col-12 mb-3">
                          <label className="form-label">Serial Number *</label>
                          <input
                            type="text"
                            className="form-control"
                            name="serial_number"
                            value={selectedMachine.serial_number || ''}
                            onChange={onEditInputChange}
                            required
                          />
                        </div>
                        <div className="col-12 mb-3">
                          <label className="form-label">Location</label>
                          <input
                            type="text"
                            className="form-control"
                            name="location"
                            value={selectedMachine.location || ''}
                            onChange={onEditInputChange}
                          />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Installation Date</label>
                          <input
                            type="date"
                            className="form-control"
                            name="installation_date"
                            value={selectedMachine.installation_date || ''}
                            onChange={onEditInputChange}
                          />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Status</label>
                          <input
                            type="text"
                            className="form-control"
                            name="status"
                            value={selectedMachine.status || ''}
                            onChange={onEditInputChange}
                          />
                        </div>
                        <div className="col-12 mb-3">
                          <label className="form-label">Notes</label>
                          <textarea
                            className="form-control"
                            name="notes"
                            value={selectedMachine.notes || ''}
                            onChange={onEditInputChange}
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {editTabValue === 1 && (
                    <div className="tab-pane fade show active">
                      {(selectedMachine.id || selectedMachine.machine_id) && (
                        <MachineDocuments 
                          machineId={(selectedMachine.id || selectedMachine.machine_id) as number} 
                          machineName={selectedMachine.name || 'Unknown Machine'} 
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
            <div className="dialog-footer">
              <div className="d-flex gap-2 justify-content-end">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={onEditClose}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onUpdateMachine}
                  style={{ 
                    backgroundColor: '#FF6600', 
                    borderColor: '#FF6600' 
                  }}
                >
                  <EditIcon style={{ marginRight: '8px', fontSize: '16px' }} />
                  Update Machine
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
    </>
  );
};

export default MachineDialogs; 