import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store'; 
import { fetchParts } from '../store/partsSlice'; 
import BarcodeScanner from './BarcodeScanner';

interface PartFormData {
  name: string;
  description: string;
  quantity: number;
  minimum_quantity: number;
  manufacturer_part_number: string;
  fiserv_part_number: string;
  machine_id: number; 
  supplier: string;
  unit_cost: number;
  location: string;
  notes: string;
  image: string;
}

const PartForm: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [formData, setFormData] = useState<PartFormData>({
    name: '',
    description: '',
    quantity: 0,
    minimum_quantity: 0,
    manufacturer_part_number: '',
    fiserv_part_number: '',
    machine_id: 0,
    supplier: '',
    unit_cost: 0,
    location: '',
    notes: '',
    image: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isTBD, setIsTBD] = useState<boolean>(false);
  const [uniqueTBD, setUniqueTBD] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Generate a unique TBD value when the component mounts
  useEffect(() => {
    generateUniqueTBD();
  }, []);

  const generateUniqueTBD = () => {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 10000);
    const newUniqueTBD = `TBD-${timestamp}-${random}`;
    setUniqueTBD(newUniqueTBD);
    return newUniqueTBD;
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = event.target;
    
    // Special handling for fiserv_part_number
    if (name === 'fiserv_part_number') {
      const upperValue = value.trim().toUpperCase();
      if (upperValue === 'TBD') {
        setIsTBD(true);
      } else {
        setIsTBD(false);
      }
    }
    
    // Handle numeric inputs
    if (type === 'number') {
      setFormData({
        ...formData,
        [name]: value === '' ? 0 : Number(value),
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
    
    // Clear error when user starts typing
    setError(null);
  };

  const handleBarcodeScanned = (scannedBarcode: string) => {
    // Decide whether to populate manufacturer_part_number or fiserv_part_number
    // based on the scanned barcode format or user input
    setFormData({
      ...formData,
      manufacturer_part_number: scannedBarcode, 
      // or
      // fiserv_part_number: scannedBarcode
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    // Prevent double submission
    if (isSubmitting) {
      return;
    }
    
    setIsSubmitting(true);
    
    // Reset status messages
    setError(null);
    setSuccess(null);
    
    // Validate required fields
    if (!formData.name) {
      setError('Part name is required');
      setIsSubmitting(false);
      return;
    }
    
    if (!formData.fiserv_part_number && !isTBD) {
      setError('Fiserv part number is required (you can use "TBD" if unknown)');
      setIsSubmitting(false);
      return;
    }
    
    // Create a copy of the form data to modify if needed
    const submissionData = { ...formData };
    
    // If the user entered TBD, use our pre-generated unique TBD value
    if (isTBD || submissionData.fiserv_part_number.trim().toUpperCase() === "TBD") {
      submissionData.fiserv_part_number = uniqueTBD;
      console.log('Using unique TBD value:', uniqueTBD);
    }
    
    try {
      // Send the modified data to the backend
      console.log('Submitting data:', submissionData);
      const response = await axios.post('/api/v1/parts', submissionData);
      console.log('Response:', response);
      
      // Dispatch an action to update the parts list in the Redux store
      dispatch(fetchParts()); 
      
      // Generate a new unique TBD for next time
      generateUniqueTBD();
      
      // Reset the form or show a success message
      setFormData({
        name: '',
        description: '',
        quantity: 0,
        minimum_quantity: 0,
        manufacturer_part_number: '',
        fiserv_part_number: '',
        machine_id: 0,
        supplier: '',
        unit_cost: 0,
        location: '',
        notes: '',
        image: '',
      });
      setIsTBD(false);
      setSuccess('Part created successfully!');
    } catch (error) {
      console.error('Error creating part:', error);
      
      // Check for unique constraint violation on fiserv_part_number
      if (axios.isAxiosError(error) && error.response) {
        console.error('Error response:', error.response);
        const errorMessage = error.response.data.error || error.message;
        
        if (errorMessage.includes('unique_fiserv_part_number') || 
            errorMessage.includes('duplicate key value') || 
            errorMessage.includes('Key (fiserv_part_number)')) {
          
          // Generate a new unique TBD and suggest trying again
          const newUniqueTBD = generateUniqueTBD();
          
          if (isTBD || formData.fiserv_part_number.trim().toUpperCase() === "TBD") {
            setError(`There's already a part with "TBD" as the Fiserv part number. We've generated a new unique ID "${newUniqueTBD}" for you. Please try submitting again.`);
          } else {
            setError(`A part with this Fiserv part number already exists. Please use a different value.`);
          }
        } else {
          setError(`Error: ${errorMessage}`);
        }
      } else {
        setError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create Part</h2>
      
      {error && (
        <div style={{ padding: '10px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '15px' }}>
          {error}
        </div>
      )}
      
      {success && (
        <div style={{ padding: '10px', backgroundColor: '#e8f5e9', color: '#2e7d32', borderRadius: '4px', marginBottom: '15px' }}>
          {success}
        </div>
      )}
      
      <BarcodeScanner onScan={handleBarcodeScanned} />
      
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="name" style={{ display: 'block', marginBottom: '5px' }}>
          Part Name: <span style={{ color: 'red' }}>*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          style={{ width: '100%', padding: '8px' }}
        />
      </div>
      
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="description" style={{ display: 'block', marginBottom: '5px' }}>
          Description:
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', minHeight: '80px' }}
        />
      </div>
      
      <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="manufacturer_part_number" style={{ display: 'block', marginBottom: '5px' }}>
            Manufacturer Part Number:
          </label>
          <input
            type="text"
            id="manufacturer_part_number"
            name="manufacturer_part_number"
            value={formData.manufacturer_part_number}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        
        <div style={{ flex: 1 }}>
          <label htmlFor="fiserv_part_number" style={{ display: 'block', marginBottom: '5px' }}>
            Fiserv Part Number: <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="text"
            id="fiserv_part_number"
            name="fiserv_part_number"
            value={formData.fiserv_part_number}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '8px' }}
          />
          <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
            If you don't have the Fiserv part number yet, enter "TBD".
          </small>
          {isTBD && (
            <div style={{ marginTop: '5px', padding: '8px', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>TBD Detected</p>
              <p style={{ margin: '0', fontSize: '14px' }}>
                We'll use this unique ID: <code>{uniqueTBD}</code>
              </p>
            </div>
          )}
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="quantity" style={{ display: 'block', marginBottom: '5px' }}>
            Quantity: <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="number"
            id="quantity"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            min="0"
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        
        <div style={{ flex: 1 }}>
          <label htmlFor="minimum_quantity" style={{ display: 'block', marginBottom: '5px' }}>
            Minimum Quantity: <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="number"
            id="minimum_quantity"
            name="minimum_quantity"
            value={formData.minimum_quantity}
            onChange={handleChange}
            min="0"
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        
        <div style={{ flex: 1 }}>
          <label htmlFor="unit_cost" style={{ display: 'block', marginBottom: '5px' }}>
            Unit Cost:
          </label>
          <input
            type="number"
            id="unit_cost"
            name="unit_cost"
            value={formData.unit_cost}
            onChange={handleChange}
            min="0"
            step="0.01"
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
      </div>
      
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="supplier" style={{ display: 'block', marginBottom: '5px' }}>
          Supplier/Manufacturer:
        </label>
        <input
          type="text"
          id="supplier"
          name="supplier"
          value={formData.supplier}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px' }}
        />
      </div>
      
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="location" style={{ display: 'block', marginBottom: '5px' }}>
          Location:
        </label>
        <input
          type="text"
          id="location"
          name="location"
          value={formData.location}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px' }}
        />
      </div>
      
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="notes" style={{ display: 'block', marginBottom: '5px' }}>
          Notes:
        </label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          style={{ width: '100%', padding: '8px', minHeight: '80px' }}
        />
      </div>
      
      <button 
        type="submit"
        disabled={isSubmitting}
        style={{
          backgroundColor: isSubmitting ? '#cccccc' : '#1976d2',
          color: 'white',
          padding: '10px 20px',
          border: 'none',
          borderRadius: '4px',
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
          fontSize: '16px'
        }}
      >
        {isSubmitting ? 'Creating...' : 'Create Part'}
      </button>
    </form>
  );
};

export default PartForm;