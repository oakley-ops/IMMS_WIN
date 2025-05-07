import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../utils/axios';
import { API_URL } from '../config';

export interface PartSupplier {
  part_supplier_id?: number;
  supplier_id: number;
  part_id?: number;
  supplier_name?: string;
  unit_cost: number;
  is_preferred: boolean;
  lead_time_days?: number;
  minimum_order_quantity?: number;
}

export type Part = {
  part_id: number;
  name: string;
  description: string;
  manufacturer_part_number: string;
  fiserv_part_number: string;
  quantity: number;
  minimum_quantity: number;
  machine_id: number;
  supplier_id?: number;  // Used for creating/updating a part with primary supplier
  supplier?: string;     // Legacy field - kept for backward compatibility
  suppliers?: PartSupplier[]; // Multiple suppliers for a part
  unit_cost: number;
  location: string;
  image_url?: string;
  status?: 'active' | 'discontinued';
  notes?: string;
};

interface PartsState {
  parts: Part[];
  loading: boolean;
  error: string | null;
}

const initialState: PartsState = {
  parts: [],
  loading: false,
  error: null,
};

export const fetchParts = createAsyncThunk(
  'parts/fetchParts',
  async () => {
    const response = await axiosInstance.get<Part[]>(`/api/v1/parts`);
    return response.data;
  }
);

export const addPart = createAsyncThunk('parts/addPart', async (newPart: Part) => {
  const response = await axiosInstance.post(`/api/v1/parts`, newPart);
  return response.data;
});

export const deletePart = createAsyncThunk(
  'parts/deletePart',
  async (partId: number) => {
    await axiosInstance.delete(`/api/v1/parts/${partId}`);
    return partId;
  }
);

const partsSlice = createSlice({
  name: 'parts',
  initialState,
  reducers: {}, // You can add reducers for synchronous actions here
  extraReducers: (builder) => {
    builder
      .addCase(fetchParts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchParts.fulfilled, (state, action) => {
        state.loading = false;
        state.parts = action.payload;
      })
      .addCase(fetchParts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch parts';
      })
      .addCase(addPart.fulfilled, (state, action) => {
        state.parts.push(action.payload);
      })
      .addCase(deletePart.fulfilled, (state, action) => {
        state.parts = state.parts.filter(part => part.part_id !== action.payload);
      });
  },
});

export default partsSlice.reducer;