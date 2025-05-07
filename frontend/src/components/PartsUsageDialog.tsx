import React, { useState, useEffect } from 'react';
import axios from '../utils/axios';
import '../styles/Dialog.css';
import ModalPortal from './ModalPortal';

interface Part {
  id?: number;
  part_id: number;
  name: string;
  fiserv_part_number: string;
  manufacturer_part_number: string;
  quantity: number;
  minimum_quantity: number;
}

interface Machine {
  id: number;
  name: string;
  description?: string;
}

interface PartsUsageDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const PartsUsageDialog: React.FC<PartsUsageDialogProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Part[]>([]);
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [machineSearchTerm, setMachineSearchTerm] = useState('');
  const [machineResults, setMachineResults] = useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchingMachines, setSearchingMachines] = useState(false);

  useEffect(() => {
    if (open) {
      fetchMachines();
    }
  }, [open]);

  const fetchMachines = async () => {
    setSearchingMachines(true);
    try {
      const response = await axios.get('/api/v1/machines');
      setAllMachines(response.data);
    } catch (error) {
      console.error('Error fetching machines:', error);
      setError('Failed to fetch machines');
    } finally {
      setSearchingMachines(false);
    }
  };

  const searchParts = async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await axios.get('/api/v1/parts', {
        params: {
          search: term,
          limit: 10,
          page: 0
        }
      });
      setSearchResults(response.data.items);
    } catch (error) {
      console.error('Error searching parts:', error);
      setError('Failed to search parts');
    } finally {
      setSearching(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    searchParts(term);
  };

  const selectPart = (part: Part) => {
    setSelectedPart(part);
    setSearchTerm('');
    setSearchResults([]);
    if (quantity > part.quantity) {
      setQuantity(0);
    }
  };

  const searchMachines = (term: string) => {
    if (!term.trim()) {
      setMachineResults([]);
      return;
    }

    const searchTerm = term.toLowerCase();
    const filteredMachines = allMachines.filter(machine => 
      machine.name.toLowerCase().includes(searchTerm) ||
      (machine.description && machine.description.toLowerCase().includes(searchTerm))
    );
    setMachineResults(filteredMachines);
  };

  const handleMachineSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setMachineSearchTerm(term);
    searchMachines(term);
  };

  const selectMachine = (machine: Machine) => {
    setSelectedMachine(machine);
    setMachineSearchTerm('');
    setMachineResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPart) {
      setError('Please select a part');
      return;
    }

    if (!selectedMachine) {
      setError('Please select a machine');
      return;
    }

    if (quantity <= 0 || quantity > selectedPart.quantity) {
      setError('Please enter a valid quantity');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for usage');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const partId = selectedPart.part_id;
      if (!partId) {
        throw new Error('Invalid part ID');
      }

      console.log('Sending request with data:', {
        part_id: partId,
        machine_id: selectedMachine.id,
        quantity: quantity,
        reason: reason,
        work_order_number: null
      });

      // Now we can send the reason since we're storing it in the transactions table
      const response = await axios.post('/api/v1/parts/usage', {
        part_id: partId,
        machine_id: selectedMachine.id,
        quantity: quantity,
        reason: reason,
        work_order_number: null // Optional field
      });

      console.log('API response:', response.data);

      onSuccess?.();
      onClose();
      setSelectedPart(null);
      setSelectedMachine(null);
      setQuantity(0);
      setReason('');
      setSearchTerm('');
      setMachineSearchTerm('');
      setSearchResults([]);
      setMachineResults([]);
    } catch (error: any) {
      console.error('Error recording part usage:', error);
      console.error('Error details:', error.response?.data);
      console.error('Request that failed:', {
        part_id: selectedPart?.part_id,
        machine_id: selectedMachine?.id,
        quantity: quantity,
        reason: reason
      });
      setError(error.response?.data?.error || error.response?.data?.details || 'Failed to record part usage');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const getStockStatusClass = (quantity: number, minimum_quantity: number) => {
    if (quantity === 0) return 'status-badge status-danger';
    if (quantity <= minimum_quantity) return 'status-badge status-warning';
    return 'status-badge status-success';
  };

  const getStockStatusText = (quantity: number, minimum_quantity: number) => {
    if (quantity === 0) return 'Out of Stock';
    if (quantity <= minimum_quantity) return 'Low Stock';
    return 'In Stock';
  };

  return (
    <ModalPortal open={open}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content custom-dialog">
          <div className="dialog-header">
            <h5 className="dialog-title">Record Part Usage</h5>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="dialog-content">
              <div className="mb-4">
                <label className="form-label">Search Part</label>
                <div className="search-container">
                  <input
                    type="text"
                    className="form-control"
                    value={searchTerm}
                    onChange={handleSearchChange}
                    placeholder="Search by part number or name"
                    disabled={!!selectedPart}
                  />
                  {searching && (
                    <div key="search-spinner" className="spinner-border spinner-border-sm text-primary position-absolute" 
                         style={{ right: '1rem', top: '0.75rem' }} 
                         role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  )}
                </div>

                {searchResults.length > 0 && !selectedPart && (
                  <div className="search-results">
                    {searchResults.map((part) => (
                      <div
                        key={`part-${part.part_id || Math.random().toString(36).substr(2, 9)}`}
                        className="search-item"
                        onClick={() => selectPart(part)}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div>
                            <div className="fw-bold">{part.name}</div>
                            <div className="info-text">
                              Fiserv: {part.fiserv_part_number} | 
                              Mfr: {part.manufacturer_part_number}
                            </div>
                          </div>
                          <div className="text-end">
                            <div className={getStockStatusClass(part.quantity, part.minimum_quantity)}>
                              {getStockStatusText(part.quantity, part.minimum_quantity)}
                            </div>
                            <div className="info-text mt-1">
                              Qty: {part.quantity}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedPart && (
                  <div key="selected-part" className="info-panel mt-3">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <div className="fw-bold">{selectedPart.name}</div>
                        <div className="info-text">
                          Fiserv: {selectedPart.fiserv_part_number}<br />
                          Mfr: {selectedPart.manufacturer_part_number}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => setSelectedPart(null)}
                      >
                        Change Part
                      </button>
                    </div>
                    <div className="mt-2">
                      <span className={getStockStatusClass(selectedPart.quantity, selectedPart.minimum_quantity)}>
                        {getStockStatusText(selectedPart.quantity, selectedPart.minimum_quantity)}
                      </span>
                      <span className="info-text ms-2">
                        Available: {selectedPart.quantity}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {selectedPart && (
                <>
                  <div className="mb-4">
                    <label className="form-label">Machine</label>
                    <div className="search-container">
                      <input
                        type="text"
                        className="form-control"
                        value={machineSearchTerm}
                        onChange={handleMachineSearchChange}
                        placeholder="Search for a machine"
                        disabled={!!selectedMachine}
                      />
                      {searchingMachines && (
                        <div key="machine-search-spinner" className="spinner-border spinner-border-sm text-primary position-absolute" 
                             style={{ right: '1rem', top: '0.75rem' }} 
                             role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                      )}
                    </div>

                    {machineResults.length > 0 && !selectedMachine && (
                      <div className="search-results">
                        {machineResults.map((machine) => (
                          <div
                            key={`machine-${machine.id || Math.random().toString(36).substr(2, 9)}`}
                            className="search-item"
                            onClick={() => selectMachine(machine)}
                          >
                            <div className="d-flex justify-content-between align-items-center">
                              <div>
                                <div className="fw-bold">{machine.name}</div>
                                {machine.description && (
                                  <div key={`machine-desc-${machine.id || Math.random().toString(36).substr(2, 9)}`} className="info-text">
                                    {machine.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedMachine && (
                      <div key="selected-machine" className="info-panel mt-3">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="fw-bold">{selectedMachine.name}</div>
                            {selectedMachine.description && (
                              <div key={`selected-machine-desc`} className="info-text">
                                {selectedMachine.description}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => setSelectedMachine(null)}
                          >
                            Change Machine
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="form-label">Quantity Used</label>
                    <input
                      type="number"
                      className="form-control"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                      min="1"
                      max={selectedPart.quantity}
                    />
                  </div>

                  <div className="mb-4">
                    <label className="form-label">Reason for Usage</label>
                    <textarea
                      className="form-control"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      placeholder="Explain why this part was used"
                    />
                  </div>
                </>
              )}
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
                  disabled={
                    loading || 
                    !selectedPart || 
                    !selectedMachine || 
                    quantity <= 0 || 
                    quantity > (selectedPart?.quantity || 0) || 
                    !reason.trim()
                  }
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Recording...
                    </>
                  ) : (
                    'Record Usage'
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

export default PartsUsageDialog;
