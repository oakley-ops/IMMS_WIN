import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Container as MuiContainer } from '@mui/material';
import MachineList from '../components/MachineList';
import MachineForm from '../components/MachineForm';
import Machine from '../components/Machine';
import RestockComponent from '../components/RestockComponent';
import MachineCostReport from '../components/MachineCostReport';
import MachineCategories from '../components/MachineCategories';

const Machines: React.FC = () => {
  return (
    <MuiContainer maxWidth="lg" sx={{ py: 4 }}>
      <Routes>
        {/* List all machines with category filtering */}
        <Route index element={<MachineCategories />} />
        
        {/* Add new machine */}
        <Route path="new" element={<MachineForm />} />
        
        {/* View machine details */}
        <Route path=":id" element={<Machine />} />
        
        {/* Edit existing machine */}
        <Route path=":id/edit" element={<MachineForm />} />
        
        {/* Restock parts */}
        <Route path="restock" element={<RestockComponent />} />

        {/* Machine costs report */}
        <Route path="costs" element={<MachineCostReport />} />
      </Routes>
    </MuiContainer>
  );
};

export default Machines;