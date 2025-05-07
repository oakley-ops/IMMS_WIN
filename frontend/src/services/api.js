import axios from 'axios';
import axiosRetry from 'axios-retry';

// Create axios instance with base URL
const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1',
  timeout: 60000, // Increase default timeout to 60 seconds
  headers: {
    'Content-Type': 'application/json'
  }
});

// Configure retry logic
axiosRetry(axiosInstance, { 
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Retry on network errors or 5xx server errors
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
           (error.response && error.response.status >= 500);
  }
});

// Add request interceptor for authentication
axiosInstance.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    // If token exists, add to headers
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add longer timeout for specific operations
    if (config.method === 'delete') {
      config.timeout = 120000; // 120 seconds for delete operations
    } else if (config.url?.includes('/purchase-orders/') && config.url?.includes('/status')) {
      config.timeout = 120000; // 120 seconds for status updates
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for better error handling
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('Request timed out:', error.config.url);
      // For status updates, try one more time with a longer timeout
      if (error.config.url?.includes('/purchase-orders/') && error.config.url?.includes('/status')) {
        console.log('Retrying status update with longer timeout...');
        error.config.timeout = 180000; // 3 minutes
        return axiosInstance(error.config);
      }
      return Promise.reject(new Error('Request timed out. Please try again.'));
    }
    return Promise.reject(error);
  }
);

// API services object
const api = {
  // Parts API
  partsApi: { 
    getAllParts: async () => {
      const response = await axiosInstance.get('/parts');
      return response.data;
    },

    getAll: async () => {
      try {
        const response = await axiosInstance.get('/parts');
        console.log('Raw API response from parts endpoint:', response);
        return response;
      } catch (error) {
        console.error('Error in partsApi.getAll:', error);
        throw error;
      }
    },

    getPartById: async (id) => {
      const response = await axiosInstance.get(`/parts/${id}`);
      return response.data;
    },
    
    getLowStockParts: async () => {
      const response = await axiosInstance.get('/parts/low-stock');
      return response.data;
    },
    
    getPartsToReorder: async () => {
      try {
        // The to-reorder endpoint doesn't exist, use low-stock instead
        // We're getting a 500 error because the backend is trying to parse "to-reorder" as an integer
        const response = await axiosInstance.get('/parts/low-stock');
        return response;
      } catch (error) {
        console.error('Error in partsApi.getPartsToReorder:', error);
        throw error;
      }
    },
    
    createPart: async (partData) => {
      const response = await axiosInstance.post('/parts', partData);
      return response.data;
    },
    
    updatePart: async (id, partData) => {
      const response = await axiosInstance.put(`/parts/${id}`, partData);
      return response.data;
    },
    
    deletePart: async (id) => {
      const response = await axiosInstance.delete(`/parts/${id}`);
      return response.data;
    }
  },
  
  // Vendors API
  vendorsApi: {
    getAllVendors: async () => {
      const response = await axiosInstance.get('/vendors');
      return response.data;
    },
    
    getVendorById: async (id) => {
      const response = await axiosInstance.get(`/vendors/${id}`);
      return response.data;
    },
    
    createVendor: async (vendorData) => {
      const response = await axiosInstance.post('/vendors', vendorData);
      return response.data;
    },
    
    updateVendor: async (id, vendorData) => {
      const response = await axiosInstance.put(`/vendors/${id}`, vendorData);
      return response.data;
    },
    
    deleteVendor: async (id) => {
      const response = await axiosInstance.delete(`/vendors/${id}`);
      return response.data;
    }
  },
  
  // Purchase Orders API
  purchaseOrdersApi: {
    getAll: async () => {
      const response = await axiosInstance.get('/purchase-orders');
      return response;
    },
    
    getById: async (id) => {
      const response = await axiosInstance.get(`/purchase-orders/${id}`);
      return response;
    },
    
    getPartsWithPendingOrders: async () => {
      try {
        // This endpoint should fetch parts that already have pending, submitted, or approved orders
        const response = await axiosInstance.get('/purchase-orders/parts-with-pending-orders');
        return response;
      } catch (error) {
        console.error('Error in purchaseOrdersApi.getPartsWithPendingOrders:', error);
        // Return empty array as fallback to prevent blocking the UI
        return { data: [] };
      }
    },
    
    generateForParts: async (partsData) => {
      try {
        // Use the generate-for-low-stock endpoint instead of generate-for-parts
        const response = await axiosInstance.post('/purchase-orders/generate-for-low-stock', partsData);
        return response;
      } catch (error) {
        console.error('Error in purchaseOrdersApi.generateForParts:', error);
        throw error;
      }
    },
    
    create: async (poData) => {
      const response = await axiosInstance.post('/purchase-orders', poData);
      return response;
    },
    
    createBlank: async (poData) => {
      try {
        console.log('Creating blank PO with data:', JSON.stringify(poData, null, 2));
        const response = await axiosInstance.post('/purchase-orders/blank', poData);
        console.log('Blank PO created successfully:', response.data);
        return response;
      } catch (error) {
        console.error('Error in purchaseOrdersApi.createBlank:', error);
        // Log detailed error information
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error('Error response data:', error.response.data);
          console.error('Error response status:', error.response.status);
          console.error('Error response headers:', error.response.headers);
        } else if (error.request) {
          // The request was made but no response was received
          console.error('Error request:', error.request);
        } else {
          // Something happened in setting up the request that triggered an Error
          console.error('Error message:', error.message);
        }
        throw error;
      }
    },
    
    createBlankPO: async (poData) => {
      try {
        console.log('Creating blank PO with data (createBlankPO):', JSON.stringify(poData, null, 2));
        const response = await axiosInstance.post('/purchase-orders/blank', poData);
        console.log('Blank PO created successfully (createBlankPO):', response.data);
        return response;
      } catch (error) {
        console.error('Error in purchaseOrdersApi.createBlankPO:', error);
        // Log detailed error information
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          console.error('Error response data:', error.response.data);
          console.error('Error response status:', error.response.status);
          console.error('Error response headers:', error.response.headers);
        } else if (error.request) {
          // The request was made but no response was received
          console.error('Error request:', error.request);
        } else {
          // Something happened in setting up the request that triggered an Error
          console.error('Error message:', error.message);
        }
        throw error;
      }
    },
    
    update: async (id, poData) => {
      const response = await axiosInstance.put(`/purchase-orders/${id}`, poData);
      return response;
    },
    
    delete: async (id) => {
      const response = await axiosInstance.delete(`/purchase-orders/${id}`);
      return response;
    },
    
    updateStatus: async (id, status) => {
      try {
        // Create a new axios instance with longer timeout for this specific request
        const statusAxios = axios.create({
          baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1',
          timeout: 180000, // 3 minutes for status updates
          headers: {
            'Content-Type': 'application/json'
          }
        });

        // Add token if exists
        const token = localStorage.getItem('token');
        if (token) {
          statusAxios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }

        const response = await statusAxios.put(`/purchase-orders/${id}/status`, { status });
        return response;
      } catch (error) {
        console.error('Error updating PO status:', error);
        throw error;
      }
    },
    
    addPartToPO: async (poId, partData) => {
      try {
        const response = await axiosInstance.post(`/purchase-orders/${poId}/items`, partData);
        return response;
      } catch (error) {
        console.error('Error in purchaseOrdersApi.addPartToPO:', error);
        throw error;
      }
    },
    
    addItemToPO: async (poId, itemData) => {
      try {
        const response = await axiosInstance.post(`/purchase-orders/${poId}/items`, itemData);
        return response;
      } catch (error) {
        console.error('Error in purchaseOrdersApi.addItemToPO:', error);
        throw error;
      }
    },
    
    sendPOEmail: async (emailData) => {
      try {
        const response = await axiosInstance.post('/email/purchase-order', emailData);
        return response;
      } catch (error) {
        console.error('Error in purchaseOrdersApi.sendPOEmail:', error);
        throw error;
      }
    },
    
    removePartFromPO: async (id, itemId) => {
      const response = await axiosInstance.delete(`/purchase-orders/${id}/items/${itemId}`);
      return response;
    }
  },
  
  // Suppliers API
  suppliersApi: {
    getAllSuppliers: async () => {
      const response = await axiosInstance.get('/suppliers');
      return response.data;
    },
    
    getAll: async () => {
      try {
        const response = await axiosInstance.get('/suppliers');
        return response;
      } catch (error) {
        console.error('Error in suppliersApi.getAll:', error);
        throw error;
      }
    },
    
    getSupplierById: async (id) => {
      const response = await axiosInstance.get(`/suppliers/${id}`);
      return response.data;
    },
    
    createSupplier: async (supplierData) => {
      const response = await axiosInstance.post('/suppliers', supplierData);
      return response.data;
    },
    
    updateSupplier: async (id, supplierData) => {
      const response = await axiosInstance.put(`/suppliers/${id}`, supplierData);
      return response.data;
    },
    
    deleteSupplier: async (id) => {
      const response = await axiosInstance.delete(`/suppliers/${id}`);
      return response.data;
    }
  }
};

export const { partsApi, vendorsApi, purchaseOrdersApi, suppliersApi } = api;
export default api;