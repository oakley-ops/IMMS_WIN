import axios from 'axios';

// Get base URL from environment or use default
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1';

// Create an isolated API instance for document operations
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Get documents for a purchase order
 * @param poId Purchase order ID
 * @returns Promise with the document data
 */
export const getDocumentsByPOId = (poId: number) => {
  console.log(`Fetching documents for PO ID: ${poId}`);
  return api.get(`/purchase-orders/${poId}/documents`);
};

/**
 * Download a document by ID
 * @param documentId Document ID to download
 * @returns Promise with the blob data
 */
export const downloadPODocument = async (documentId: number): Promise<Blob> => {
  console.log(`Downloading document ID: ${documentId}`);
  
  try {
    // Use axios with responseType blob to properly handle binary data
    const response = await api.get(`/purchase-orders/documents/${documentId}/download`, {
      responseType: 'blob',
      // Add timeout to ensure we don't wait forever
      timeout: 30000
    });
    
    // Log success information
    console.log(`Download successful, content type: ${response.headers['content-type']}, size: ${response.data.size} bytes`);
    
    // Return the blob directly
    return response.data;
  } catch (error) {
    console.error(`Error downloading document ID ${documentId}:`, error);
    throw error;
  }
};

/**
 * Upload a document for a purchase order
 * @param poId Purchase order ID
 * @param formData Form data with the document
 * @returns Promise with the upload response
 */
export const uploadDocument = (poId: number, formData: FormData) => {
  console.log(`Uploading document for PO ID: ${poId}`);
  return api.post(`/purchase-orders/${poId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

/**
 * Delete a document by ID
 * @param documentId Document ID to delete
 * @returns Promise with the delete response
 */
export const deleteDocument = (documentId: number) => {
  console.log(`Deleting document ID: ${documentId}`);
  return api.delete(`/purchase-orders/documents/${documentId}`);
};

export default {
  getDocumentsByPOId,
  downloadPODocument,
  uploadDocument,
  deleteDocument
};