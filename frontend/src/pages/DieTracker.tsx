import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Tab,
  Tabs,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
} from '@mui/material';
import {
  Category,
  Build,
  Schedule,
  CheckCircle,
  Warning,
  Delete,
  TouchApp,
  Inventory,
  LocalShipping,
  Assessment,
} from '@mui/icons-material';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import axios from 'axios';

// Die management components
import DieInventoryList from '../components/dies/DieInventoryList';
import AddEditDieDialog from '../components/dies/AddEditDieDialog';
import DieChangeDialog from '../components/dies/DieChangeDialog';
import SharpeningQueueList from '../components/dies/SharpeningQueueList';
import ScheduleSharpeningDialog from '../components/dies/ScheduleSharpeningDialog';
import ShipReceiveDialog from '../components/dies/ShipReceiveDialog';
import DocumentUploadDialog from '../components/dies/DocumentUploadDialog';

// Interactive drag-and-drop components
import DiePressCard from '../components/dieInteractive/DiePressCard';
import DieShelf from '../components/dieInteractive/DieShelf';
import DieChip from '../components/dieInteractive/DieChip';
import SharpeningZone from '../components/dieInteractive/SharpeningZone';
import SharpeningConfirmDialog from '../components/dieInteractive/SharpeningConfirmDialog';
import RemovalReasonDialog from '../components/dieInteractive/RemovalReasonDialog';

const API_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/v1`
  : 'http://localhost:4000/api/v1';

interface Machine {
  machine_id: number;
  name: string;
  location: string;
  current_die_id: number | null;
  current_die?: Die | null;
}

interface Die {
  die_id: number;
  die_number: string;
  die_name: string;
  die_type: string;
  status: string;
  compatible_machine_ids: number[] | null;
  machine_id?: number | null;
}

interface OutForSharpeningDie {
  die_id: number;
  die_number: string;
  die_name: string;
  die_type: string;
  status: string;
  current_location: string;
}

const DieTracker: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    sharp: 0,
    in_machine: 0,
    out_for_sharpening: 0,
    used: 0,
  });
  const [error, setError] = useState<string | null>(null);

  // Existing dialog states
  const [addEditDialogOpen, setAddEditDialogOpen] = useState(false);
  const [changeDialogOpen, setChangeDialogOpen] = useState(false);
  const [selectedDie, setSelectedDie] = useState<any>(null);
  const [changeAction, setChangeAction] = useState<'install' | 'remove'>('install');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [scheduleSharpeningOpen, setScheduleSharpeningOpen] = useState(false);
  const [shipReceiveDialogOpen, setShipReceiveDialogOpen] = useState(false);
  const [documentUploadOpen, setDocumentUploadOpen] = useState(false);
  const [selectedSharpeningRecord, setSelectedSharpeningRecord] = useState<any>(null);
  const [shipReceiveAction, setShipReceiveAction] = useState<'ship' | 'receive'>('ship');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dieToDelete, setDieToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  // Interactive view states
  const [machines, setMachines] = useState<Machine[]>([]);
  const [availableDies, setAvailableDies] = useState<Die[]>([]);
  const [outForSharpening, setOutForSharpening] = useState<OutForSharpeningDie[]>([]);
  const [activeDie, setActiveDie] = useState<Die | null>(null);
  const [sharpeningDialogOpen, setSharpeningDialogOpen] = useState(false);
  const [dieForSharpening, setDieForSharpening] = useState<Die | null>(null);
  const [removalDialogOpen, setRemovalDialogOpen] = useState(false);
  const [dieForRemoval, setDieForRemoval] = useState<Die | null>(null);
  const [pendingActionAfterRemoval, setPendingActionAfterRemoval] = useState<'shelf' | 'sharpening' | null>(null);

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    fetchAllData();
  }, [refreshTrigger]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Fetch stats
      const statsResponse = await axios.get(`${API_URL}/dies/stats`, { headers });
      setStats(statsResponse.data);

      // Fetch die press machines
      const machinesResponse = await axios.get(`${API_URL}/machines`, { headers });
      const diePressMachines = machinesResponse.data.filter((m: any) =>
        m.name?.toLowerCase().includes('die press') ||
        m.machine_type?.toLowerCase().includes('die press')
      );

      // Fetch all dies
      const diesResponse = await axios.get(`${API_URL}/dies`, { headers });
      const allDies = diesResponse.data;

      // Map current dies to machines
      const machinesWithDies = diePressMachines.map((machine: Machine) => {
        const currentDie = allDies.find((d: Die) => d.die_id === machine.current_die_id);
        return { ...machine, current_die: currentDie || null };
      });

      // Filter available dies (SHARP or USED, not in a machine)
      const available = allDies.filter((d: Die) =>
        (d.status === 'SHARP' || d.status === 'USED') && !d.machine_id
      );

      // Filter dies out for sharpening
      const outForSharpeningDies = allDies.filter((d: Die) =>
        d.status === 'OUT_FOR_SHARPENING'
      );

      setMachines(machinesWithDies);
      setAvailableDies(available);
      setOutForSharpening(outForSharpeningDies);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError('Failed to load die data');
    } finally {
      setLoading(false);
    }
  };

  // Interactive view handlers
  const handleInteractiveInstallDie = async (dieId: number, machineId: number) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      await axios.post(`${API_URL}/dies/${dieId}/install`, {
        machine_id: machineId,
        change_reason_code: 'INSTALL',
        change_reason_notes: 'Installed via interactive UI',
      }, { headers });

      await fetchAllData();
    } catch (err: any) {
      console.error('Error installing die:', err);
      setError(err.response?.data?.error || 'Failed to install die');
    }
  };

  const handleInteractiveRemoveDie = async (dieId: number, reasonCode: string = 'REMOVE', notes: string = 'Removed via interactive UI') => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      await axios.post(`${API_URL}/dies/${dieId}/remove`, {
        change_reason_code: reasonCode,
        change_reason_notes: notes,
      }, { headers });

      await fetchAllData();
    } catch (err: any) {
      console.error('Error removing die:', err);
      setError(err.response?.data?.error || 'Failed to remove die');
      throw err;
    }
  };

  const openRemovalDialog = (die: Die, pendingAction: 'shelf' | 'sharpening' | null = null) => {
    setDieForRemoval(die);
    setPendingActionAfterRemoval(pendingAction);
    setRemovalDialogOpen(true);
  };

  const handleRemovalConfirm = async (dieId: number, reasonCode: string, notes: string) => {
    await handleInteractiveRemoveDie(dieId, reasonCode, notes);

    if (pendingActionAfterRemoval === 'sharpening' && dieForRemoval) {
      setDieForSharpening(dieForRemoval);
      setSharpeningDialogOpen(true);
    }

    setPendingActionAfterRemoval(null);
  };

  const handleSendToSharpening = async (dieId: number, notes: string) => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const today = new Date().toISOString().split('T')[0];

      await axios.post(`${API_URL}/die-sharpening`, {
        die_id: dieId,
        sharpening_vendor: 'Mathias',
        scheduled_date: today,
        service_type: 'SHARPENING',
        notes: notes || 'Sent via interactive UI',
      }, { headers });

      await fetchAllData();
    } catch (err: any) {
      console.error('Error sending to sharpening:', err);
      setError(err.response?.data?.error || 'Failed to send die to sharpening');
      throw err;
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const dieData = active.data.current?.die as Die;
    if (dieData) {
      setActiveDie(dieData);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDie(null);

    if (!over) return;

    const dieData = active.data.current?.die as Die;
    const dropType = over.data.current?.type;
    const fromMachine = active.data.current?.fromMachine;

    if (!dieData) return;

    // Dropping on a machine
    if (dropType === 'machine') {
      const machineId = over.data.current?.machineId;
      const machine = machines.find(m => m.machine_id === machineId);

      if (machine?.current_die) {
        setError('Machine already has a die installed. Remove it first.');
        return;
      }

      if (dieData.compatible_machine_ids &&
          dieData.compatible_machine_ids.length > 0 &&
          !dieData.compatible_machine_ids.includes(machineId)) {
        setError(`Die #${dieData.die_number} is not compatible with this machine.`);
        return;
      }

      if (fromMachine) {
        await handleInteractiveRemoveDie(dieData.die_id, 'TRANSFER', 'Transferred to another machine');
      }

      await handleInteractiveInstallDie(dieData.die_id, machineId);
    }

    // Dropping on shelf (removing from machine)
    if (dropType === 'shelf' && fromMachine) {
      openRemovalDialog(dieData, 'shelf');
    }

    // Dropping on sharpening zone
    if (dropType === 'sharpening') {
      if (fromMachine) {
        openRemovalDialog(dieData, 'sharpening');
      } else {
        setDieForSharpening(dieData);
        setSharpeningDialogOpen(true);
      }
    }
  };

  // Existing handlers for Die Inventory and Sharpening Queue tabs
  const handleAddDie = () => {
    setSelectedDie(null);
    setAddEditDialogOpen(true);
  };

  const handleEditDie = (die: any) => {
    setSelectedDie(die);
    setAddEditDialogOpen(true);
  };

  const handleInstallDie = (die: any) => {
    setSelectedDie(die);
    setChangeAction('install');
    setChangeDialogOpen(true);
  };

  const handleRemoveDie = (die: any) => {
    setSelectedDie(die);
    setChangeAction('remove');
    setChangeDialogOpen(true);
  };

  const handleDeleteDie = (die: any) => {
    setDieToDelete(die);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!dieToDelete) return;

    try {
      setDeleting(true);
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/dies/${dieToDelete.die_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDeleteDialogOpen(false);
      setDieToDelete(null);
      handleSuccess();
    } catch (err: any) {
      console.error('Error deleting die:', err);
      alert(err.response?.data?.error || 'Failed to delete die');
    } finally {
      setDeleting(false);
    }
  };

  const handleSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleViewDetails = (dieId: number) => {
    navigate(`/die-tracker/detail/${dieId}`);
  };

  const handleScheduleSharpening = () => {
    setSelectedDie(null);
    setScheduleSharpeningOpen(true);
  };

  const handleShip = (record: any) => {
    setSelectedSharpeningRecord(record);
    setShipReceiveAction('ship');
    setShipReceiveDialogOpen(true);
  };

  const handleReceive = (record: any) => {
    setSelectedSharpeningRecord(record);
    setShipReceiveAction('receive');
    setShipReceiveDialogOpen(true);
  };

  const handleAttachDocument = (record: any) => {
    setSelectedSharpeningRecord(record);
    setDocumentUploadOpen(true);
  };

  const handleViewSharpeningDetails = (sharpeningId: number) => {
    console.log('View sharpening details:', sharpeningId);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <Box>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#0066A1' }}>
            Die Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Drag and drop dies to machines, manage inventory, schedule sharpening, and view reports
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab icon={<TouchApp />} iconPosition="start" label="Interactive" />
            <Tab icon={<Inventory />} iconPosition="start" label="Inventory" />
            <Tab icon={<LocalShipping />} iconPosition="start" label="Sharpening" />
            <Tab icon={<Assessment />} iconPosition="start" label="Reports" />
          </Tabs>
        </Box>

        {/* Tab 0: Interactive View */}
        {activeTab === 0 && (
          <Box>
            {/* Die Press Machines */}
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#0066A1' }}>
              Die Press Machines
            </Typography>

            <Grid container spacing={3} sx={{ mb: 4 }}>
              {machines.length === 0 ? (
                <Grid item xs={12}>
                  <Card sx={{ p: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                      No die press machines found
                    </Typography>
                  </Card>
                </Grid>
              ) : (
                <>
                  {machines.map((machine) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={machine.machine_id}>
                      <DiePressCard
                        machine={machine}
                        onRemoveDie={openRemovalDialog}
                        isDropTarget={activeDie !== null && !machine.current_die}
                      />
                    </Grid>
                  ))}
                  {/* Sharpening Zone */}
                  <Grid item xs={12} sm={6} md={4} lg={3}>
                    <SharpeningZone
                      isDropTarget={activeDie !== null}
                      outForSharpening={outForSharpening}
                      onReceiveBack={fetchAllData}
                    />
                  </Grid>
                </>
              )}
            </Grid>

            {/* Die Shelf */}
            <DieShelf
              dies={availableDies}
              machines={machines}
              isDropTarget={activeDie !== null}
            />
          </Box>
        )}

        {/* Tab 1: Die Inventory */}
        {activeTab === 1 && (
          <DieInventoryList
            onViewDetails={handleViewDetails}
            onAddDie={handleAddDie}
            onEditDie={handleEditDie}
            onInstallDie={handleInstallDie}
            onRemoveDie={handleRemoveDie}
            onDeleteDie={handleDeleteDie}
          />
        )}

        {/* Tab 2: Sharpening Queue */}
        {activeTab === 2 && (
          <SharpeningQueueList
            onScheduleSharpening={handleScheduleSharpening}
            onViewDetails={handleViewSharpeningDetails}
            onShip={handleShip}
            onReceive={handleReceive}
            onAttachDocument={handleAttachDocument}
          />
        )}

        {/* Tab 3: Reports */}
        {activeTab === 3 && (
          <Card>
            <CardContent>
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Advanced Reports & Analytics
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  View detailed usage analysis, cost reports, and predictive maintenance insights
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate('/die-tracker/reports')}
                  sx={{
                    bgcolor: '#FF6600',
                    '&:hover': { bgcolor: '#E55A00' },
                  }}
                >
                  Open Reports Dashboard
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Existing Dialogs */}
        <AddEditDieDialog
          open={addEditDialogOpen}
          onClose={() => setAddEditDialogOpen(false)}
          onSuccess={handleSuccess}
          die={selectedDie}
        />

        <DieChangeDialog
          open={changeDialogOpen}
          onClose={() => setChangeDialogOpen(false)}
          onSuccess={handleSuccess}
          die={selectedDie}
          action={changeAction}
        />

        <ScheduleSharpeningDialog
          open={scheduleSharpeningOpen}
          onClose={() => setScheduleSharpeningOpen(false)}
          onSuccess={handleSuccess}
          preselectedDie={selectedDie}
        />

        <ShipReceiveDialog
          open={shipReceiveDialogOpen}
          onClose={() => setShipReceiveDialogOpen(false)}
          onSuccess={handleSuccess}
          record={selectedSharpeningRecord}
          action={shipReceiveAction}
        />

        <DocumentUploadDialog
          open={documentUploadOpen}
          onClose={() => setDocumentUploadOpen(false)}
          onSuccess={handleSuccess}
          record={selectedSharpeningRecord}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => !deleting && setDeleteDialogOpen(false)}
        >
          <DialogTitle>Delete Die</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to permanently delete <strong>{dieToDelete?.die_number}</strong>?
              <br /><br />
              This will delete:
              <ul>
                <li>Die record and all specifications</li>
                <li>All change history records</li>
                <li>All sharpening records</li>
                <li>All associated documents</li>
              </ul>
              <strong>This action cannot be undone.</strong>
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              color="error"
              variant="contained"
              disabled={deleting}
              startIcon={deleting ? <CircularProgress size={20} /> : <Delete />}
            >
              {deleting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Interactive View Dialogs */}
        <SharpeningConfirmDialog
          open={sharpeningDialogOpen}
          die={dieForSharpening}
          onClose={() => {
            setSharpeningDialogOpen(false);
            setDieForSharpening(null);
          }}
          onConfirm={handleSendToSharpening}
        />

        <RemovalReasonDialog
          open={removalDialogOpen}
          die={dieForRemoval}
          onClose={() => {
            setRemovalDialogOpen(false);
            setDieForRemoval(null);
            setPendingActionAfterRemoval(null);
          }}
          onConfirm={handleRemovalConfirm}
        />
      </Box>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeDie ? (
          <DieChip
            die={activeDie}
            isDragging={true}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default DieTracker;
