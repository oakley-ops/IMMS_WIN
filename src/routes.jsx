import React from 'react';
import { Routes, Route } from 'react-router-dom';
import TestPOPage from './pages/TestPOPage';
// Import your other components here

const AppRoutes = () => {
  return (
    <Routes>
      {/* Your existing routes */}
      
      {/* Test route for PO mockup - Remove after testing */}
      <Route path="/test-po" element={<TestPOPage />} />
      
      {/* Add the actual route once implementation is complete
      <Route path="/purchase-orders/create-manual" element={<ManualPOForm />} />
      */}
    </Routes>
  );
};

export default AppRoutes; 