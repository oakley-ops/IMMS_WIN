import React, { useState, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
import { addPart } from '../store/partsSlice';
import { Part } from '../store/partsSlice';
import axiosInstance from '../utils/axios';
import '../styles/Dialog.css';

interface BinLocation {
  location_id: number;
  name: string;
  part_count: number;
}

// Add app color constants
const IMMS_BLUE = '#0066A1';
const IMMS_ORANGE = '#FF6200';

interface Supplier {
  supplier_id: number;
  name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

interface PartSupplier {
  supplier_id: number;
  unit_cost: number;
  lead_time_days?: number;
  is_preferred: boolean;
}

const AddPart: React.FC<{ show: boolean; handleClose: () => void }> = ({ show, handleClose }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [manufacturerPartNumber, setManufacturerPartNumber] = useState('');
  const [internalPartNumber, setInternalPartNumber] = useState('');
  const [location, setLocation] = useState('');
  const [binLocations, setBinLocations] = useState<BinLocation[]>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationRef = useRef<HTMLDivElement>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  // New multi-supplier state
  const [selectedSuppliers, setSelectedSuppliers] = useState<PartSupplier[]>([]);
  const [currentSupplierId, setCurrentSupplierId] = useState<number | ''>('');
  const [currentUnitCost, setCurrentUnitCost] = useState('');
  const [currentLeadTimeDays, setCurrentLeadTimeDays] = useState(0);
  
  const [unitCost, setUnitCost] = useState(0);
  const [minimumQuantity, setMinimumQuantity] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch suppliers and bin locations on open
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await fetch('/api/suppliers');
        if (!response.ok) throw new Error('Failed to fetch suppliers');
        const data = await response.json();
        setSuppliers(data);
      } catch (err) {
        console.error('Error fetching suppliers:', err);
        setError('Failed to load suppliers. Please try again.');
      }
    };

    const fetchLocations = async () => {
      try {
        const { data } = await axiosInstance.get('/api/v1/parts/locations');
        setBinLocations(data);
      } catch (err) {
        console.error('Error fetching locations:', err);
      }
    };

    if (show) {
      fetchSuppliers();
      fetchLocations();
    }
  }, [show]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resetForm = () => {
    setName('');
    setDescription('');
    setQuantity(0);
    setManufacturerPartNumber('');
    setInternalPartNumber('');
    setLocation('');
    setShowLocationDropdown(false);
    setSelectedSuppliers([]);
    setCurrentSupplierId('');
    setCurrentUnitCost('');
    setCurrentLeadTimeDays(0);
    setUnitCost(0);
    setMinimumQuantity(0);
    setNotes('');
    setError(null);
  };

  const handleAddSupplier = () => {
    if (currentSupplierId === '') {
      return;
    }
    
    // Check if supplier already exists in the list
    if (selectedSuppliers.some(s => s.supplier_id === Number(currentSupplierId))) {
      setError('This supplier is already added to the part.');
      return;
    }
    
    const newSupplier: PartSupplier = {
      supplier_id: Number(currentSupplierId),
      unit_cost: currentUnitCost === '' ? 0 : Number(currentUnitCost),
      lead_time_days: currentLeadTimeDays || undefined,
      is_preferred: selectedSuppliers.length === 0 // First supplier is automatically preferred
    };
    
    setSelectedSuppliers([...selectedSuppliers, newSupplier]);
    setCurrentSupplierId('');
    setCurrentUnitCost('');
    setCurrentLeadTimeDays(0);
    setError(null);
  };

  const handleRemoveSupplier = (supplierId: number) => {
    const updatedSuppliers = selectedSuppliers.filter(s => s.supplier_id !== supplierId);
    
    // If the preferred supplier was removed, set the first supplier as preferred
    if (selectedSuppliers.find(s => s.supplier_id === supplierId)?.is_preferred && updatedSuppliers.length > 0) {
      updatedSuppliers[0].is_preferred = true;
    }
    
    setSelectedSuppliers(updatedSuppliers);
  };

  const handleSetPreferred = (supplierId: number) => {
    const updatedSuppliers = selectedSuppliers.map(s => ({
      ...s,
      is_preferred: s.supplier_id === supplierId
    }));
    
    setSelectedSuppliers(updatedSuppliers);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Get preferred supplier for primary details
    const preferredSupplier = selectedSuppliers.find(s => s.is_preferred);

    const newPart: Part = {
      part_id: 0,
      name,
      description,
      quantity,
      minimum_quantity: minimumQuantity,
      supplier_id: preferredSupplier ? preferredSupplier.supplier_id : undefined,
      unit_cost: preferredSupplier ? preferredSupplier.unit_cost : unitCost,
      location,
      manufacturer_part_number: manufacturerPartNumber,
      internal_part_number: internalPartNumber,
      status: 'active',
      notes,
      machine_id: 0,
      // Include the full suppliers data for backend processing
      suppliers: selectedSuppliers
    };

    try {
      await dispatch(addPart(newPart)).unwrap();
      resetForm();
      handleClose();
    } catch (err) {
      setError('Failed to add part. Please try again.');
      console.error('Failed to add part:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSupplierName = (supplierId: number) => {
    const supplier = suppliers.find(s => s.supplier_id === supplierId);
    return supplier ? supplier.name : 'Unknown Supplier';
  };

  if (!show) return null;

  return (
    <div className="modal">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content custom-dialog">
          <div className="dialog-header" style={{ backgroundColor: 'white' }}>
            <h5 className="dialog-title" style={{ color: IMMS_ORANGE }}>Add New Part</h5>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="dialog-content">
              {error && (
                <div className="alert alert-danger mb-4" role="alert">
                  {error}
                </div>
              )}
              <div className="grid-container grid-2-cols">
                <div className="form-group">
                  <label className="form-label">Name*</label>
                  <input
                    type="text"
                    className="form-control"
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Internal Part Number*</label>
                  <input
                    type="text"
                    className="form-control"
                    name="internal_part_number"
                    value={internalPartNumber}
                    onChange={(e) => setInternalPartNumber(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Manufacturer Part Number</label>
                  <input
                    type="text"
                    className="form-control"
                    name="manufacturer_part_number"
                    value={manufacturerPartNumber}
                    onChange={(e) => setManufacturerPartNumber(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Quantity*</label>
                  <input
                    type="number"
                    className="form-control"
                    name="quantity"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Minimum Quantity*</label>
                  <input
                    type="number"
                    className="form-control"
                    name="minimum_quantity"
                    min="0"
                    value={minimumQuantity}
                    onChange={(e) => setMinimumQuantity(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="form-group" ref={locationRef} style={{ position: 'relative' }}>
                  <label className="form-label">Location</label>
                  <input
                    type="text"
                    className="form-control"
                    name="location"
                    value={location}
                    autoComplete="off"
                    placeholder="Type or select a bin..."
                    onChange={(e) => { setLocation(e.target.value); setShowLocationDropdown(true); }}
                    onFocus={() => setShowLocationDropdown(true)}
                  />
                  {showLocationDropdown && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1050,
                      maxHeight: '200px', overflowY: 'auto',
                      border: '1px solid #dee2e6', borderRadius: '0 0 4px 4px',
                      backgroundColor: '#fff', boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                    }}>
                      {binLocations
                        .filter(loc => loc.name.toLowerCase().includes(location.toLowerCase()))
                        .map(loc => (
                          <div
                            key={loc.location_id}
                            onMouseDown={() => { setLocation(loc.name); setShowLocationDropdown(false); }}
                            style={{
                              padding: '8px 12px', cursor: 'pointer',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              borderBottom: '1px solid #f0f0f0'
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#f8f9fa')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#fff')}
                          >
                            <span>{loc.name}</span>
                            <span style={{
                              fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '12px',
                              backgroundColor: loc.part_count > 0 ? '#fff3cd' : '#d1e7dd',
                              color: loc.part_count > 0 ? '#856404' : '#0a3622'
                            }}>
                              {loc.part_count > 0 ? `${loc.part_count} part${loc.part_count !== 1 ? 's' : ''}` : 'Available'}
                            </span>
                          </div>
                        ))}
                      {binLocations.filter(loc => loc.name.toLowerCase().includes(location.toLowerCase())).length === 0 && location && (
                        <div style={{ padding: '8px 12px', color: '#6c757d', fontSize: '0.875rem' }}>
                          New location: <strong>"{location}"</strong> will be created
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Suppliers Section - Moved up for better visibility */}
              <div className="mt-4 mb-4">
                <h5 className="text-primary mb-2">Part Suppliers</h5>
                <div className="alert alert-info mb-3" role="alert">
                  <small><strong>Important:</strong> Add one or more suppliers for this part. The first supplier added will be set as preferred.</small>
                </div>
                
                {/* Add Supplier Form */}
                <div className="card mb-3 border-primary">
                  <div className="card-header bg-light">
                    <strong>Add Supplier</strong>
                  </div>
                  <div className="card-body">
                    <div className="grid-container grid-3-cols">
                      <div className="form-group">
                        <label className="form-label">Supplier*</label>
                        <select
                          className="form-select"
                          value={currentSupplierId}
                          onChange={(e) => setCurrentSupplierId(e.target.value ? Number(e.target.value) : '')}
                        >
                          <option value="">Select a supplier</option>
                          {suppliers.map((supplier) => (
                            <option key={supplier.supplier_id} value={supplier.supplier_id}>
                              {supplier.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Unit Cost ($)</label>
                        <input
                          type="number"
                          className="form-control"
                          min="0"
                          step="0.01"
                          value={currentUnitCost}
                          onChange={(e) => setCurrentUnitCost(e.target.value)}
                          placeholder="Leave blank for $0.00"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Lead Time (days)</label>
                        <input
                          type="number"
                          className="form-control"
                          min="0"
                          value={currentLeadTimeDays}
                          onChange={(e) => setCurrentLeadTimeDays(Number(e.target.value))}
                        />
                      </div>



                      <div className="form-group d-flex align-items-end">
                        <button
                          type="button"
                          className="btn btn-primary w-100"
                          onClick={handleAddSupplier}
                        >
                          <i className="bi bi-plus-circle me-1"></i> Add Supplier
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Supplier List */}
                {selectedSuppliers.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-sm table-striped">
                      <thead className="table-light">
                        <tr>
                          <th>Supplier</th>
                          <th>Unit Cost</th>
                          <th>Lead Time</th>
                          <th>Preferred</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSuppliers.map((supplier) => (
                          <tr key={supplier.supplier_id}>
                            <td>{getSupplierName(supplier.supplier_id)}</td>
                            <td>${supplier.unit_cost.toFixed(2)}</td>
                            <td>{supplier.lead_time_days || '-'}</td>
                            <td>
                              <div className="form-check">
                                <input
                                  className="form-check-input"
                                  type="radio"
                                  checked={supplier.is_preferred}
                                  onChange={() => handleSetPreferred(supplier.supplier_id)}
                                />
                              </div>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleRemoveSupplier(supplier.supplier_id)}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="alert alert-warning">
                    <strong>No suppliers added yet.</strong> You must add at least one supplier for this part.
                  </div>
                )}
              </div>

              <div className="form-group mt-3">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  name="description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="form-group mt-3">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-control"
                  name="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

            </div>

            <div className="dialog-footer">
              <div className="d-flex gap-2 justify-content-end">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={handleClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn" 
                  style={{ backgroundColor: IMMS_BLUE, color: 'white' }}
                  disabled={loading || selectedSuppliers.length === 0}
                >
                  {loading ? 'Adding...' : 'Add Part'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddPart;
