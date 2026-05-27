import React, { useState } from 'react';
import {
  Typography,
  Button,
  TextField,
  Grid,
  Tabs,
  Tab,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  FormGroup,
  FormLabel,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Description as DocumentIcon, Build as BuildIcon } from '@mui/icons-material';
import MachineDocuments from './MachineDocuments';
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
  compatible_die_types?: string[];
}

const DIE_TYPE_OPTIONS = ['4 up die', '8 up die'];

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
  onDieTypeChange?: (dieType: string, checked: boolean, isEdit: boolean) => void;
}

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
  onDieTypeChange,
}) => {
  const [editTabValue, setEditTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setEditTabValue(newValue);
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
            <Grid item xs={12}>
              <FormLabel component="legend" sx={{ mb: 1 }}>Compatible Die Types</FormLabel>
              <FormGroup row>
                {DIE_TYPE_OPTIONS.map((dieType) => (
                  <FormControlLabel
                    key={dieType}
                    control={
                      <Checkbox
                        checked={newMachine.compatible_die_types?.includes(dieType) || false}
                        onChange={(e) => onDieTypeChange?.(dieType, e.target.checked, false)}
                      />
                    }
                    label={dieType}
                  />
                ))}
              </FormGroup>
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
      <Dialog
        open={editOpen}
        onClose={onEditClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
            Edit Machine
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {selectedMachine && (
            <>
              <Tabs value={editTabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
                <Tab
                  icon={<BuildIcon sx={{ fontSize: 16 }} />}
                  iconPosition="start"
                  label="Machine Info"
                />
                <Tab
                  icon={<DocumentIcon sx={{ fontSize: 16 }} />}
                  iconPosition="start"
                  label="Documents"
                />
              </Tabs>

              <TabPanel value={editTabValue} index={0}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Machine Name *"
                      name="name"
                      value={selectedMachine.name || ''}
                      onChange={onEditInputChange}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Model *"
                      name="model"
                      value={selectedMachine.model || ''}
                      onChange={onEditInputChange}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Manufacturer"
                      name="manufacturer"
                      value={selectedMachine.manufacturer || ''}
                      onChange={onEditInputChange}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Serial Number *"
                      name="serial_number"
                      value={selectedMachine.serial_number || ''}
                      onChange={onEditInputChange}
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Location"
                      name="location"
                      value={selectedMachine.location || ''}
                      onChange={onEditInputChange}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Installation Date"
                      type="date"
                      name="installation_date"
                      value={selectedMachine.installation_date || ''}
                      onChange={onEditInputChange}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Status"
                      name="status"
                      value={selectedMachine.status || ''}
                      onChange={onEditInputChange}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Notes"
                      name="notes"
                      value={selectedMachine.notes || ''}
                      onChange={onEditInputChange}
                      multiline
                      rows={3}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormLabel component="legend" sx={{ mb: 1 }}>Compatible Die Types</FormLabel>
                    <FormGroup row>
                      {DIE_TYPE_OPTIONS.map((dieType) => (
                        <FormControlLabel
                          key={dieType}
                          control={
                            <Checkbox
                              id={`edit-die-type-${dieType}`}
                              checked={selectedMachine.compatible_die_types?.includes(dieType) || false}
                              onChange={(e) => onDieTypeChange?.(dieType, e.target.checked, true)}
                            />
                          }
                          label={dieType}
                        />
                      ))}
                    </FormGroup>
                  </Grid>
                </Grid>
              </TabPanel>

              <TabPanel value={editTabValue} index={1}>
                {(selectedMachine.id || selectedMachine.machine_id) && (
                  <MachineDocuments
                    machineId={(selectedMachine.id || selectedMachine.machine_id) as number}
                    machineName={selectedMachine.name || 'Unknown Machine'}
                  />
                )}
              </TabPanel>
            </>
          )}
        </DialogContent>
        <DialogActions>
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
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MachineDialogs;
