import React, { useState, useEffect } from 'react';
import { 
  Box, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Typography, 
  Paper,
  SelectChangeEvent,
  CircularProgress,
  Chip,
  Grid,
  Divider,
  Skeleton
} from '@mui/material';
import { 
  FilterList as FilterListIcon
} from '@mui/icons-material';
import axios from '../utils/axios';
import MachineList from './MachineList';
import mockMachines from '../mockData/machines';
import { Machine } from '../types';

const MachineCategories: React.FC = () => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [filteredMachines, setFilteredMachines] = useState<Machine[]>([]);
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('all');
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMachines = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // For development, use mock data instead of API call
        const machinesData = mockMachines;
        
        // When ready to connect to real API, uncomment this:
        // const response = await axios.get('/api/v1/machines');
        // const machinesData = response.data;
        
        setMachines(machinesData);
        
        // Extract unique manufacturers using Object.keys and reduce
        const manufacturersMap: Record<string, boolean> = {};
        machinesData.forEach((machine: Machine) => {
          if (machine.manufacturer) {
            manufacturersMap[machine.manufacturer] = true;
          }
        });
        const uniqueManufacturers = Object.keys(manufacturersMap);
        
        setManufacturers(uniqueManufacturers);
        setFilteredMachines(machinesData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching machines:', error);
        setError('Failed to load machines. Please try again later.');
        setLoading(false);
      }
    };

    fetchMachines();
  }, []);

  useEffect(() => {
    if (selectedManufacturer === 'all') {
      setFilteredMachines(machines);
    } else {
      setFilteredMachines(
        machines.filter(machine => 
          machine.manufacturer?.toLowerCase() === selectedManufacturer.toLowerCase()
        )
      );
    }
  }, [selectedManufacturer, machines]);

  const handleManufacturerChange = (event: SelectChangeEvent) => {
    setSelectedManufacturer(event.target.value as string);
  };

  const getManufacturerCount = (manufacturer: string) => {
    if (manufacturer === 'all') {
      return machines.length;
    }
    return machines.filter(machine => 
      machine.manufacturer?.toLowerCase() === manufacturer.toLowerCase()
    ).length;
  };

  // Loading state
  if (loading) {
    return (
      <Box sx={{ width: '100%' }}>
        <Skeleton variant="rectangular" width="100%" height={100} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" width="100%" height={400} />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Paper elevation={2} sx={{ p: 4, textAlign: 'center', color: 'error.main' }}>
        <Typography variant="h6">{error}</Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <FilterListIcon color="primary" sx={{ fontSize: 28 }} />
          </Grid>
          <Grid item xs>
            <Typography variant="h6" sx={{ fontWeight: 500 }}>
              Filter Machines by Manufacturer
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel id="manufacturer-select-label">Manufacturer</InputLabel>
              <Select
                labelId="manufacturer-select-label"
                id="manufacturer-select"
                value={selectedManufacturer}
                label="Manufacturer"
                onChange={handleManufacturerChange}
              >
                <MenuItem value="all">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span>All Manufacturers</span>
                    <Chip 
                      label={getManufacturerCount('all')} 
                      size="small" 
                      color="primary" 
                      sx={{ ml: 1 }} 
                    />
                  </Box>
                </MenuItem>
                <Divider />
                {manufacturers.map((manufacturer) => (
                  <MenuItem key={manufacturer} value={manufacturer}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span>{manufacturer}</span>
                      <Chip 
                        label={getManufacturerCount(manufacturer)} 
                        size="small" 
                        color={selectedManufacturer === manufacturer ? 'primary' : 'default'} 
                      />
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Statistics row */}
        <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Chip 
            label={`${filteredMachines.length} machines showing`} 
            color="primary" 
            variant="outlined"
          />
          {selectedManufacturer !== 'all' && (
            <Chip 
              label={`Filtered by: ${selectedManufacturer}`} 
              color="primary" 
              onDelete={() => setSelectedManufacturer('all')}
            />
          )}
        </Box>
      </Paper>

      {/* Pass the filtered machines to the MachineList component */}
      <MachineList machinesData={filteredMachines} />
    </Box>
  );
};

export default MachineCategories; 