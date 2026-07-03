'use client';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box, Typography, Chip, IconButton, Tooltip, Button, MenuItem, Select, FormControl,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material';
import { Fullscreen, FullscreenExit, Edit, Settings } from '@mui/icons-material';
import { io } from 'socket.io-client';
import svc, {
  BoardStatusEntry, BoardStatus, CallBoardLayout, CallBoardLayoutSummary,
  CallBoardTile, LayoutOrientation,
} from '../services/maintenanceCallService';
import layoutsSvc from '../services/callBoardLayoutsService';
import MachineTile, { STATUS_STYLE, STATUS_ORDER } from './callboard/MachineTile';
import CallBoardEditor from './callboard/CallBoardEditor';
import LayoutSettingsDialog from './callboard/LayoutSettingsDialog';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4001';

const CallBoard: React.FC = () => {
  const [entries, setEntries] = useState<BoardStatusEntry[]>([]);
  const [now, setNow] = useState<number | null>(null);
  const [connected, setConnected] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [layouts, setLayouts] = useState<CallBoardLayoutSummary[]>([]);
  const [layout, setLayout] = useState<CallBoardLayout | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<{ call_id: number; machine_name: string } | null>(null);
  const [suspendNotes, setSuspendNotes] = useState('');

  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    setIsAuthed(!!localStorage.getItem('mcs_token'));
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const fetchBoard = useCallback(async () => {
    try {
      const data = await svc.getBoardStatus();
      setEntries(data);
    } catch { /* keep stale data */ }
  }, []);

  const fetchLayouts = useCallback(async () => {
    try {
      const list = await layoutsSvc.list();
      setLayouts(list);
      setLayout(prev => {
        if (prev) return prev;
        if (list.length === 0) return null;
        // We pick a default eagerly below — return prev for now.
        return prev;
      });
      if (list.length > 0) {
        // Re-resolve "current" if we don't have one yet.
        setLayout(current => {
          if (current) return current;
          const def = list.find(l => l.is_default) || list[0];
          layoutsSvc.get(def.layout_id).then(setLayout).catch(() => {});
          return current;
        });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchBoard();
    fetchLayouts();
    const socket = io(SOCKET_URL, { transports: ['polling', 'websocket'] });
    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('maintenance_call_created',  fetchBoard);
    socket.on('maintenance_call_updated',  fetchBoard);
    socket.on('maintenance_call_resolved', fetchBoard);
    socket.on('call_board_layout_updated', fetchLayouts);

    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(fetchBoard, 30000);

    return () => { socket.disconnect(); clearInterval(tick); clearInterval(poll); };
  }, [fetchBoard, fetchLayouts]);

  const statusByMachine = useMemo(
    () => new Map(entries.map(e => [e.machine_id, e])),
    [entries]
  );

  const counts = useMemo(
    () => STATUS_ORDER.reduce<Record<BoardStatus, number>>(
      (acc, s) => { acc[s] = entries.filter(e => e.status === s).length; return acc; },
      { running: 0, wait: 0, te_present: 0, suspend: 0, pm: 0 }
    ),
    [entries]
  );

  // ─── Layout operations ────────────────────────────────────────────────────

  const switchLayout = async (layout_id: number) => {
    const full = await layoutsSvc.get(layout_id);
    setLayout(full);
  };

  const handleSaveTiles = async (tiles: Omit<CallBoardTile, 'tile_id' | 'machine_name'>[]) => {
    if (!layout) return;
    setSaving(true);
    try {
      const { tiles: saved } = await layoutsSvc.saveTiles(layout.layout_id, tiles);
      setLayout({ ...layout, tiles: saved });
      setEditMode(false);
    } catch (err) {
      console.error('Failed to save layout:', err);
      alert('Failed to save layout. Check console.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLayout = async (changes: Partial<Pick<CallBoardLayout,
    'name' | 'orientation' | 'grid_cols' | 'grid_rows' | 'is_default'>>) => {
    if (!layout) return;
    try {
      const updated = await layoutsSvc.update(layout.layout_id, changes);
      setLayout({ ...layout, ...updated });
      fetchLayouts();
    } catch (err) { console.error('Failed to update layout:', err); }
  };

  const handleCreateLayout = async (payload: { name: string; orientation: LayoutOrientation; grid_cols: number; grid_rows: number; is_default: boolean }) => {
    try {
      const created = await layoutsSvc.create(payload);
      setLayout(created);
      fetchLayouts();
    } catch (err) { console.error('Failed to create layout:', err); }
  };

  const handleDeleteLayout = async () => {
    if (!layout) return;
    try {
      await layoutsSvc.remove(layout.layout_id);
      setLayout(null);
      setEditMode(false);
      fetchLayouts();
    } catch (err) { console.error('Failed to delete layout:', err); }
  };

  // ─── Suspend / resume ────────────────────────────────────────────────────

  const handleSuspendRequest = (call_id: number, machine_name: string) => {
    setSuspendTarget({ call_id, machine_name });
    setSuspendNotes('');
  };

  const confirmSuspend = async () => {
    if (!suspendTarget) return;
    try {
      await svc.suspendCall(suspendTarget.call_id, suspendNotes.trim() || undefined);
      setSuspendTarget(null);
      fetchBoard();
    } catch (err) {
      console.error('Failed to suspend call:', err);
      alert('Failed to suspend call. You may not have permission.');
    }
  };

  const handleResume = async (call_id: number) => {
    try {
      await svc.resumeCall(call_id);
      fetchBoard();
    } catch (err) {
      console.error('Failed to resume call:', err);
      alert('Failed to resume call. You may not have permission.');
    }
  };

  const startEditing = async () => {
    if (!layout) {
      try {
        const created = await layoutsSvc.create({
          name: 'Main Floor', orientation: 'landscape',
          grid_cols: 12, grid_rows: 8, is_default: true,
        });
        setLayout(created);
        await fetchLayouts();
      } catch (err) {
        console.error('Failed to create initial layout:', err);
        return;
      }
    }
    setEditMode(true);
  };

  // ─── Rendering ────────────────────────────────────────────────────────────

  const renderHeader = () => (
    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
      <Box display="flex" alignItems="center" gap={2}>
        <Typography variant="h4" fontWeight="bold" sx={{ letterSpacing: 2 }}>
          MAINTENANCE CALL BOARD
        </Typography>
        {!connected && (
          <Chip label="RECONNECTING…" size="small" sx={{ bgcolor: '#616161', color: 'white' }} />
        )}
      </Box>
      <Box display="flex" alignItems="center" gap={1}>
        {layouts.length > 0 && !editMode && (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <Select
              value={layout?.layout_id ?? ''}
              onChange={(e) => switchLayout(Number(e.target.value))}
              sx={{
                color: 'white',
                '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                '.MuiSvgIcon-root': { color: 'white' },
              }}
            >
              {layouts.map(l => (
                <MenuItem key={l.layout_id} value={l.layout_id}>
                  {l.name} {l.is_default && '★'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {isAuthed && !editMode && (
          <>
            <Tooltip title="Edit layout">
              <Button startIcon={<Edit />} variant="outlined" size="small" onClick={startEditing}
                sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)' }}>
                Edit
              </Button>
            </Tooltip>
            {layout && (
              <Tooltip title="Layout settings">
                <IconButton size="small" onClick={() => setSettingsOpen(true)} sx={{ color: 'white' }}>
                  <Settings />
                </IconButton>
              </Tooltip>
            )}
          </>
        )}
        <Typography variant="h6" color="grey.300" sx={{ fontFamily: '"Roboto Mono", monospace', ml: 1 }} suppressHydrationWarning>
          {now !== null ? new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
        </Typography>
        <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
          <IconButton onClick={toggleFullscreen} sx={{ color: 'grey.300', '&:hover': { color: 'white' } }}>
            {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  const renderLegend = () => (
    <Box display="flex" gap={1.5} mb={2.5} flexWrap="wrap">
      {STATUS_ORDER.map(s => (
        <Box key={s} sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          bgcolor: 'rgba(255,255,255,0.06)',
          borderLeft: `6px solid ${STATUS_STYLE[s].bg}`,
          borderRadius: 1, px: 1.5, py: 0.5,
        }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold', letterSpacing: 1 }}>
            {STATUS_STYLE[s].label}
          </Typography>
          <Typography variant="h6" fontWeight="bold">{counts[s]}</Typography>
        </Box>
      ))}
    </Box>
  );

  const renderSavedLayout = () => {
    if (!layout) return null;
    return (
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${layout.grid_cols}, 1fr)`,
        gridAutoRows: `minmax(80px, 1fr)`,
        gap: 1.25,
        aspectRatio: layout.orientation === 'portrait' ? '9 / 16' : '16 / 9',
        maxHeight: 'calc(100vh - 220px)',
      }}>
        {layout.tiles.map(t => {
          const entry = statusByMachine.get(t.machine_id);
          if (!entry) return null;
          return (
            <Box key={t.machine_id} sx={{
              gridColumn: `${t.col_start + 1} / span ${t.col_span}`,
              gridRow:    `${t.row_start + 1} / span ${t.row_span}`,
            }}>
              <MachineTile
                entry={entry}
                now={now ?? Date.now()}
                onSuspend={isAuthed ? handleSuspendRequest : undefined}
                onResume={isAuthed ? handleResume : undefined}
              />
            </Box>
          );
        })}
      </Box>
    );
  };

  const renderAutoFill = () => (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: 1.5,
    }}>
      {entries.map(e => (
        <Box key={e.machine_id} sx={{ minHeight: 140 }}>
          <MachineTile
            entry={e}
            now={now ?? Date.now()}
            onSuspend={isAuthed ? handleSuspendRequest : undefined}
            onResume={isAuthed ? handleResume : undefined}
          />
        </Box>
      ))}
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#101025', color: 'white', p: 2.5 }}>
      {renderHeader()}
      {!editMode && renderLegend()}

      {editMode && layout ? (
        <CallBoardEditor
          layout={layout}
          statusByMachine={statusByMachine}
          allMachines={entries.map(e => ({ machine_id: e.machine_id, name: e.name, location: e.location }))}
          now={now ?? Date.now()}
          saving={saving}
          onSave={handleSaveTiles}
          onCancel={() => setEditMode(false)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : entries.length === 0 ? (
        <Box sx={{ p: 6, textAlign: 'center', color: 'grey.500' }}>
          <Typography>No machines to display</Typography>
        </Box>
      ) : layout && layout.tiles.length > 0 ? (
        renderSavedLayout()
      ) : (
        renderAutoFill()
      )}

      <Dialog open={!!suspendTarget} onClose={() => setSuspendTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Suspend call — {suspendTarget?.machine_name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={1.5}>
            Suspend the active call. The tile turns red until a tech resumes it.
          </Typography>
          <TextField
            autoFocus fullWidth
            label="Suspension notes (optional)"
            value={suspendNotes}
            onChange={(e) => setSuspendNotes(e.target.value)}
            placeholder="e.g. Awaiting part, stepped away to other call"
            multiline rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuspendTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmSuspend}>Suspend</Button>
        </DialogActions>
      </Dialog>

      <LayoutSettingsDialog
        open={settingsOpen}
        layout={layout}
        allLayouts={layouts}
        onClose={() => setSettingsOpen(false)}
        onUpdate={handleUpdateLayout}
        onCreateNew={handleCreateLayout}
        onDelete={handleDeleteLayout}
        onSwitch={switchLayout}
      />
    </Box>
  );
};

export default CallBoard;
