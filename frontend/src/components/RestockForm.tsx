import React, { useState, useEffect } from 'react';
import axios from '../utils/axios';
import '../styles/RestockForm.css';
import '../styles/Dialog.css';
import ModalPortal from './ModalPortal';

interface Part {
  id: number;
  name: string;
  fiserv_part_number: string;
  manufacturer_part_number: string;
  quantity: number;
  minimum_quantity: number;
  part_id?: number;
}

interface RestockFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const RestockForm: React.FC<RestockFormProps> = ({ open, onClose, onSuccess }) => {
  const [parts, setParts] = useState<Part[]>([]);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const searchParts = async (term: string) => {
    if (!term) {
      setParts([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await axios.get('/api/v1/parts', {
        params: {
          limit: 10,
          page: 0,
          search: term
        }
      });
      
      setParts(response.data.items);
    } catch (error) {
      console.error('Error searching parts:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const getStockStatus = (part: Part) => {
    if (part.quantity === 0) {
      return <span className="stock-status status-out">Out of Stock</span>;
    } else if (part.quantity <= part.minimum_quantity) {
      return <span className="stock-status status-low">Low Stock</span>;
    }
    return <span className="stock-status status-in">In Stock</span>;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPart || quantity <= 0) {
      setError('Please select a part and enter a valid quantity');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await axios.post('/api/v1/parts/restock', {
        part_id: selectedPart.part_id || selectedPart.id,
        quantity: quantity
      });

      onSuccess?.();
      onClose();
      setSelectedPart(null);
      setQuantity(0);
      setSearchTerm('');
    } catch (error: any) {
      console.error('Error restocking part:', error);
      setError(error.response?.data?.error || 'Failed to restock part');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <ModalPortal open={open}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content restock-dialog">
          <div className="dialog-header">
            <h5 className="dialog-title">Restock Parts</h5>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="dialog-content">
              <div className="mb-4">
                <label className="form-label">Search Part</label>
                <div className="input-group">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by part number or name"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      searchParts(e.target.value);
                    }}
                  />
                  {searchLoading && (
                    <span className="input-group-text">
                      <div className="spinner-border spinner-border-sm loading-spinner" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </span>
                  )}
                </div>
                {parts.length > 0 && (
                  <div className="search-results">
                    {parts.map((part) => (
                      <div
                        key={part.id}
                        className="search-item"
                        onClick={() => {
                          setSelectedPart(part);
                          setParts([]);
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <div>{part.name}</div>
                            <div className="part-info">
                              Fiserv: {part.fiserv_part_number} | Mfr: {part.manufacturer_part_number}
                            </div>
                          </div>
                          <div className="text-end">
                            <div className="quantity-info">Qty: {part.quantity}</div>
                            {getStockStatus(part)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedPart && (
                <div className="mb-4">
                  <div className="selected-part p-3 bg-light rounded">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <strong>{selectedPart.name}</strong>
                      {getStockStatus(selectedPart)}
                    </div>
                    <div className="part-info mb-2">
                      Fiserv: {selectedPart.fiserv_part_number} | Mfr: {selectedPart.manufacturer_part_number}
                    </div>
                    <div className="quantity-info">
                      Current Stock: {selectedPart.quantity} | Minimum Required: {selectedPart.minimum_quantity}
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-3">
                <label className="form-label">Quantity to Restock</label>
                <input
                  type="number"
                  className="form-control"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                  min="0"
                  disabled={!selectedPart}
                />
              </div>

              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}
            </div>
            <div className="dialog-footer">
              <div className="d-flex gap-2 justify-content-end">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || !selectedPart || quantity <= 0}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Restocking...
                    </>
                  ) : (
                    'Restock'
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default RestockForm;
