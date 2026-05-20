'use client';
import React, { useState } from 'react';
import { Box, Typography, Chip, IconButton, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { Close, Block, PlayArrow } from '@mui/icons-material';
import { BoardStatusEntry, BoardStatus } from '../../services/maintenanceCallService';

export const STATUS_STYLE: Record<BoardStatus, { bg: string; text: string; label: string }> = {
  running:    { bg: '#2e7d32', text: '#ffffff', label: 'RUNNING' },
  wait:       { bg: '#fbc02d', text: '#1a1a1a', label: 'WAIT' },
  te_present: { bg: '#ef6c00', text: '#ffffff', label: 'TE PRESENT' },
  suspend:    { bg: '#c62828', text: '#ffffff', label: 'SUSPEND' },
  pm:         { bg: '#7b1fa2', text: '#ffffff', label: 'PM' },
};

export const STATUS_ORDER: BoardStatus[] = ['wait', 'te_present', 'suspend', 'pm', 'running'];

export function elapsedShort(from: string | null, now: number): string {
  if (!from) return '';
  const secs = Math.max(0, Math.floor((now - new Date(from).getTime()) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export interface MachineTileProps {
  entry: BoardStatusEntry;
  now: number;
  editMode?: boolean;
  onRemove?: (machine_id: number) => void;
  onSuspend?: (call_id: number, machine_name: string) => void;
  onResume?: (call_id: number) => void;
}

const MachineTile: React.FC<MachineTileProps> = ({
  entry, now, editMode, onRemove, onSuspend, onResume,
}) => {
  const style = STATUS_STYLE[entry.status];
  const flashing = entry.status === 'wait' && !editMode;
  const critical = entry.priority === 'critical';

  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const canSuspend = !!onSuspend && entry.status === 'te_present' && entry.call_id !== null;
  const canResume  = !!onResume  && entry.status === 'suspend'    && entry.call_id !== null;

  const handleContextMenu = (e: React.MouseEvent) => {
    if (editMode) return;
    if (!canSuspend && !canResume) return;
    e.preventDefault();
    setMenuAnchor({ x: e.clientX, y: e.clientY });
  };
  const closeMenu = () => setMenuAnchor(null);

  let subline: string | null = null;
  switch (entry.status) {
    case 'wait':
      subline = entry.operator_name ? `Operator: ${entry.operator_name}` : null;
      break;
    case 'te_present':
      subline = entry.technician_name ? `Tech: ${entry.technician_name}` : null;
      break;
    case 'suspend':
      subline = entry.suspension_notes ? `Suspended: ${entry.suspension_notes}` : 'Suspended';
      break;
    case 'pm':
      subline = 'PM in progress';
      break;
    default:
      subline = null;
  }

  return (
    <Box
      onContextMenu={handleContextMenu}
      sx={{
        bgcolor: style.bg,
        color: style.text,
        borderRadius: 2,
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        minHeight: editMode ? 0 : 140,
        boxShadow: critical
          ? '0 0 0 4px #ff1744, 0 4px 12px rgba(0,0,0,0.35)'
          : '0 4px 12px rgba(0,0,0,0.25)',
        outline: editMode ? '2px dashed rgba(255,255,255,0.45)' : 'none',
        position: 'relative',
        overflow: 'hidden',
        animation: flashing ? 'tilePulse 1.4s ease-in-out infinite' : 'none',
        cursor: editMode ? 'move' : 'default',
        userSelect: 'none',
        '@keyframes tilePulse': {
          '0%, 100%': { filter: 'brightness(1)' },
          '50%':      { filter: 'brightness(1.25)' },
        },
      }}
    >
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={1}>
        <Typography variant="caption" sx={{ fontWeight: 'bold', letterSpacing: 1, opacity: 0.9 }}>
          {style.label}
        </Typography>
        <Box display="flex" gap={0.5} alignItems="center">
          {entry.queue_position != null && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 32,
                height: 32,
                px: 1,
                borderRadius: '16px',
                fontSize: '1.1rem',
                fontWeight: 800,
                lineHeight: 1,
                bgcolor: critical ? '#ff1744' : 'rgba(0,0,0,0.55)',
                color: '#fff',
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              }}
            >
              #{entry.queue_position}
            </Box>
          )}
          {critical && (
            <Chip
              label="CRITICAL"
              size="small"
              sx={{
                bgcolor: 'rgba(255,255,255,0.95)',
                color: '#c62828',
                fontWeight: 'bold',
                fontSize: '0.65rem',
                height: 20,
              }}
            />
          )}
          {editMode && onRemove && (
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onRemove(entry.machine_id); }}
              onMouseDown={(e) => e.stopPropagation()}
              sx={{ p: 0.25, color: 'inherit', bgcolor: 'rgba(0,0,0,0.25)', '&:hover': { bgcolor: 'rgba(0,0,0,0.45)' } }}
            >
              <Close fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>

      <Typography
        sx={{
          fontWeight: 'bold',
          fontSize: 'clamp(1rem, 1.6vw, 1.8rem)',
          lineHeight: 1.1,
          textAlign: 'center',
          my: 0.5,
          wordBreak: 'break-word',
        }}
      >
        {entry.name}
      </Typography>

      <Box>
        {subline && (
          <Typography variant="caption" sx={{ opacity: 0.95, fontWeight: 500, display: 'block' }}>
            {subline}
          </Typography>
        )}
      </Box>

      <Menu
        open={!!menuAnchor}
        onClose={closeMenu}
        anchorReference="anchorPosition"
        anchorPosition={menuAnchor ? { top: menuAnchor.y, left: menuAnchor.x } : undefined}
      >
        {canSuspend && (
          <MenuItem onClick={() => { closeMenu(); onSuspend!(entry.call_id!, entry.name); }}>
            <ListItemIcon><Block fontSize="small" /></ListItemIcon>
            <ListItemText>Suspend call…</ListItemText>
          </MenuItem>
        )}
        {canResume && (
          <MenuItem onClick={() => { closeMenu(); onResume!(entry.call_id!); }}>
            <ListItemIcon><PlayArrow fontSize="small" /></ListItemIcon>
            <ListItemText>Resume call</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

export default MachineTile;
