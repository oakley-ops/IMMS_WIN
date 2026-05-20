'use client';
import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  FormControl, InputLabel, Select, MenuItem, FormControlLabel, Switch,
  Slider, Typography, Box, Divider,
} from '@mui/material';
import {
  CallBoardLayout, CallBoardLayoutSummary, LayoutOrientation,
} from '../../services/maintenanceCallService';

interface Props {
  open: boolean;
  layout: CallBoardLayout | null;
  allLayouts: CallBoardLayoutSummary[];
  onClose: () => void;
  onUpdate: (changes: Partial<Pick<CallBoardLayout, 'name' | 'orientation' | 'grid_cols' | 'grid_rows' | 'is_default'>>) => void;
  onCreateNew: (payload: { name: string; orientation: LayoutOrientation; grid_cols: number; grid_rows: number; is_default: boolean }) => void;
  onDelete: () => void;
  onSwitch: (layout_id: number) => void;
}

const LayoutSettingsDialog: React.FC<Props> = ({
  open, layout, allLayouts, onClose, onUpdate, onCreateNew, onDelete, onSwitch,
}) => {
  const [name, setName] = useState('');
  const [orientation, setOrientation] = useState<LayoutOrientation>('landscape');
  const [cols, setCols] = useState(12);
  const [rows, setRows] = useState(8);
  const [isDefault, setIsDefault] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);

  useEffect(() => {
    if (layout) {
      setName(layout.name);
      setOrientation(layout.orientation);
      setCols(layout.grid_cols);
      setRows(layout.grid_rows);
      setIsDefault(layout.is_default);
    }
    setCreatingNew(false);
  }, [layout, open]);

  const handleSave = () => {
    if (creatingNew) {
      onCreateNew({ name: name.trim(), orientation, grid_cols: cols, grid_rows: rows, is_default: isDefault });
    } else if (layout) {
      onUpdate({ name: name.trim(), orientation, grid_cols: cols, grid_rows: rows, is_default: isDefault });
    }
    onClose();
  };

  const startNew = () => {
    setCreatingNew(true);
    setName('');
    setOrientation('landscape');
    setCols(12);
    setRows(8);
    setIsDefault(allLayouts.length === 0);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{creatingNew ? 'New Layout' : 'Layout Settings'}</DialogTitle>
      <DialogContent>
        {!creatingNew && allLayouts.length > 0 && (
          <Box mb={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Switch Layout</InputLabel>
              <Select
                value={layout?.layout_id ?? ''}
                label="Switch Layout"
                onChange={(e) => onSwitch(Number(e.target.value))}
              >
                {allLayouts.map(l => (
                  <MenuItem key={l.layout_id} value={l.layout_id}>
                    {l.name} {l.is_default && '· default'} · {l.orientation}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box mt={1}>
              <Button size="small" onClick={startNew}>+ New Layout</Button>
            </Box>
            <Divider sx={{ my: 2 }} />
          </Box>
        )}

        <Box display="flex" flexDirection="column" gap={2}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            size="small"
          />

          <FormControl fullWidth size="small">
            <InputLabel>Orientation</InputLabel>
            <Select
              value={orientation}
              label="Orientation"
              onChange={(e) => {
                const o = e.target.value as LayoutOrientation;
                setOrientation(o);
                if (o === 'portrait'  && cols > rows) { setCols(8);  setRows(14); }
                if (o === 'landscape' && rows > cols) { setCols(12); setRows(8); }
              }}
            >
              <MenuItem value="landscape">Landscape (16:9 TV)</MenuItem>
              <MenuItem value="portrait">Portrait (vertical wall)</MenuItem>
            </Select>
          </FormControl>

          <Box>
            <Typography variant="caption" color="text.secondary">Grid columns: {cols}</Typography>
            <Slider value={cols} min={4} max={24} step={1}
              onChange={(_, v) => setCols(v as number)} valueLabelDisplay="auto" />
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary">Grid rows: {rows}</Typography>
            <Slider value={rows} min={4} max={20} step={1}
              onChange={(_, v) => setRows(v as number)} valueLabelDisplay="auto" />
          </Box>

          <FormControlLabel
            control={<Switch checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />}
            label="Set as default (shown on the TV display)"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        {!creatingNew && layout && allLayouts.length > 1 && (
          <Button color="error" onClick={() => { if (window.confirm(`Delete layout "${layout.name}"?`)) onDelete(); }}>
            Delete
          </Button>
        )}
        <Box flex={1} />
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!name.trim()}>
          {creatingNew ? 'Create' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LayoutSettingsDialog;
