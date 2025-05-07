import React, { useState } from 'react';
import axios from 'axios';

const ImportParts = () => {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files ? e.target.files[0] : null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) {
      setMessage('Please select a file to import.');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/parts/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setMessage('Parts imported successfully!');
    } catch (error) {
      setMessage('Error importing parts. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Import Parts</h2>
      <input type="file" onChange={handleFileChange} required />
      <button type="submit">Import</button>
      {message && <p>{message}</p>}
    </form>
  );
};

export default ImportParts;
