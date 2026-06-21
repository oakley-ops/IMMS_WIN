// src/pages/Parts.tsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';
import { Provider } from 'react-redux';
import { store } from '../store/store';
import PartsList from '../components/PartsList';
import EditPartForm from '../components/EditPartForm';

interface Part {
  part_id: number;
  name: string;
  description: string;
  quantity: number;
  manufacturer_part_number: string;
  internal_part_number: string;
  machine_id: number;
  supplier: string;
  image: string;
}

const Parts: React.FC = () => {
  return (
    <Box>
      <Provider store={store}>
        <Routes>
          <Route path="/" element={<PartsList />} />
          <Route path="/:id/edit" element={<EditPartForm />} />
          <Route path="/add" element={<EditPartForm />} />
        </Routes>
      </Provider>
    </Box>
  );
};

export default Parts;