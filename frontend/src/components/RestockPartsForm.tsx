import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const RestockPartsForm = () => {
  const [partId, setPartId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [message, setMessage] = useState('');
  const { hasPermission, userRole } = useAuth();

  // Check if user can restock parts (admin and purchasing only)
  const canRestockParts = hasPermission('CAN_MANAGE_PURCHASE_ORDERS');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!canRestockParts) {
      setMessage('You do not have permission to restock parts. Only admin and purchasing users can restock.');
      return;
    }

    try {
      const response = await axios.post('/api/parts/restock', { partId, quantity });
      setMessage(`Successfully restocked ${quantity} of part ID ${partId}.`);
    } catch (error) {
      setMessage('Error restocking part. Please try again.');
    }
  };

  if (!canRestockParts) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Restock Parts</h2>
        <div style={{ 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          padding: '15px', 
          borderRadius: '5px',
          border: '1px solid #f5c6cb'
        }}>
          <strong>Access Denied:</strong> You do not have permission to restock parts. 
          Only admin and purchasing users can access this functionality.
          <br />
          <small>Your current role: {userRole}</small>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Restock Parts</h2>
      <div>
        <label htmlFor="partId">Part ID:</label>
        <input
          type="text"
          id="partId"
          value={partId}
          onChange={(e) => setPartId(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="quantity">Quantity:</label>
        <input
          type="number"
          id="quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
      </div>
      <button type="submit">Restock</button>
      {message && <p>{message}</p>}
    </form>
  );
};

export default RestockPartsForm;
