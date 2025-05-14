import axiosInstance from '../utils/axios';
import { API_URL } from '../config';

// Create axios instance with base configuration
const api = axiosInstance;

// Add a request interceptor
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    
    // If token exists, add to headers
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Define document-related functions explicitly
const getDocumentsByPOId = (poId: number) => {
  console.log(`Fetching documents for PO ID: ${poId}`);
  return api.get(`/api/v1/purchase-orders/${poId}/documents`);
};

const downloadPODocument = (documentId: number) => {
  console.log(`Downloading document ID: ${documentId}`);
  return api.get(`/api/v1/purchase-orders/documents/${documentId}/download`, {
    responseType: 'blob'
  }).then(response => {
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Try to get filename from content-disposition header
    const contentDisposition = response.headers['content-disposition'];
    let filename = `document-${documentId}.pdf`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }
    }
    
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return response;
  });
};

const uploadDocument = (poId: number, formData: FormData) => {
  console.log(`Uploading document for PO ID: ${poId}`);
  return api.post(`/api/v1/purchase-orders/${poId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

// Vendors API (Legacy - kept for backward compatibility)
export const vendorsApi = {
  getAll: () => api.get('/api/v1/vendors'),
  getById: (id: number) => api.get(`/api/v1/vendors/${id}`),
  create: (vendorData: any) => api.post('/api/v1/vendors', vendorData),
  update: (id: number, vendorData: any) => api.put(`/api/v1/vendors/${id}`, vendorData),
  delete: (id: number) => api.delete(`/api/v1/vendors/${id}`),
};

// Suppliers API
export const suppliersApi = {
  getAll: () => api.get('/api/v1/suppliers'),
  getById: (id: number) => api.get(`/api/v1/suppliers/${id}`),
  create: (supplierData: any) => api.post('/api/v1/suppliers', supplierData),
  update: (id: number, supplierData: any) => api.put(`/api/v1/suppliers/${id}`, supplierData),
  delete: (id: number) => api.delete(`/api/v1/suppliers/${id}`),
  getPartsBySupplier: (id: number) => api.get(`/api/v1/suppliers/${id}/parts`),
};

// Purchase Orders API
export const purchaseOrdersApi = {
  // Use public routes temporarily until auth is fixed
  getAll: () => api.get('/api/v1/public/purchase-orders'),
  getById: (id: number) => api.get(`/api/v1/public/purchase-orders/${id}`),
  create: (poData: any) => api.post('/api/v1/purchase-orders', poData),
  createBlank: (poData: any) => api.post('/api/v1/purchase-orders/blank', poData),
  updateStatus: (id: number, status: string) => api.put(`/api/v1/purchase-orders/${id}/status`, { status }),
  update: (id: number, poData: any) => api.put(`/api/v1/purchase-orders/${id}`, poData),
  delete: (id: number) => api.delete(`/api/v1/purchase-orders/${id}`),
  generateForParts: (data: any) => api.post('/api/v1/purchase-orders/generate-for-low-stock', data),
  getPartsWithPendingOrders: () => api.get('/api/v1/purchase-orders/parts-with-pending-orders'),
  addPartToPO: (id: number, partData: any) => api.post(`/api/v1/purchase-orders/${id}/items`, partData),
  removePartFromPO: (id: number, itemId: number) => api.delete(`/api/v1/purchase-orders/${id}/items/${itemId}`),
  updatePartInPO: (id: number, itemId: number, partData: any) => api.put(`/api/v1/purchase-orders/${id}/items/${itemId}`, partData),
  createBlankPO: (data: any) => api.post('/api/v1/purchase-orders/blank', data),
  addItemToPO: (poId: number, itemData: any) => api.post(`/api/v1/purchase-orders/${poId}/items`, itemData),
  sendPOEmail: (emailData: {
    recipient: string;
    poNumber: string;
    poId: number;
    pdfBase64: string;
  }) => api.post('/api/v1/public/email/purchase-order', emailData),
  // Document management methods
  getDocumentsByPOId,
  downloadPODocument,
  uploadDocument
};

// Parts API
export const partsApi = {
  getAll: async (page = 1, limit = 10, search = '') => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (search) params.append('search', search);
    
    const response = await api.get(`/api/v1/parts?${params.toString()}`);
    return response.data;
  },
  
  getOne: async (id: string) => {
    const response = await api.get(`/api/v1/parts/${id}`);
    return response.data;
  },
  
  create: async (partData: any) => {
    const response = await api.post('/api/v1/parts', partData);
    return response.data;
  },
  
  update: async (id: string, partData: any) => {
    const response = await api.put(`/api/v1/parts/${id}`, partData);
    return response.data;
  },
  
  delete: async (id: string) => {
    const response = await api.delete(`/api/v1/parts/${id}`);
    return response.data;
  },
  
  getLowStock: async () => {
    const response = await api.get('/api/v1/parts/low-stock');
    console.log('Parts to reorder API response:', response);
    return response;
  },

  // Alias for getLowStock to use with more general naming
  getPartsToReorder: async () => {
    const response = await api.get('/api/v1/parts/low-stock');
    console.log('Parts to reorder API response:', response);
    return response;
  },

  // New function to check inventory status
  checkInventoryStatus: async () => {
    const response = await api.get('/api/v1/parts/inventory-status');
    return response.data;
  },
  
  // Supplier-related part methods
  getSuppliersForPart: async (partId: string) => {
    const response = await api.get(`/api/v1/parts/${partId}/suppliers`);
    return response.data;
  },
  
  addSupplierToPart: async (partId: string, supplierData: any) => {
    const response = await api.post(`/api/v1/parts/${partId}/suppliers`, supplierData);
    return response.data;
  },
  
  updatePartSupplier: async (partId: string, supplierId: number, data: any) => {
    const response = await api.put(`/api/v1/parts/${partId}/suppliers/${supplierId}`, data);
    return response.data;
  },
  
  removeSupplierFromPart: async (partId: string, supplierId: number) => {
    const response = await api.delete(`/api/v1/parts/${partId}/suppliers/${supplierId}`);
    return response.data;
  },
  
  setPreferredSupplier: async (partId: string, supplierId: number) => {
    const response = await api.put(`/api/v1/parts/${partId}/suppliers/${supplierId}/preferred`);
    return response.data;
  }
};

// Authentication API
export const authApi = {
  login: (credentials: any) => api.post('/api/v1/users/login', credentials),
  register: (userData: any) => api.post('/api/v1/users/register', userData),
  verifyToken: () => api.get('/api/v1/users/verify'),
};

export default api;
