import React from 'react';
import { PRIMARY_ORANGE } from '../../theme';
import {
  Box,
  Typography,
  Chip,
  Tooltip,
} from '@mui/material';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Build as BuildIcon } from '@mui/icons-material';

interface Die {
  die_id: number;
  die_number: string;
  die_name: string;
  die_type: string;
  status: string;
  compatible_machine_ids: number[] | null;
  last_inspection_date?: string;
  sharpenings_count?: number;
}

interface DieChipProps {
  die: Die;
  compatibleMachineIds?: number[];
  compatibleMachineNames?: string[];
  fromMachine?: number;
  isDragging?: boolean;
}

// Format relative time (e.g., "3 days ago", "2 weeks ago", "1 month ago")
const formatRelativeTime = (dateString: string | undefined): string => {
  if (!dateString) return 'Never sharpened';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return '1 month ago';
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  if (diffDays < 730) return '1 year ago';
  return `${Math.floor(diffDays / 365)} years ago`;
};

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const DieChip: React.FC<DieChipProps> = ({ die, compatibleMachineIds, compatibleMachineNames, fromMachine, isDragging = false }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging: isCurrentlyDragging } = useDraggable({
    id: `die-${die.die_id}`,
    data: {
      die,
      fromMachine,
    },
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
  } : undefined;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SHARP':
        return '#4CAF50';
      case 'USED':
        return '#FFC107';
      case 'IN_MACHINE':
        return '#2196F3';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SHARP':
        return 'Sharp';
      case 'USED':
        return 'Used';
      case 'IN_MACHINE':
        return 'Installed';
      default:
        return status;
    }
  };

  // Tooltip content showing last sharpening info
  const tooltipContent = (
    <Box sx={{ p: 0.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
        {die.die_name || `Die #${die.die_number}`}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <BuildIcon sx={{ fontSize: 14 }} />
        <Typography variant="caption">
          Last sharpened: <strong>{formatRelativeTime(die.last_inspection_date)}</strong>
        </Typography>
      </Box>
      {die.last_inspection_date && (
        <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.7)' }}>
          {formatDate(die.last_inspection_date)}
        </Typography>
      )}
      {die.sharpenings_count !== undefined && die.sharpenings_count > 0 && (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
          Total sharpenings: {die.sharpenings_count}
        </Typography>
      )}
    </Box>
  );

  const chipContent = (
    <>
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 'bold',
          color: '#333',
          textAlign: 'center',
          mb: 0.5,
        }}
      >
        Die #{die.die_number}
      </Typography>

      <Chip
        label={die.die_type}
        size="small"
        sx={{
          width: '100%',
          bgcolor: PRIMARY_ORANGE,
          color: 'white',
          fontWeight: 'bold',
          fontSize: '0.65rem',
          mb: 0.5,
        }}
      />

      <Chip
        label={getStatusLabel(die.status)}
        size="small"
        sx={{
          width: '100%',
          bgcolor: getStatusColor(die.status),
          color: 'white',
          fontWeight: 'bold',
          fontSize: '0.65rem',
        }}
      />

      {compatibleMachineNames && compatibleMachineNames.length > 0 && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'center',
            mt: 0.5,
            color: '#666',
            fontSize: '0.55rem',
            lineHeight: 1.2,
          }}
        >
          {compatibleMachineNames.join(', ')}
        </Typography>
      )}
    </>
  );

  // When used in DragOverlay, don't use useDraggable refs
  if (isDragging) {
    return (
      <Box
        sx={{
          width: 120,
          p: 1.5,
          bgcolor: 'white',
          borderRadius: 2,
          border: `3px solid ${getStatusColor(die.status)}`,
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          transform: 'scale(1.1) rotate(3deg)',
          cursor: 'grabbing',
          zIndex: 1000,
        }}
      >
        {chipContent}
      </Box>
    );
  }

  return (
    <Tooltip
      title={tooltipContent}
      arrow
      placement="top"
      enterDelay={300}
      leaveDelay={100}
      componentsProps={{
        tooltip: {
          sx: {
            bgcolor: 'rgba(33, 33, 33, 0.95)',
            '& .MuiTooltip-arrow': {
              color: 'rgba(33, 33, 33, 0.95)',
            },
            maxWidth: 220,
          },
        },
      }}
    >
      <Box
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        sx={{
          width: 120,
          p: 1.5,
          bgcolor: 'white',
          borderRadius: 2,
          border: `2px solid ${getStatusColor(die.status)}`,
          cursor: isCurrentlyDragging ? 'grabbing' : 'grab',
          transition: isCurrentlyDragging ? 'none' : 'all 0.2s ease',
          opacity: isCurrentlyDragging ? 0.5 : 1,
          '&:hover': {
            transform: isCurrentlyDragging ? 'none' : 'scale(1.05)',
            boxShadow: 3,
          },
          touchAction: 'none',
        }}
      >
        {chipContent}
      </Box>
    </Tooltip>
  );
};

export default DieChip;
