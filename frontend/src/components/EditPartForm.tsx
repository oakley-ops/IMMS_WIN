// src/components/EditPartForm.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axios';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
import { fetchParts } from '../store/partsSlice';
import ManagePartSuppliers from './ManagePartSuppliers';
import Button from '@mui/material/Button';

interface Machine {
  id: number;
  name: string;
}

interface Supplier {
  supplier_id: number;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

interface PartFormData {
  name: string;
  description: string;
  quantity: number;
  manufacturer_part_number: string;
  fiserv_part_number: string;
  machine_id: number;
  unit_cost: number;
  location?: string;
  minimum_quantity?: number;
  status?: 'active' | 'discontinued';
  notes?: string;
  image?: string;
}

const EditPartForm: React.FC = () => {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [formData, setFormData] = useState<PartFormData>({
    name: '',
    description: '',
    quantity: 0,
    manufacturer_part_number: '',
    fiserv_part_number: '',
    machine_id: 0,
    unit_cost: 0,
    location: '',
    minimum_quantity: 0,
    status: 'active',
    notes: '',
    image: '',
  });
  const [machines, setMachines] = useState<Machine[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [partId, setPartId] = useState<number | null>(id ? parseInt(id) : null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [partResponse, machinesResponse, suppliersResponse] = await Promise.all([
          id ? axiosInstance.get(`/api/v1/parts/${id}`) : Promise.resolve({ data: formData }),
          axiosInstance.get('/api/v1/machines'),
          axiosInstance.get('/api/v1/suppliers')
        ]);
        
        // Format the data
        const part = partResponse.data;
        setFormData({
          name: part.name || '',
          description: part.description || '',
          quantity: part.quantity || 0,
          manufacturer_part_number: part.manufacturer_part_number || '',
          fiserv_part_number: part.fiserv_part_number || '',
          machine_id: part.machine_id || 0,
          unit_cost: part.unit_cost || 0,
          location: part.location || '',
          minimum_quantity: part.minimum_quantity || 0,
          status: part.status || 'active',
          notes: part.notes || '',
          image: part.image || '',
        });
        
        setMachines(machinesResponse.data);
        setSuppliers(suppliersResponse.data);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = event.target;
    
    // Handle number inputs
    if (type === 'number') {
      setFormData({
        ...formData,
        [name]: value === '' ? '' : Number(value),
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccessMessage('');
    
    try {
      // Convert empty strings to appropriate types for backend
      const dataToSubmit = {
        ...formData,
        quantity: typeof formData.quantity === 'string' ? Number(formData.quantity) : formData.quantity,
        minimum_quantity: typeof formData.minimum_quantity === 'string' ? Number(formData.minimum_quantity) : formData.minimum_quantity,
        unit_cost: typeof formData.unit_cost === 'string' ? Number(formData.unit_cost) : formData.unit_cost,
      };
      
      let savedPartId: number;
      
      if (id) {
        await axiosInstance.put(`/api/v1/parts/${id}`, dataToSubmit);
        savedPartId = parseInt(id);
        setSuccessMessage('Part updated successfully!');
      } else {
        const response = await axiosInstance.post('/api/v1/parts', dataToSubmit);
        savedPartId = response.data.part_id;
        setPartId(savedPartId); // Set the part ID for the supplier manager
        setSuccessMessage('Part created successfully!');
      }
      
      // Refresh parts list in Redux store
      dispatch(fetchParts());
    } catch (err) {
      console.error('Error submitting part:', err);
      setError('Failed to save part. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mt-4">
      <h2>{id ? 'Edit Part' : 'Add New Part'}</h2>
      
      {error && <div className="alert alert-danger">{error}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}
      
      <div className="row">
        <div className="col-md-8">
          <form onSubmit={handleSubmit}>
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="mb-0">Part Details</h5>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label htmlFor="name" className="form-label">Name</label>
                  <input
                    type="text"
                    className="form-control"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="mb-3">
                  <label htmlFor="fiserv_part_number" className="form-label">Fiserv Part Number</label>
                  <input
                    type="text"
                    className="form-control"
                    id="fiserv_part_number"
                    name="fiserv_part_number"
                    value={formData.fiserv_part_number}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="mb-3">
                  <label htmlFor="manufacturer_part_number" className="form-label">Manufacturer Part Number</label>
                  <input
                    type="text"
                    className="form-control"
                    id="manufacturer_part_number"
                    name="manufacturer_part_number"
                    value={formData.manufacturer_part_number}
                    onChange={handleChange}
                  />
                </div>
                
                <div className="mb-3">
                  <label htmlFor="unit_cost" className="form-label">Unit Cost ($)</label>
                  <input
                    type="number"
                    className="form-control"
                    id="unit_cost"
                    name="unit_cost"
                    min="0"
                    step="0.01"
                    value={formData.unit_cost}
                    onChange={handleChange}
                  />
                </div>
                
                <div className="mb-3">
                  <label htmlFor="quantity" className="form-label">Quantity</label>
                  <input
                    type="number"
                    className="form-control"
                    id="quantity"
                    name="quantity"
                    min="0"
                    value={formData.quantity}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="mb-3">
                  <label htmlFor="minimum_quantity" className="form-label">Minimum Quantity</label>
                  <input
                    type="number"
                    className="form-control"
                    id="minimum_quantity"
                    name="minimum_quantity"
                    min="0"
                    value={formData.minimum_quantity}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="mb-3">
                  <label htmlFor="location" className="form-label">Storage Location</label>
                  <input
                    type="text"
                    className="form-control"
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                  />
                </div>
                
                <div className="mb-3">
                  <label htmlFor="machine_id" className="form-label">Associated Machine</label>
                  <select
                    className="form-select"
                    id="machine_id"
                    name="machine_id"
                    value={formData.machine_id}
                    onChange={handleChange}
                  >
                    <option value={0}>None</option>
                    {machines.map((machine) => (
                      <option key={machine.id} value={machine.id}>
                        {machine.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="mb-3">
                  <label htmlFor="status" className="form-label">Status</label>
                  <select
                    className="form-select"
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                  >
                    <option value="active">Active</option>
                    <option value="discontinued">Discontinued</option>
                  </select>
                </div>
                
                <div className="mb-3">
                  <label htmlFor="description" className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    id="description"
                    name="description"
                    rows={3}
                    value={formData.description}
                    onChange={handleChange}
                  />
                </div>
                
                <div className="mb-3">
                  <label htmlFor="notes" className="form-label">Notes</label>
                  <textarea
                    className="form-control"
                    id="notes"
                    name="notes"
                    rows={3}
                    value={formData.notes}
                    onChange={handleChange}
                  />
                </div>
                
                <div className="d-flex justify-content-between mt-4">
                  <Button
                    variant="contained"
                    color="primary"
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Saving...
                      </>
                    ) : (
                      id ? 'Update Part' : 'Create Part'
                    )}
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
        
        <div className="col-md-4">
          <div className="alert alert-info mb-3">
            <strong>Managing Suppliers</strong>
            <p className="mb-0 small">
              {id 
                ? "You can add multiple suppliers for this part. Set one as preferred for purchase orders." 
                : "After saving the part, you'll be able to add multiple suppliers."}
            </p>
          </div>
          
          {/* Supplier Manager Section */}
          {id && (
            <ManagePartSuppliers partId={parseInt(id)} onUpdate={() => dispatch(fetchParts())} />
          )}
          
          {/* Show supplier manager for newly created parts */}
          {!id && partId && (
            <ManagePartSuppliers partId={partId} onUpdate={() => dispatch(fetchParts())} isNewPart={!id && !partId} />
          )}
        </div>
      </div>
    </div>
  );
};

export default EditPartForm;