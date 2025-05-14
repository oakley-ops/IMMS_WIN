import axios, { AxiosInstance } from 'axios';
import { API_URL } from '../config';

// Create document API instance with longer timeout
const documentApi: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 180000, // 3 minutes
  headers: {
    'Content-Type': 'multipart/form-data'
  }
});

// Add auth token interceptor
documentApi.interceptors.request.use((config) => {
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
  return documentApi.get(`/api/v1/purchase-orders/${poId}/documents`);
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
    const response = await documentApi.get(`/api/v1/purchase-orders/documents/${documentId}/download`, {
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
  return documentApi.post(`/api/v1/purchase-orders/${poId}/documents`, formData, {
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
  return documentApi.delete(`/api/v1/purchase-orders/documents/${documentId}`);
};

export default documentApi;