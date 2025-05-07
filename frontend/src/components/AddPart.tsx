import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
import { addPart } from '../store/partsSlice';
import { Part } from '../store/partsSlice';
import '../styles/Dialog.css';

// Add Fiserv color constants
const FISERV_BLUE = '#0066A1';
const FISERV_ORANGE = '#FF6200';

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
  minimum_order_quantity?: number;
  is_preferred: boolean;
}

const AddPart: React.FC<{ show: boolean; handleClose: () => void }> = ({ show, handleClose }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [manufacturerPartNumber, setManufacturerPartNumber] = useState('');
  const [fiservPartNumber, setFiservPartNumber] = useState('');
  const [location, setLocation] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  // New multi-supplier state
  const [selectedSuppliers, setSelectedSuppliers] = useState<PartSupplier[]>([]);
  const [currentSupplierId, setCurrentSupplierId] = useState<number | ''>('');
  const [currentUnitCost, setCurrentUnitCost] = useState(0);
  const [currentLeadTimeDays, setCurrentLeadTimeDays] = useState(0);
  const [currentMinOrderQty, setCurrentMinOrderQty] = useState(0);
  
  const [unitCost, setUnitCost] = useState(0);
  const [minimumQuantity, setMinimumQuantity] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch suppliers on component mount
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await fetch('/api/suppliers');
        if (!response.ok) {
          throw new Error('Failed to fetch suppliers');
        }
        const data = await response.json();
        setSuppliers(data);
      } catch (err) {
        console.error('Error fetching suppliers:', err);
        setError('Failed to load suppliers. Please try again.');
      }
    };

    if (show) {
      fetchSuppliers();
    }
  }, [show]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setQuantity(0);
    setManufacturerPartNumber('');
    setFiservPartNumber('');
    setLocation('');
    setSelectedSuppliers([]);
    setCurrentSupplierId('');
    setCurrentUnitCost(0);
    setCurrentLeadTimeDays(0);
    setCurrentMinOrderQty(0);
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
      unit_cost: currentUnitCost,
      lead_time_days: currentLeadTimeDays || undefined,
      minimum_order_quantity: currentMinOrderQty || undefined,
      is_preferred: selectedSuppliers.length === 0 // First supplier is automatically preferred
    };
    
    setSelectedSuppliers([...selectedSuppliers, newSupplier]);
    setCurrentSupplierId('');
    setCurrentUnitCost(0);
    setCurrentLeadTimeDays(0);
    setCurrentMinOrderQty(0);
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
      fiserv_part_number: fiservPartNumber,
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
            <h5 className="dialog-title" style={{ color: FISERV_ORANGE }}>Add New Part</h5>
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
                  <label className="form-label">Fiserv Part Number*</label>
                  <input
                    type="text"
                    className="form-control"
                    name="fiserv_part_number"
                    value={fiservPartNumber}
                    onChange={(e) => setFiservPartNumber(e.target.value)}
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

                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input
                    type="text"
                    className="form-control"
                    name="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
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
                        <label className="form-label">Unit Cost ($)*</label>
                        <input
                          type="number"
                          className="form-control"
                          min="0"
                          step="0.01"
                          value={currentUnitCost}
                          onChange={(e) => setCurrentUnitCost(Number(e.target.value))}
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

                      <div className="form-group">
                        <label className="form-label">Minimum Order Qty</label>
                        <input
                          type="number"
                          className="form-control"
                          min="0"
                          value={currentMinOrderQty}
                          onChange={(e) => setCurrentMinOrderQty(Number(e.target.value))}
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
                          <th>Min Order</th>
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
                            <td>{supplier.minimum_order_quantity || '-'}</td>
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
                  style={{ backgroundColor: FISERV_BLUE, color: 'white' }}
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
