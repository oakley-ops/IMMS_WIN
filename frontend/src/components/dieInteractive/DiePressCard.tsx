import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Eject as EjectIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';
import { useDroppable } from '@dnd-kit/core';
import DieChip from './DieChip';

interface Die {
  die_id: number;
  die_number: string;
  die_name: string;
  die_type: string;
  status: string;
  compatible_machine_ids: number[] | null;
}

interface Machine {
  machine_id: number;
  name: string;
  location: string;
  current_die_id: number | null;
  current_die?: Die | null;
}

interface DiePressCardProps {
  machine: Machine;
  onRemoveDie: (die: Die) => void;
  isDropTarget?: boolean;
}

const DiePressCard: React.FC<DiePressCardProps> = ({
  machine,
  onRemoveDie,
  isDropTarget = false,
}) => {
  const [isHovering, setIsHovering] = useState(false);

  const hasDie = machine.current_die !== null && machine.current_die !== undefined;

  const { isOver, setNodeRef } = useDroppable({
    id: `machine-${machine.machine_id}`,
    data: {
      type: 'machine',
      machineId: machine.machine_id,
    },
    disabled: hasDie,
  });

  const showDropIndicator = isDropTarget && !hasDie;

  return (
    <Paper
      ref={setNodeRef}
      elevation={3}
      sx={{
        height: '100%',
        minHeight: 350,
        borderRadius: 2,
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        border: isOver ? '3px dashed #4CAF50' : showDropIndicator ? '3px dashed #90CAF9' : '3px solid transparent',
        transform: isOver ? 'scale(1.02)' : 'scale(1)',
        bgcolor: isOver ? 'rgba(76, 175, 80, 0.1)' : showDropIndicator ? 'rgba(33, 150, 243, 0.05)' : 'white',
        boxShadow: isOver ? '0 8px 25px rgba(76, 175, 80, 0.3)' : undefined,
      }}
    >
      {/* Machine Header */}
      <Box
        sx={{
          bgcolor: '#FF6B35',
          color: 'white',
          p: 2,
          textAlign: 'center',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          {machine.name}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 0.5 }}>
          <LocationIcon sx={{ fontSize: 16, mr: 0.5, opacity: 0.8 }} />
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            {machine.location || 'No location'}
          </Typography>
        </Box>
      </Box>

      {/* Machine Body - Visual Representation */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: 300,
        }}
      >
        {/* Machine Image/Icon */}
        <Box
          sx={{
            width: '100%',
            height: 200,
            bgcolor: '#e8e8e8',
            borderRadius: 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
            position: 'relative',
            border: '1px solid #ccc',
            backgroundImage: machine.name.includes('704')
              ? 'none'
              : 'linear-gradient(135deg, #f5f5f5 25%, #e8e8e8 25%, #e8e8e8 50%, #f5f5f5 50%, #f5f5f5 75%, #e8e8e8 75%)',
            backgroundSize: '20px 20px',
            overflow: 'hidden',
          }}
        >
          {machine.name.includes('704') ? (
            /* Custom Oasys Image for Die Press 704 */
            <Box
              component="img"
              src="/images/Oasys.jpg"
              alt="Oasys Die Press"
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                background: "white"
              }}
              />
            ) : machine.name.includes('705') ? (
              /* Custom Image for Die Press 705 */
              <Box
                component="img"
                src="/images/Muhlbauer.jpg"
                alt="Muhlbauer Die Press 705"
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  background: "white"
                }}
            />
          ) : machine.name.includes('701') ? (
            /* Custom Image for Die Press 701 */
            <Box
              component="img"
              src="/images/spartanics.jpeg"
              alt="Spartanics Die Press 701"
              sx={{
                width: '120%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <>
              {/* Machine Icon */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 10,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: 40,
                }}
              >
                🏭
              </Box>
            </>
          )}

          {/* Control Panel */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 10,
              right: 10,
              display: 'flex',
              gap: 0.5,
            }}
          >
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: hasDie ? '#4CAF50' : '#999' }} />
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#2196F3' }} />
          </Box>
        </Box>

        {/* Die Slot */}
        <Box
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          sx={{
            width: '100%',
            minHeight: 100,
            borderRadius: 2,
            border: hasDie ? '2px solid #4CAF50' : isOver ? '2px solid #4CAF50' : '2px dashed #ccc',
            bgcolor: hasDie ? 'rgba(76, 175, 80, 0.1)' : isOver ? 'rgba(76, 175, 80, 0.15)' : '#fafafa',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            transition: 'all 0.2s ease',
          }}
        >
          {hasDie && machine.current_die ? (
            <>
              {/* Installed Die - Make it draggable */}
              <Box sx={{ p: 1 }}>
                <DieChip
                  die={machine.current_die}
                  fromMachine={machine.machine_id}
                />
              </Box>

              {/* Eject Button */}
              {isHovering && (
                <Tooltip title="Remove Die">
                  <IconButton
                    onClick={() => onRemoveDie(machine.current_die!)}
                    sx={{
                      position: 'absolute',
                      top: 5,
                      right: 5,
                      bgcolor: '#F44336',
                      color: 'white',
                      '&:hover': { bgcolor: '#D32F2F' },
                    }}
                    size="small"
                  >
                    <EjectIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </>
          ) : (
            <>
              {/* Empty Slot */}
              <Typography
                variant="body1"
                sx={{
                  color: isOver ? '#4CAF50' : showDropIndicator ? '#2196F3' : '#999',
                  fontWeight: isOver ? 'bold' : 'normal',
                  transition: 'all 0.2s ease',
                }}
              >
                {isOver ? 'Drop die here!' : showDropIndicator ? 'Drop target' : 'No die installed'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#bbb', mt: 0.5 }}>
                Drag a die from the shelf
              </Typography>
            </>
          )}
        </Box>
      </Box>

      {/* Status Bar */}
      <Box
        sx={{
          bgcolor: hasDie ? '#4CAF50' : '#9E9E9E',
          color: 'white',
          py: 1,
          px: 2,
          textAlign: 'center',
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
          {hasDie ? 'OPERATIONAL' : 'IDLE - NO DIE'}
        </Typography>
      </Box>
    </Paper>
  );
};

export default DiePressCard;
