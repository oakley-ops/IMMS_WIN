// frontend/src/store/machinesSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import mockMachines from '../mockData/machines';

interface Machine {
  id?: number;
  machine_id?: number;
  name: string;
  model: string;
  serial_number: string;
  location: string;
  manufacturer: string;
  installation_date: string;
  last_maintenance_date: string | null;
  next_maintenance_date: string;
  notes: string;
  status: string;
}

interface MachinesState {
  machines: Machine[];
  loading: boolean;
  error: string | null;
}

const initialState: MachinesState = {
  machines: [],
  loading: false,
  error: null,
};

export const fetchMachines = createAsyncThunk('machines/fetchMachines', async () => {
  // For development, use mock data instead of API call
  return mockMachines;
  
  // When ready to connect to real API, uncomment this:
  // const response = await axios.get<Machine[]>('/api/v1/machines');
  // return response.data;
});

const machinesSlice = createSlice({
  name: 'machines',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMachines.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMachines.fulfilled, (state, action) => {
        state.loading = false;
        state.machines = action.payload;
      })
      .addCase(fetchMachines.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch machines';
      });
  },
});

export default machinesSlice.reducer;