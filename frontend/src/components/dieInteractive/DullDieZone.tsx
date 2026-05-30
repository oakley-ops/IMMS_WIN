import React from 'react';
import { PRIMARY_ORANGE } from '../../theme';
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Warning as WarningIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { useDroppable } from '@dnd-kit/core';

interface DullDie {
  die_id: number;
  die_number: string;
  die_name: string;
  die_type: string;
  status: string;
  current_location?: string;
  compatible_machine_ids: number[] | null;
  machine_id?: number | null;
  last_inspection_date?: string;
  sharpenings_count?: number;
}

interface DullDieZoneProps {
  isDropTarget?: boolean;
  dullDies?: DullDie[];
  isAdmin?: boolean;
  onSendToSharpening?: (die: DullDie) => void;
}

const DullDieZone: React.FC<DullDieZoneProps> = ({
  isDropTarget = false,
  dullDies = [],
  isAdmin = false,
  onSendToSharpening,
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: 'dull-die-zone',
    data: {
      type: 'dull',
    },
  });

  return (
    <Paper
      ref={setNodeRef}
      elevation={3}
      sx={{
        p: 3,
        borderRadius: 2,
        bgcolor: isOver ? 'rgba(244, 67, 54, 0.15)' : '#ffebee',
        border: isOver ? '3px dashed #F44336' : isDropTarget ? '3px dashed #EF5350' : '3px solid #FFCDD2',
        transition: 'all 0.3s ease',
        boxShadow: isOver ? '0 8px 25px rgba(244, 67, 54, 0.3)' : undefined,
        transform: isOver ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Box
          sx={{
            width: 50,
            height: 50,
            borderRadius: '50%',
            bgcolor: isOver ? '#F44336' : '#EF5350',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mr: 2,
            transition: 'all 0.3s ease',
          }}
        >
          <WarningIcon sx={{ color: 'white', fontSize: 28 }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#C62828' }}>
            Dull Die Zone
          </Typography>
          <Typography variant="body2" sx={{ color: '#D32F2F' }}>
            Dies needing inspection/sharpening
          </Typography>
        </Box>
      </Box>

      {/* Drop Zone */}
      <Box
        sx={{
          minHeight: 60,
          p: 2,
          bgcolor: isOver ? 'rgba(244, 67, 54, 0.1)' : 'rgba(255, 205, 210, 0.5)',
          borderRadius: 2,
          border: isOver ? '2px solid #F44336' : '2px dashed #EF5350',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          mb: dullDies.length > 0 ? 2 : 0,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: isOver ? '#C62828' : '#D32F2F',
            fontWeight: isOver ? 'bold' : 'normal',
            textAlign: 'center',
          }}
        >
          {isOver ? (
            <>
              <WarningIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              Drop to mark as dull!
            </>
          ) : (
            'Drag a dull die here for tech review'
          )}
        </Typography>
      </Box>

      {/* Dull Dies List */}
      {dullDies.length > 0 && (
        <Box>
          <Typography
            variant="subtitle2"
            sx={{
              color: '#C62828',
              fontWeight: 'bold',
              mb: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <WarningIcon fontSize="small" />
            Awaiting Review ({dullDies.length})
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {dullDies.map((die) => (
              <Box
                key={die.die_id}
                sx={{
                  p: 1.5,
                  bgcolor: 'white',
                  borderRadius: 1,
                  border: '2px solid #F44336',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#333' }}>
                    Die #{die.die_number}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                    <Chip
                      label={die.die_type}
                      size="small"
                      sx={{
                        bgcolor: PRIMARY_ORANGE,
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '0.6rem',
                        height: 20,
                      }}
                    />
                    <Chip
                      label="Needs Review"
                      size="small"
                      sx={{
                        bgcolor: '#F44336',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '0.6rem',
                        height: 20,
                      }}
                    />
                  </Box>
                </Box>

                {/* Only show "Send to Sharpening" button for Admin */}
                {isAdmin && onSendToSharpening && (
                  <Tooltip title="Send to Sharpening">
                    <IconButton
                      size="small"
                      onClick={() => onSendToSharpening(die)}
                      sx={{
                        bgcolor: '#FF9800',
                        color: 'white',
                        '&:hover': { bgcolor: '#F57C00' },
                      }}
                    >
                      <ArrowForwardIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default DullDieZone;
