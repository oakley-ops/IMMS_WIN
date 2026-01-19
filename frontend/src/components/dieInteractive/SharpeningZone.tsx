import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Build as BuildIcon,
  LocalShipping as ShippingIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useDroppable } from '@dnd-kit/core';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1';

interface OutForSharpeningDie {
  die_id: number;
  die_number: string;
  die_name: string;
  die_type: string;
  status: string;
  current_location: string;
}

interface SharpeningZoneProps {
  isDropTarget?: boolean;
  outForSharpening?: OutForSharpeningDie[];
  onReceiveBack?: () => void;
}

const SharpeningZone: React.FC<SharpeningZoneProps> = ({
  isDropTarget = false,
  outForSharpening = [],
  onReceiveBack,
}) => {
  const [receivingId, setReceivingId] = useState<number | null>(null);

  const { isOver, setNodeRef } = useDroppable({
    id: 'sharpening-zone',
    data: {
      type: 'sharpening',
    },
  });

  const handleReceiveBack = async (die: OutForSharpeningDie) => {
    try {
      setReceivingId(die.die_id);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Update die status back to SHARP
      await axios.put(`${API_URL}/dies/${die.die_id}`, {
        status: 'SHARP',
      }, { headers });

      if (onReceiveBack) {
        onReceiveBack();
      }
    } catch (error) {
      console.error('Error receiving die back:', error);
    } finally {
      setReceivingId(null);
    }
  };

  return (
    <Paper
      ref={setNodeRef}
      elevation={3}
      sx={{
        p: 3,
        borderRadius: 2,
        bgcolor: isOver ? 'rgba(255, 152, 0, 0.15)' : '#fff8e1',
        border: isOver ? '3px dashed #FF9800' : isDropTarget ? '3px dashed #FFB74D' : '3px solid #FFE0B2',
        transition: 'all 0.3s ease',
        boxShadow: isOver ? '0 8px 25px rgba(255, 152, 0, 0.3)' : undefined,
        transform: isOver ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Box
          sx={{
            width: 50,
            height: 50,
            borderRadius: '50%',
            bgcolor: isOver ? '#FF9800' : '#FFB74D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mr: 2,
            transition: 'all 0.3s ease',
          }}
        >
          {isOver ? (
            <ShippingIcon sx={{ color: 'white', fontSize: 28 }} />
          ) : (
            <BuildIcon sx={{ color: 'white', fontSize: 28 }} />
          )}
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#E65100' }}>
            Send to Sharpening
          </Typography>
          <Typography variant="body2" sx={{ color: '#FF8F00' }}>
            Mathias Sharpening Services
          </Typography>
        </Box>
      </Box>

      {/* Drop Zone */}
      <Box
        sx={{
          minHeight: 60,
          p: 2,
          bgcolor: isOver ? 'rgba(255, 152, 0, 0.1)' : 'rgba(255, 224, 178, 0.5)',
          borderRadius: 2,
          border: isOver ? '2px solid #FF9800' : '2px dashed #FFB74D',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          mb: outForSharpening.length > 0 ? 2 : 0,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: isOver ? '#E65100' : '#FF8F00',
            fontWeight: isOver ? 'bold' : 'normal',
            textAlign: 'center',
          }}
        >
          {isOver ? (
            <>
              <ShippingIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              Drop to send for sharpening!
            </>
          ) : (
            'Drag a die here to send it to Mathias'
          )}
        </Typography>
      </Box>

      {/* Out for Sharpening List */}
      {outForSharpening.length > 0 && (
        <Box>
          <Typography
            variant="subtitle2"
            sx={{
              color: '#E65100',
              fontWeight: 'bold',
              mb: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <ShippingIcon fontSize="small" />
            Out for Sharpening ({outForSharpening.length})
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {outForSharpening.map((die) => (
              <Box
                key={die.die_id}
                sx={{
                  p: 1.5,
                  bgcolor: 'white',
                  borderRadius: 1,
                  border: '2px solid #FF9800',
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
                        bgcolor: '#FF6600',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '0.6rem',
                        height: 20,
                      }}
                    />
                    <Chip
                      label={die.current_location || 'Mathias'}
                      size="small"
                      sx={{
                        bgcolor: '#FF9800',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '0.6rem',
                        height: 20,
                      }}
                    />
                  </Box>
                </Box>

                <Tooltip title="Mark as Returned (Sharp)">
                  <IconButton
                    size="small"
                    onClick={() => handleReceiveBack(die)}
                    disabled={receivingId === die.die_id}
                    sx={{
                      bgcolor: '#4CAF50',
                      color: 'white',
                      '&:hover': { bgcolor: '#388E3C' },
                      '&:disabled': { bgcolor: '#ccc' },
                    }}
                  >
                    {receivingId === die.die_id ? (
                      <CircularProgress size={20} sx={{ color: 'white' }} />
                    ) : (
                      <CheckCircleIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default SharpeningZone;
