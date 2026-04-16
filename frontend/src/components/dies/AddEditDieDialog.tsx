import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../../styles/Dialog.css';

const API_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/v1`
  : 'http://localhost:4000/api/v1';
const IMMS_BLUE = '#0066A1';
const IMMS_ORANGE = '#FF6600';

interface Machine {
  machine_id: number;
  name: string;
  machine_type?: string;
}

interface AddEditDieDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  die?: any;
}

const AddEditDieDialog: React.FC<AddEditDieDialogProps> = ({
  open,
  onClose,
  onSuccess,
  die,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [formData, setFormData] = useState({
    die_number: '',
    die_type: '',
    notes: '',
    status: 'SHARP',
    compatible_machine_ids: [] as number[],
  });

  // Fetch die press machines
  useEffect(() => {
    const fetchMachines = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/machines`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Filter to only show die press machines
        const diePressMachines = response.data.filter((m: Machine) =>
          m.name?.toLowerCase().includes('die press') ||
          m.machine_type?.toLowerCase().includes('die press')
        );
        setMachines(diePressMachines);
      } catch (err) {
        console.error('Error fetching machines:', err);
      }
    };
    if (open) {
      fetchMachines();
    }
  }, [open]);

  useEffect(() => {
    if (die) {
      setFormData({
        die_number: die.die_number || '',
        die_type: die.die_type || '',
        notes: die.notes || '',
        status: die.status || 'SHARP',
        compatible_machine_ids: die.compatible_machine_ids || [],
      });
    } else {
      setFormData({
        die_number: '',
        die_type: '',
        notes: '',
        status: 'SHARP',
        compatible_machine_ids: [],
      });
    }
    setError(null);
  }, [die, open]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleMachineToggle = (machineId: number) => {
    setFormData((prev) => {
      const currentIds = prev.compatible_machine_ids || [];
      const newIds = currentIds.includes(machineId)
        ? currentIds.filter(id => id !== machineId)
        : [...currentIds, machineId];
      return { ...prev, compatible_machine_ids: newIds };
    });
  };

  const handleSubmit = async () => {
    if (!formData.die_number || !formData.die_type) {
      setError('Die number and type are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const payload = {
        ...formData,
        // Send null if no machines selected (means compatible with all)
        compatible_machine_ids: formData.compatible_machine_ids?.length > 0
          ? formData.compatible_machine_ids
          : null,
      };

      if (die) {
        await axios.put(`${API_URL}/dies/${die.die_id}`, payload, { headers });
      } else {
        await axios.post(`${API_URL}/dies`, payload, { headers });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving die:', err);
      setError(err.response?.data?.error || 'Failed to save die');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content custom-dialog">
          <div className="dialog-header" style={{ backgroundColor: IMMS_BLUE }}>
            <h5 className="dialog-title">{die ? 'Edit Die' : 'Add New Die'}</h5>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <div className="dialog-content">
              {error && (
                <div className="alert alert-danger mb-4" role="alert">
                  {error}
                </div>
              )}

              <div className="grid-container grid-2-cols">
                <div className="form-group">
                  <label className="form-label">Die Number *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.die_number}
                    onChange={(e) => handleChange('die_number', e.target.value)}
                    placeholder="e.g., 100, 201, 305"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Die Type *</label>
                  <select
                    className="form-select"
                    value={formData.die_type}
                    onChange={(e) => handleChange('die_type', e.target.value)}
                    required
                  >
                    <option value="">Select Type</option>
                    <option value="4 up die">4 up die</option>
                    <option value="8 up die">8 up die</option>
                  </select>
                </div>

                {die && (
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={formData.status}
                      onChange={(e) => handleChange('status', e.target.value)}
                    >
                      <option value="SHARP">Sharp</option>
                      <option value="USED">Used</option>
                      <option value="OUT_FOR_SHARPENING">Sent Out for Sharpening</option>
                      <option value="IN_MACHINE">In Machine</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Additional notes about this die..."
                />
              </div>

              {machines.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Compatible Machines</label>
                  <p className="text-muted small mb-2">
                    Select which machines this die can be installed in. Leave empty if compatible with all.
                  </p>
                  <div className="border rounded p-2" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {machines.map((machine) => (
                      <div key={machine.machine_id} className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id={`machine-${machine.machine_id}`}
                          checked={formData.compatible_machine_ids?.includes(machine.machine_id) || false}
                          onChange={() => handleMachineToggle(machine.machine_id)}
                        />
                        <label className="form-check-label" htmlFor={`machine-${machine.machine_id}`}>
                          {machine.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="dialog-footer">
              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  ) : die ? 'Update Die' : 'Add Die'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddEditDieDialog;
