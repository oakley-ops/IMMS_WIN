import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
// Import the fetchMachines action from your machinesSlice
import { fetchMachines } from '../store/machinesSlice'; 

interface MachineFormData {
  name: string;
  model_number: string;
  serial_number: string;
}

const EditMachineForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [formData, setFormData] = useState<MachineFormData>({
    name: '',
    model_number: '',
    serial_number: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMachine = async () => {
      try {
        const response = await axios.get(`/api/v1/machines/${id}`);
        setFormData(response.data);
      } catch (error: any) {
        console.error('Error fetching machine:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchMachine();
    }
  }, [id]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Basic input validation
    if (!formData.name || !formData.model_number || !formData.serial_number) {
      alert('Please fill in all required fields.');
      return;
    }

    try {
      await axios.put(`/api/v1/machines/${id}`, formData);
      // Dispatch the fetchMachines action to update the machines list
      dispatch(fetchMachines()); 
      navigate('/machines');
    } catch (error: any) {
      console.error('Error updating machine:', error);
      // Handle errors, e.g., display a more specific error message to the user
      alert(error.response?.data?.message || 'Failed to update machine.'); 
    }
  };

  if (loading) {
    return <div>Loading machine...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-md-8 offset-md-2">
          <div className="card">
            <div className="card-body">
              <h2 className="card-title text-center mb-4">Edit Machine</h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="name" className="form-label">Machine Name</label>
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
                  <label htmlFor="model_number" className="form-label">Model Number</label>
                  <input
                    type="text"
                    className="form-control"
                    id="model_number"
                    name="model_number"
                    value={formData.model_number}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="serial_number" className="form-label">Serial Number</label>
                  <input
                    type="text"
                    className="form-control"
                    id="serial_number"
                    name="serial_number"
                    value={formData.serial_number}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="d-grid gap-2">
                  <button type="submit" className="btn btn-primary">
                    Update Machine
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => navigate('/machines')}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditMachineForm;