import React from 'react';
import {
  Box,
  Typography,
  Chip,
} from '@mui/material';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface Die {
  die_id: number;
  die_number: string;
  die_name: string;
  die_type: string;
  status: string;
  compatible_machine_ids: number[] | null;
}

interface DieChipProps {
  die: Die;
  compatibleMachineIds?: number[];
  fromMachine?: number;
  isDragging?: boolean;
}

const DieChip: React.FC<DieChipProps> = ({ die, compatibleMachineIds, fromMachine, isDragging = false }) => {
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
        return '#F44336';
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
            bgcolor: '#FF6600',
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
      </Box>
    );
  }

  return (
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
          bgcolor: '#FF6600',
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

      {compatibleMachineIds && compatibleMachineIds.length > 0 && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'center',
            mt: 0.5,
            color: '#666',
            fontSize: '0.6rem',
          }}
        >
          {compatibleMachineIds.length} machine{compatibleMachineIds.length > 1 ? 's' : ''}
        </Typography>
      )}
    </Box>
  );
};

export default DieChip;
