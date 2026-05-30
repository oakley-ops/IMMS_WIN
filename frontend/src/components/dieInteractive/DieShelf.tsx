import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
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
}

interface DieShelfProps {
  dies: Die[];
  machines: Machine[];
  isDropTarget?: boolean;
}

const DieShelf: React.FC<DieShelfProps> = ({
  dies,
  machines,
  isDropTarget = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const { isOver, setNodeRef } = useDroppable({
    id: 'die-shelf',
    data: {
      type: 'shelf',
    },
  });

  // Get unique die types for filter
  const dieTypes = Array.from(new Set(dies.map(d => d.die_type))).sort();

  // Filter dies
  const filteredDies = dies.filter(die => {
    const matchesSearch =
      die.die_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      die.die_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || die.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || die.die_type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <Paper
      ref={setNodeRef}
      elevation={3}
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: isOver ? 'rgba(244, 67, 54, 0.08)' : '#fafafa',
        border: isOver ? '3px dashed #F44336' : '3px solid transparent',
        transition: 'all 0.3s ease',
        backgroundImage: isOver ? 'none' : 'linear-gradient(to bottom, #f5f5f5, #eeeeee)',
        boxShadow: isOver ? '0 8px 25px rgba(244, 67, 54, 0.2)' : undefined,
      }}
    >
      {/* Shelf Header */}
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#FF6B35', mb: 1 }}>
          Die Shelf - Available Dies
          {isOver && (
            <Typography component="span" sx={{ ml: 2, color: '#F44336', fontWeight: 'bold', fontSize: '0.9rem' }}>
              (Drop to remove)
            </Typography>
          )}
        </Typography>

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search dies..."
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 150 }}
          />

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="SHARP">Sharp</MenuItem>
              <MenuItem value="USED">Used</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={typeFilter}
              label="Type"
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <MenuItem value="ALL">All</MenuItem>
              {dieTypes.map(type => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Shelf Visual */}
      <Box
        sx={{
          p: 1.5,
          bgcolor: isOver ? 'rgba(244, 67, 54, 0.05)' : '#e0e0e0',
          borderRadius: 2,
          border: isOver ? '3px solid #F44336' : '3px solid #9e9e9e',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
          transition: 'all 0.3s ease',
        }}
      >
        {filteredDies.length === 0 ? (
          <Box
            sx={{
              py: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography color="text.secondary">
              {dies.length === 0
                ? 'No available dies'
                : 'No dies match your filters'}
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1.5,
            }}
          >
            {filteredDies.map(die => {
              const machineNames = die.compatible_machine_ids
                ?.map(id => machines.find(m => m.machine_id === id)?.name)
                .filter((name): name is string => !!name) || [];
              return (
                <DieChip
                  key={die.die_id}
                  die={die}
                  compatibleMachineIds={die.compatible_machine_ids || undefined}
                  compatibleMachineNames={machineNames}
                />
              );
            })}
          </Box>
        )}
      </Box>

      </Paper>
  );
};

export default DieShelf;
