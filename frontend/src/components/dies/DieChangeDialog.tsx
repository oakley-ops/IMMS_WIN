import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../../styles/Dialog.css';

const API_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/v1`
  : 'http://localhost:4000/api/v1';
const IMMS_BLUE = '#0066A1';

interface DieChangeDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  die: any;
  action: 'install' | 'remove';
}

const ALL_REASON_CODES = [
  { value: 'NEW_INSTALL', label: 'New Installation' },
  { value: 'REPLACEMENT', label: 'Replacement' },
  { value: 'SCH_MAINT', label: 'Scheduled Maintenance' },
  { value: 'ROTATION', label: 'Die Rotation' },
  { value: 'UPGRADE', label: 'Upgrade' },
  { value: 'DULL', label: 'Die Dull - Needs Sharpening' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'QUALITY', label: 'Quality Issues' },
  { value: 'OTHER', label: 'Other' },
];

const DieChangeDialog: React.FC<DieChangeDialogProps> = ({
  open,
  onClose,
  onSuccess,
  die,
  action,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [machines, setMachines] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    machine_id: '',
    technician_id: '',
    technician_name: '',
    change_reason_code: '',
    change_reason_notes: '',
    expected_runtime_hours: '',
    expected_cycles: '',
    actual_runtime_hours: '',
    actual_cycles: '',
    cycles_at_removal: '',
    die_condition: '',
    next_status: '',
  });

  useEffect(() => {
    if (open) {
      if (action === 'install') {
        fetchMachines();
      }
      fetchTechnicians();
      resetForm();
    }
  }, [open, action]);

  const resetForm = () => {
    setFormData({
      machine_id: '',
      technician_id: '',
      technician_name: '',
      change_reason_code: '',
      change_reason_notes: '',
      expected_runtime_hours: '',
      expected_cycles: '',
      actual_runtime_hours: '',
      actual_cycles: '',
      cycles_at_removal: '',
      die_condition: '',
      next_status: '',
    });
    setError(null);
  };

  const fetchMachines = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/machines?machine_type=Die Press`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMachines(response.data);
    } catch (error) {
      console.error('Error fetching machines:', error);
    }
  };

  const fetchTechnicians = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/technicians`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTechnicians(response.data);
    } catch (error) {
      console.error('Error fetching technicians:', error);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (action === 'install' && !formData.machine_id) {
      setError('Please select a machine');
      return;
    }

    if (!formData.change_reason_code) {
      setError('Please select a reason for this change');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const payload: any = {
        change_reason_code: formData.change_reason_code,
        change_reason_notes: formData.change_reason_notes,
        technician_id: formData.technician_id ? parseInt(formData.technician_id) : null,
        technician_name: formData.technician_name,
      };

      if (action === 'install') {
        payload.machine_id = parseInt(formData.machine_id);
        payload.expected_runtime_hours = formData.expected_runtime_hours
          ? parseInt(formData.expected_runtime_hours)
          : null;
        payload.expected_cycles = formData.expected_cycles
          ? parseInt(formData.expected_cycles)
          : null;

        await axios.post(`${API_URL}/dies/${die.die_id}/install`, payload, { headers });
      } else {
        payload.actual_runtime_hours = formData.actual_runtime_hours
          ? parseInt(formData.actual_runtime_hours)
          : null;
        payload.actual_cycles = formData.actual_cycles ? parseInt(formData.actual_cycles) : null;
        payload.cycles_at_removal = formData.cycles_at_removal
          ? parseInt(formData.cycles_at_removal)
          : null;
        payload.die_condition = formData.die_condition;
        payload.next_status = formData.next_status;

        await axios.post(`${API_URL}/dies/${die.die_id}/remove`, payload, { headers });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error performing die change:', err);
      setError(err.response?.data?.error || `Failed to ${action} die`);
    } finally {
      setLoading(false);
    }
  };

  const reasonCodes = ALL_REASON_CODES;

  if (!open) return null;

  return (
    <div className="modal">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content custom-dialog">
          <div className="dialog-header" style={{ backgroundColor: IMMS_BLUE }}>
            <h5 className="dialog-title">
              {action === 'install' ? 'Install Die in Machine' : 'Remove Die from Machine'}
            </h5>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            <div className="dialog-content">
              {error && (
                <div className="alert alert-danger mb-4" role="alert">
                  {error}
                </div>
              )}

              <div className="info-panel" style={{ marginBottom: '1.5rem' }}>
                <p className="info-text" style={{ margin: 0 }}>
                  Die: <strong>{die?.die_number}</strong> ({die?.die_type})
                </p>
              </div>

              {action === 'install' && (
                <div className="form-group">
                  <label className="form-label">Select Machine *</label>
                  <select
                    className="form-select"
                    value={formData.machine_id}
                    onChange={(e) => handleChange('machine_id', e.target.value)}
                    required
                  >
                    <option value="">Select a machine...</option>
                    {machines.map((machine) => (
                      <option key={machine.machine_id} value={machine.machine_id}>
                        {machine.name} - {machine.location || 'No location'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Reason for Change *</label>
                <select
                  className="form-select"
                  value={formData.change_reason_code}
                  onChange={(e) => handleChange('change_reason_code', e.target.value)}
                  required
                >
                  <option value="">Select a reason...</option>
                  {reasonCodes.map((reason: { value: string; label: string }) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Technician or Operator</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.technician_name}
                  onChange={(e) => handleChange('technician_name', e.target.value)}
                  list="technicians-list"
                  placeholder="Enter or select technician name"
                />
                <datalist id="technicians-list">
                  {technicians.map((tech) => (
                    <option key={tech.technician_id} value={tech.name} />
                  ))}
                </datalist>
              </div>

              {action === 'install' && (
                <div className="grid-container grid-2-cols">
                  <div className="form-group">
                    <label className="form-label">Expected Runtime (hours)</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.expected_runtime_hours}
                      onChange={(e) => handleChange('expected_runtime_hours', e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expected Cycles</label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.expected_cycles}
                      onChange={(e) => handleChange('expected_cycles', e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              )}

              {action === 'remove' && (
                <>
                  <div className="grid-container grid-2-cols">
                    <div className="form-group">
                      <label className="form-label">Actual Runtime (hours)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.actual_runtime_hours}
                        onChange={(e) => handleChange('actual_runtime_hours', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Actual Cycles</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.actual_cycles}
                        onChange={(e) => handleChange('actual_cycles', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Total Cycles at Removal</label>
                      <input
                        type="number"
                        className="form-control"
                        value={formData.cycles_at_removal}
                        onChange={(e) => handleChange('cycles_at_removal', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Die Condition</label>
                      <select
                        className="form-select"
                        value={formData.die_condition}
                        onChange={(e) => handleChange('die_condition', e.target.value)}
                      >
                        <option value="">Select condition...</option>
                        <option value="GOOD">Good</option>
                        <option value="FAIR">Fair</option>
                        <option value="POOR">Poor</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Next Status</label>
                    <select
                      className="form-select"
                      value={formData.next_status}
                      onChange={(e) => handleChange('next_status', e.target.value)}
                    >
                      <option value="">Auto (Based on Condition)</option>
                      <option value="SHARP">Sharp</option>
                      <option value="USED">Used</option>
                    </select>
                    <small className="info-text" style={{ display: 'block', marginTop: '0.25rem' }}>
                      Leave blank for automatic status based on condition
                    </small>
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Additional Notes</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={formData.change_reason_notes}
                  onChange={(e) => handleChange('change_reason_notes', e.target.value)}
                  placeholder="Enter any additional notes..."
                />
              </div>
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
                  style={{
                    background: action === 'install' 
                      ? 'linear-gradient(135deg, #4CAF50 0%, #45A049 100%)' 
                      : 'linear-gradient(135deg, #F44336 0%, #D32F2F 100%)',
                  }}
                >
                  {loading ? (
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  ) : action === 'install' ? (
                    'Install Die'
                  ) : (
                    'Remove Die'
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DieChangeDialog;
