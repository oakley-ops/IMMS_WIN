import React, { useState } from 'react';
import axios from 'axios';

const RestockPartsForm = () => {
  const [partId, setPartId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/parts/restock', { partId, quantity });
      setMessage(`Successfully restocked ${quantity} of part ID ${partId}.`);
    } catch (error) {
      setMessage('Error restocking part. Please try again.');
    }
  };

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
