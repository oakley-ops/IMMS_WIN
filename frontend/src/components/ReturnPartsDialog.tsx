import React, { useState, useEffect } from 'react';
import { Part } from '../types';
import ModalPortal from './ModalPortal';
import axios from '../utils/axios';

interface ReturnPartsDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preSelectedPart?: Part | null;
}

const ReturnPartsDialog: React.FC<ReturnPartsDialogProps> = ({
  open,
  onClose,
  onSuccess,
  preSelectedPart,
}) => {
  const [selectedPart, setSelectedPart] = useState<Part | null>(preSelectedPart || null);
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Part[]>([]);
  
  // Debug searchResults changes
  const [searchLoading, setSearchLoading] = useState(false);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedPart(preSelectedPart || null);
      setQuantity(1);
      setError(null);
      setSuccess(null);
      setSearchTerm('');
      setSearchResults([]); // Ensure this is always an array
    } else {
      // Also reset when dialog closes
      setSearchResults([]);
      setSearchTerm('');
    }
  }, [open, preSelectedPart]);

  // Search for parts
  useEffect(() => {
    const searchParts = async () => {
      if (searchTerm.length >= 2) {
        setSearchLoading(true);
        try {
          const response = await axios.get(`/api/v1/parts?page=0&limit=50&search=${encodeURIComponent(searchTerm)}`);
          
          // Get the actual data from the response
          const responseData = response.data || response;
          const partsArray = responseData.items || responseData.parts || responseData || [];
          
          // Ensure we always set an array
          if (Array.isArray(partsArray)) {
            setSearchResults(partsArray);
          } else {
            console.warn('Return Dialog - Unexpected API response structure:', partsArray);
            setSearchResults([]);
          }
        } catch (error) {
          console.error('Error searching parts:', error);
          setSearchResults([]);
        } finally {
          setSearchLoading(false);
        }
      } else {
        setSearchResults([]);
      }
    };

    const timeoutId = setTimeout(searchParts, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPart) {
      setError('Please select a part');
      return;
    }

    if (quantity <= 0) {
      setError('Please enter a valid quantity greater than 0');
      return;
    }


    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const partId = selectedPart.part_id;
      if (!partId) {
        throw new Error('Invalid part ID');
      }

      console.log('Returning parts with data:', {
        part_id: partId,
        quantity: quantity,
        reason: 'Part returned to inventory'
      });

      const response = await axios.post('/api/v1/parts/return', {
        part_id: partId,
        quantity: quantity,
        reason: 'Part returned to inventory'
      });

      console.log('Return API response:', response);

      setSuccess(`Successfully returned ${quantity} units of ${selectedPart.name} to inventory`);
      
      // Reset form after successful return
      setTimeout(() => {
        onSuccess?.();
        onClose();
        setSelectedPart(null);
        setQuantity(1);
        setSearchTerm('');
        setSearchResults([]);
        setSuccess(null);
      }, 2000);

    } catch (error: any) {
      console.error('Error returning parts:', error);
      setError(
        error.response?.data?.error || 
        error.response?.data?.details || 
        error.message || 
        'Failed to return parts to inventory'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setSelectedPart(null);
      setQuantity(1);
      setError(null);
      setSuccess(null);
      setSearchTerm('');
      setSearchResults([]);
    }
  };

  return (
    <ModalPortal open={open}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content custom-dialog">
          <div className="dialog-header">
            <h5 className="dialog-title">Return Parts to Inventory</h5>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="dialog-content">
              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="alert alert-success" role="alert">
                  {success}
                </div>
              )}

              <div className="mb-4">
                <label className="form-label">Search and Select Part *</label>
                <div className="search-container">
                  <input
                    type="text"
                    className="form-control"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Type part name or part number..."
                    disabled={!!selectedPart}
                  />
                  {searchLoading && (
                    <div className="spinner-border spinner-border-sm text-primary position-absolute" 
                         style={{ right: '1rem', top: '0.75rem' }} 
                         role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  )}
                </div>

                {searchResults.length > 0 && !selectedPart && searchTerm.length >= 2 && (
                    <div className="search-results">
                      {searchResults.map((part) => (
                        <div
                          key={part.part_id}
                          className="search-item"
                          onClick={() => {
                            setSelectedPart(part);
                            setSearchTerm(part.name);
                          }}
                        >
                          <div className="d-flex justify-content-between align-items-start">
                            <div className="flex-grow-1">
                              <div className="fw-bold text-dark mb-1" style={{ fontSize: '0.95rem' }}>
                                {part.name}
                              </div>
                              <div className="text-muted small">
                                <div className="mb-1">
                                  <strong>CRC Part #:</strong> {part.crc_part_number || 'N/A'}
                                </div>
                                <div className="mb-1">
                                  <strong>Mfg Part #:</strong> {part.manufacturer_part_number || 'N/A'}
                                </div>
                              </div>
                            </div>
                            <div className="text-end">
                              <div className="badge bg-primary text-white">
                                Stock: {part.quantity}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                )}

                {selectedPart && (
                  <div className="selected-part-info mt-3">
                    <div className="card">
                      <div className="card-body">
                        <h6 className="card-title">Selected Part Details</h6>
                        <p className="card-text">
                          <strong>Name:</strong> {selectedPart.name}<br/>
                          <strong>CRC Part #:</strong> {selectedPart.crc_part_number || 'N/A'}<br/>
                          <strong>Manufacturer Part #:</strong> {selectedPart.manufacturer_part_number || 'N/A'}<br/>
                          <strong>Current Stock:</strong> {selectedPart.quantity} units<br/>
                          <strong>New Stock After Return:</strong> {selectedPart.quantity + quantity} units
                        </p>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => {
                            setSelectedPart(null);
                            setSearchTerm('');
                          }}
                        >
                          Change Part
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="form-label">Quantity to Return *</label>
                <input
                  type="number"
                  className="form-control"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  required
                />
                <div className="form-text">Enter the number of parts to return to inventory</div>
              </div>

            </div>

            <div className="dialog-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClose}
                disabled={loading}
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
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Returning...
                  </>
                ) : (
                  'Return to Inventory'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ReturnPartsDialog;
