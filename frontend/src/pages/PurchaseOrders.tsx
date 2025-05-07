import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PurchaseOrderList from '../components/purchaseOrders/PurchaseOrderList';
import PurchaseOrderDetail from '../components/purchaseOrders/PurchaseOrderDetail';
import GeneratePurchaseOrders from '../components/purchaseOrders/GeneratePurchaseOrders';
import ManualPOForm from '../components/purchaseOrders/ManualPOForm';
import SupplierManagement from '../components/suppliers/SupplierManagement';
import SupplierPartsList from '../components/suppliers/SupplierPartsList';

const PurchaseOrders: React.FC = () => {
  return (
    <div className="purchase-orders-container">
      <Routes>
        <Route path="/" element={<PurchaseOrderList />} />
        <Route path="/detail/:id" element={<PurchaseOrderDetail />} />
        <Route path="/create" element={<GeneratePurchaseOrders />} />
        <Route path="/create-manual" element={<ManualPOForm />} />
        <Route path="/suppliers" element={<SupplierManagement />} />
        <Route path="/suppliers/:id/parts" element={<SupplierPartsList />} />
        <Route path="*" element={<Navigate to="/purchase-orders" replace />} />
      </Routes>
    </div>
  );
};

export default PurchaseOrders;
