'use client';
import React, { useMemo, useState } from 'react';
import GridLayout, { Layout, WidthProvider } from 'react-grid-layout';
import {
  Box, Button, Typography, Drawer, List, ListItem, ListItemButton,
  ListItemText, IconButton, Tooltip,
} from '@mui/material';
import { Add, Settings, Save, Close } from '@mui/icons-material';
import {
  BoardStatusEntry, CallBoardLayout, CallBoardTile,
} from '../../services/maintenanceCallService';
import MachineTile from './MachineTile';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(GridLayout);

interface Props {
  layout: CallBoardLayout;
  statusByMachine: Map<number, BoardStatusEntry>;
  allMachines: { machine_id: number; name: string; location?: string | null }[];
  now: number;
  saving: boolean;
  onSave: (tiles: Omit<CallBoardTile, 'tile_id' | 'machine_name'>[]) => void;
  onCancel: () => void;
  onOpenSettings: () => void;
}

const CallBoardEditor: React.FC<Props> = ({
  layout, statusByMachine, allMachines, now, saving, onSave, onCancel, onOpenSettings,
}) => {
  const [tiles, setTiles] = useState<CallBoardTile[]>(layout.tiles);
  const [addOpen, setAddOpen] = useState(false);

  const placedIds = useMemo(() => new Set(tiles.map(t => t.machine_id)), [tiles]);
  const available = allMachines.filter(m => !placedIds.has(m.machine_id));

  const rglItems: Layout[] = tiles.map(t => ({
    i: String(t.machine_id),
    x: t.col_start,
    y: t.row_start,
    w: t.col_span,
    h: t.row_span,
  }));

  const onLayoutChange = (next: Layout[]) => {
    const byId = new Map(next.map(l => [l.i, l]));
    setTiles(prev =>
      prev.map(t => {
        const l = byId.get(String(t.machine_id));
        if (!l) return t;
        return { ...t, col_start: l.x, row_start: l.y, col_span: l.w, row_span: l.h };
      })
    );
  };

  const findOpenSpot = (existing: CallBoardTile[], w: number, h: number) => {
    const cols = layout.grid_cols;
    const rows = layout.grid_rows;
    const occupied = (x: number, y: number) =>
      existing.some(t =>
        x < t.col_start + t.col_span &&
        x + w > t.col_start &&
        y < t.row_start + t.row_span &&
        y + h > t.row_start
      );
    for (let y = 0; y + h <= rows; y++) {
      for (let x = 0; x + w <= cols; x++) {
        if (!occupied(x, y)) return { x, y };
      }
    }
    return { x: 0, y: 0 };
  };

  const addMachine = (machine_id: number) => {
    setTiles(prev => {
      const { x, y } = findOpenSpot(prev, 2, 2);
      return [...prev, { machine_id, col_start: x, row_start: y, col_span: 2, row_span: 2 }];
    });
  };

  const removeMachine = (machine_id: number) => {
    setTiles(prev => prev.filter(t => t.machine_id !== machine_id));
  };

  const handleSave = () => {
    onSave(tiles.map(({ machine_id, col_start, row_start, col_span, row_span }) =>
      ({ machine_id, col_start, row_start, col_span, row_span })));
  };

  const rowHeight = typeof window !== 'undefined'
    ? Math.max(40, Math.floor((window.innerHeight - 220) / layout.grid_rows))
    : 60;

  return (
    <Box>
      {/* Toolbar */}
      <Box
        display="flex" alignItems="center" gap={1} mb={1.5} p={1}
        sx={{ bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 1 }}
      >
        <Typography variant="subtitle1" fontWeight="bold" sx={{ color: 'white', mr: 1 }}>
          EDITING — {layout.name}
        </Typography>
        <Typography variant="caption" sx={{ color: 'grey.400' }}>
          {layout.grid_cols} × {layout.grid_rows} · {layout.orientation}
        </Typography>
        <Box flex={1} />
        <Tooltip title="Layout settings">
          <IconButton size="small" onClick={onOpenSettings} sx={{ color: 'white' }}>
            <Settings />
          </IconButton>
        </Tooltip>
        <Button
          size="small" startIcon={<Add />} variant="outlined"
          onClick={() => setAddOpen(true)}
          sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)' }}
        >
          Add Machine ({available.length})
        </Button>
        <Button size="small" onClick={onCancel} sx={{ color: 'white' }}>
          Cancel
        </Button>
        <Button
          size="small" variant="contained" color="success" startIcon={<Save />}
          onClick={handleSave} disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Layout'}
        </Button>
      </Box>

      {/* Grid */}
      <Box sx={{
        bgcolor: 'rgba(255,255,255,0.03)',
        borderRadius: 2,
        p: 1,
        backgroundImage:
          'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),' +
          'linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: `${100 / layout.grid_cols}% ${rowHeight + 10}px`,
      }}>
        <ResponsiveGridLayout
          className="callboard-grid"
          layout={rglItems}
          cols={layout.grid_cols}
          maxRows={layout.grid_rows}
          rowHeight={rowHeight}
          margin={[10, 10]}
          containerPadding={[0, 0]}
          isDraggable
          isResizable
          compactType={null}
          preventCollision
          onLayoutChange={onLayoutChange}
        >
          {tiles.map(t => {
            const fallback = allMachines.find(m => m.machine_id === t.machine_id);
            const entry: BoardStatusEntry = statusByMachine.get(t.machine_id) || {
              machine_id: t.machine_id,
              name: fallback?.name || `#${t.machine_id}`,
              location: fallback?.location ?? null,
              status: 'running',
              call_id: null,
              called_at: null,
              operator_name: null,
              technician_name: null,
              technician_arrived_at: null,
              suspended_at: null,
              suspension_notes: null,
              priority: null,
              shift_name: null,
              pm_id: null,
              pm_started_at: null,
              queue_position: null,
            };
            return (
              <div key={String(t.machine_id)}>
                <MachineTile
                  entry={entry}
                  now={now}
                  editMode
                  onRemove={removeMachine}
                />
              </div>
            );
          })}
        </ResponsiveGridLayout>

        {tiles.length === 0 && (
          <Box p={6} textAlign="center" sx={{ color: 'grey.500' }}>
            <Typography>No machines placed. Use "Add Machine" to start.</Typography>
          </Box>
        )}
      </Box>

      {/* Add-machine drawer */}
      <Drawer anchor="right" open={addOpen} onClose={() => setAddOpen(false)}>
        <Box sx={{ width: 320, p: 2 }}>
          <Box display="flex" alignItems="center" mb={1}>
            <Typography variant="h6" fontWeight="bold" flex={1}>Add Machines</Typography>
            <IconButton size="small" onClick={() => setAddOpen(false)}><Close /></IconButton>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {available.length} machine{available.length === 1 ? '' : 's'} not on this layout
          </Typography>
          <List dense>
            {available.length === 0 ? (
              <ListItem><ListItemText primary="All machines are placed." /></ListItem>
            ) : available.map(m => (
              <ListItemButton key={m.machine_id} onClick={() => addMachine(m.machine_id)}>
                <ListItemText primary={m.name} secondary={m.location || undefined} />
                <Add fontSize="small" />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>
    </Box>
  );
};

export default CallBoardEditor;
