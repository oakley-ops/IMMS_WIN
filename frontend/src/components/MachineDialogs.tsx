import React from 'react';
import {
  Typography,
  Button,
  TextField,
  Grid,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon } from '@mui/icons-material';
import ModalPortal from './ModalPortal';
import '../styles/Dialog.css';
import { Machine as GlobalMachine } from '../types';

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
  onEditInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
  return (
    <>
      {/* Add Machine Dialog */}
      <ModalPortal open={open}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content custom-dialog">
            <div className="dialog-header">
              <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
                Add New Machine
              </Typography>
            </div>
            <div className="dialog-content">
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
            </div>
            <div className="dialog-footer">
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
            </div>
          </div>
        </div>
      </ModalPortal>

      {/* Edit Machine Dialog */}
      <ModalPortal open={editOpen}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content custom-dialog">
            <div className="dialog-header">
              <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
                Edit Machine
              </Typography>
            </div>
            <div className="dialog-content">
              {selectedMachine && (
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      name="name"
                      label="Machine Name"
                      value={selectedMachine.name || ''}
                      onChange={onEditInputChange}
                      fullWidth
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      name="model"
                      label="Model"
                      value={selectedMachine.model || ''}
                      onChange={onEditInputChange}
                      fullWidth
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      name="manufacturer"
                      label="Manufacturer"
                      value={selectedMachine.manufacturer || ''}
                      onChange={onEditInputChange}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      name="serial_number"
                      label="Serial Number"
                      value={selectedMachine.serial_number || ''}
                      onChange={onEditInputChange}
                      fullWidth
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      name="location"
                      label="Location"
                      value={selectedMachine.location || ''}
                      onChange={onEditInputChange}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      name="installation_date"
                      label="Installation Date"
                      type="date"
                      value={selectedMachine.installation_date || ''}
                      onChange={onEditInputChange}
                      fullWidth
                      InputLabelProps={{
                        shrink: true,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      name="last_maintenance_date"
                      label="Last Maintenance Date"
                      type="date"
                      value={selectedMachine.last_maintenance_date || ''}
                      onChange={onEditInputChange}
                      fullWidth
                      InputLabelProps={{
                        shrink: true,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      name="next_maintenance_date"
                      label="Next Maintenance Date"
                      type="date"
                      value={selectedMachine.next_maintenance_date || ''}
                      onChange={onEditInputChange}
                      fullWidth
                      InputLabelProps={{
                        shrink: true,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      name="status"
                      label="Status"
                      value={selectedMachine.status || ''}
                      onChange={onEditInputChange}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      name="notes"
                      label="Notes"
                      value={selectedMachine.notes || ''}
                      onChange={onEditInputChange}
                      fullWidth
                      multiline
                      rows={3}
                    />
                  </Grid>
                </Grid>
              )}
            </div>
            <div className="dialog-footer">
              <Button onClick={onEditClose} color="inherit">
                Cancel
              </Button>
              <Button 
                onClick={onUpdateMachine} 
                variant="contained" 
                color="primary"
                startIcon={<EditIcon />}
              >
                Update Machine
              </Button>
            </div>
          </div>
        </div>
      </ModalPortal>
    </>
  );
};

export default MachineDialogs; 