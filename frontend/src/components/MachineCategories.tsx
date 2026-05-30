import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Skeleton } from '@mui/material';
import axios from '../utils/axios';
import MachineList from './MachineList';
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
        
        // Use real API call instead of mock data
        const response = await axios.get('/api/v1/machines');
        const machinesData = response.data;
        
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
      {/* Manufacturer filter is rendered inside MachineList's toolbar (one header) */}
      <MachineList
        machinesData={filteredMachines}
        manufacturers={manufacturers}
        selectedManufacturer={selectedManufacturer}
        onManufacturerChange={setSelectedManufacturer}
        getManufacturerCount={getManufacturerCount}
        totalCount={machines.length}
      />
    </Box>
  );
};

export default MachineCategories; 